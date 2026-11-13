# Progress — pico-search-converter

> 只記**現況、已定案決策與理由、阻塞點**。待辦細項在 `Todo.md`，規格在 `spec.md`。

## 現況（2026-11-13）

- 階段：**M4、M5 完成，下一步 M6 CI／部署／文件；live 測試包待使用者執行**
- 程式碼：core、三個平台 renderer、TXT 匯出、完整 UI；`typecheck`／`test`（166 個）／`build` 本機通過
- build 產物：JS 252 kB（gzip 81 kB）、CSS 8.8 kB、字型 woff2 兩個各約 15 kB
- 阻塞：無
- 未完成的驗證：UI 尚未目視檢查（截圖工具逾時），手機寬度未實測
- 三個平台目前皆為 **Not live-validated**

| Milestone | 狀態 |
|---|---|
| M0 決策定案 | 完成（2026-11-13） |
| M1 鷹架 | 完成（2026-11-13） |
| M2 Core | 完成（2026-11-13） |
| M3 Renderers | 完成（2026-11-13）；輸出格式未經 live 驗證 |
| M4 匯出 | 完成（2026-11-13） |
| M5 UI | 完成（2026-11-13）；待目視檢查 |
| M6 CI／部署／文件 | 未開始 |
| M7 Live 驗證與發布 | 未開始 |

## 環境

- Node v24.15.0／npm 11.12.1／git 2.54.0／gh 2.92.0（Windows 11）
- Vite 8.3／React 19.3／TypeScript 7.0／Vitest 5.1／jsdom 31／React Testing Library 16.3
- 本機路徑：`C:\Users\liang\projects\pico-search-converter`
- Remote：尚未建立（D7 已定 GitHub public；M6 建立前須再確認）

## Spec 評估摘要（2026-11-13）

**結論：spec 可實作，核心架構（AST → 平台 emitter）與範圍切割合理；但有 2 處會直接卡住 core 的規格漏洞，以及數項未定的工程決策。**

### 規格漏洞（需定案）

1. **§4.1 無允許字元定義**。只寫「無法保證安全就拒絕」，但 `Crohn's disease`、`beta-blocker`、`COVID-19`、`TNF-α` 都是教學時必然出現的輸入。Embase.com 以單引號包片語，apostrophe 是實際衝突點。→ D1
2. **§2.1 步驟 2 與 §4.1／T11 衝突**。「含空白自動視為片語」與「term 內 raw AND/OR/NOT 拒絕」對 `signs and symptoms` 這類輸入給出相反結果。→ D2
3. **§3.3 `Result.query: string`** 無法表達 §4.3 的「單一 target blocking error」。→ 已自行定案為 `string | null`
4. **§10 DoD「T01–T25 在 CI 通過」**，但 T20／T23／T24 是瀏覽器行為，spec 的測試結構（Vitest）沒說明如何涵蓋。→ D6
5. **§6.3 final query 上限 10,000 字元**與 §4.4 PubMed URL 連結並存，encode 後 URL 會超出實務長度限制。→ 已自行定案（過長停用連結）

### 與全域慣例的衝突

- AGENTS.md 指定 Noto Sans TC + DM Mono；若走 CDN 會產生第三方請求，與 spec §2.3 精神不合。→ D5
- AGENTS.md 主技術棧為 React；spec §3.1 結構是 vanilla TS。→ D3

### 風險

| 風險 | 影響 | 對策 |
|---|---|---|
| live 驗證發現語法錯誤 | 需回頭改 renderer | D8 已確認三個 target 皆可驗；測試包在 M3 完成後即送驗，不等 UI |
| 欄位對應（`[tiab]`／`:ti,ab,kw`／`.ti,ab,kf.`）被使用者誤認為等價 | 教學誤導 | 每張輸出卡固定顯示近似性 warning，不可關閉 |
| 字元政策過嚴導致常見疾病名被拒 | 課堂體驗差 | D1 查證 escape 規則後盡量放行，錯誤訊息附改寫建議 |
| vendor 語法改版 | 輸出失效 | README 記錄查證日期與來源；golden fixture 集中管理 |

### 工作量粗估（推論，非承諾）

M1–M4（core + render + 測試）為主體且風險最低；M5 UI 次之；M7 取決於 D8 的權限與人力。

## 決策紀錄

| 日期 | 編號 | 決策 | 理由 |
|---|---|---|---|
| 2026-11-13 | — | 範圍限 Phase 1 | spec §9、§11 |
| 2026-11-13 | — | `Result.query` 為 `string \| null` | §4.3 單一 target blocking error |
| 2026-11-13 | — | 去重保留首次出現大小寫 | §4.1 未指定；確保輸出穩定（T25） |
| 2026-11-13 | — | PubMed URL 過長時停用連結 | §6.3 上限與 URL 實務長度衝突 |
| 2026-11-13 | D1 | free text 僅允許 ASCII 字母／數字／空白／連字號；含空白或連字號一律加引號；apostrophe 與非 ASCII 字母 v1 拒絕並附改寫建議 | Elsevier support 無 apostrophe escape 記載；雙引號包覆未經測試，M7 實測後再評估放行 |
| 2026-11-13 | D2 | 含 and/or/not 的輸入：使用者明確加引號才接受為片語；未加引號一律拒絕（不分大小寫），提示加引號或分行 | 解 §2.1 與 §4.1／T11 衝突；無引號時無法分辨片語與誤寫的 Boolean 邏輯 |
| 2026-11-13 | D3 | UI 用 React（非 spec §3.1 的 vanilla TS） | 使用者決定；與既有專案技術棧一致。core／render 仍為純函式 |
| 2026-11-13 | D4 | 視覺走 `frontend-design`，不沿用 pharmacy-tool-style token | 使用者決定；工具定位偏教學與展示 |
| 2026-11-13 | D5 | 字型 self-host；拉丁／等寬字 M5 由 frontend-design 選定；中文用系統字型堆疊 | spec §2.3 禁第三方請求；中文 webfont 體積數 MB，教室網路與手機載入慢 |
| 2026-11-13 | D6 | Vitest + jsdom + RTL，不用 Playwright；T23 靜態檢查 + 手動，T24 部分自動 + 手動 | 靜態小頁不值得 CI 裝瀏覽器；驗證方式須照實揭露 |
| 2026-11-13 | D7 | GitHub Pages + public repo + MIT | 教學展示需公開網址；CI 同在 GitHub Actions；參考專案皆 MIT。建 remote 前須再確認 |
| 2026-11-13 | D8 | 三個 target 皆由使用者 live 驗證（有 Embase.com 與 Ovid MEDLINE 權限） | spec §6.2；可順帶實測 D1 的 apostrophe 與連字號行為 |
| 2026-11-13 | D9 | live preview 為主 + 保留 Generate；輸入有錯時不保留舊輸出、停用 Copy／匯出 | 即時對照是教學重點；避免複製到與輸入不一致的過期 query |
| 2026-11-13 | — | 只驗證已啟用的 block；未啟用 block 內的無效輸入不擋輸出 | spec §4.1：inactive block 只保存、不參與輸出 |
| 2026-11-13 | — | 未勾選「已確認」的 heading 為 blocking error（非靜默略過） | spec §2.2 不得靜默丟棄；§1.3 未驗證的 heading 不得輸出 |
| 2026-11-13 | — | `*` 的詞幹限純英文字母（`sglt2*`、`beta-block*` 拒絕） | spec §4.1「≥4 letters」；含數字／連字號的詞以片語輸出，片語內不支援 `*` |
| 2026-11-13 | — | 同名 heading 但 explode 設定不同 → 兩筆都保留 | 擇一會靜默改變檢索範圍 |
| 2026-11-13 | — | 破折號（en/em dash、minus）正規化為連字號 | 文書軟體自動替換的排版字元，不改變詞義 |
| 2026-11-13 | — | 每個概念 30 筆上限含 free text + MeSH + Emtree，去重前計算 | spec §6.3 未細分 |
| 2026-11-13 | — | heading 缺口警告為雙向：Embase 缺 Emtree、PubMed／Ovid 缺 MeSH 都警告 | spec §4.3 只寫 Embase 方向；§7.2 要求跨詞彙庫不得靜默 |
| 2026-11-13 | — | 只有 Emtree 的概念 → PubMed 與 Ovid 也是 blocking error | spec §4.3 的對稱情況 |
| 2026-11-13 | — | Ovid：含保留字（and/or/not/adj/use/from/exp/same/with/freq）的 heading 或單一詞加雙引號 | 避免被解析為運算子；**清單為假設**，待 live 測試包 B3 驗證 |
| 2026-11-13 | — | renderer 對未經 core 驗證的值直接拋錯 | spec §4.3：不得未經驗證就拼進語法分隔符 |
| 2026-11-13 | — | PubMed 連結由 `buildPubmedUrl` 另外產生，不放進 `Result` | 維持 spec §3.3 的 `Result` 形狀 |
| 2026-11-13 | — | `Result` 增加 `groups`（每個概念的輸出片段） | UI 分色需要結構；用字串切 ` AND ` 會被片語內的大寫 AND 破壞 |
| 2026-11-13 | — | 起始畫面預載 spec §5 範例 | 教學／展示定位：打開即是可操作的示範；「清空」後顯示引導而非錯誤 |
| 2026-11-13 | — | live preview 等待期間（debounce）輸出顯示「更新中」並停用 Copy | D9：不得複製到與輸入不一致的 query |
| 2026-11-13 | — | 「結構轉譯非等價」聲明固定顯示在輸出區頂端一次，不在三個平台各重複 | spec §7.1 要求常駐；重複三次會稀釋其他警告 |
| 2026-11-13 | — | TXT 匯出含輸入內容；下載時加 UTF-8 BOM | 可重現性；舊版 Windows 記事本判讀中文 |
| 2026-11-13 | — | 視覺：冷白底＋墨藍字，P/I/C/O 四色貫穿輸入與輸出；query 用 IBM Plex Mono | D4 frontend-design；分色本身承載「哪些是你的詞、哪些是平台語法」的教學資訊 |

## 實作注意（踩過的坑）

- 原始碼中的不可見或易混淆字元（零寬字元、彎引號、NBSP、U+2028 等）必須寫成 `\uXXXX` escape。字面的 U+2028／U+2029 在 regex literal 內會被視為換行，造成 `Unterminated regular expression`，錯誤訊息只指到該行開頭。

## 變更紀錄

- 2026-11-13：M4 匯出與 M5 UI 完成（React 元件、分色輸出、TXT 匯出、32 個新測試）。
- 2026-11-13：M3 Renderers 完成（三平台 emitter、4 個 golden fixture、29 個測試）；產出 `docs/live-validation.md`。
- 2026-11-13：M2 Core 完成（normalize／validate／buildAst + 105 個測試）。
- 2026-11-13：M0 D1–D9 定案；M1 鷹架完成（Vite + React + TS strict + Vitest/jsdom）。
- 2026-11-13：讀取 spec、完成評估；建立 `Todo.md`、`Progress.md`、`.gitignore`；`git init`（main）並完成首次 commit。
