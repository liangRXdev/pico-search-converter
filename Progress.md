# Progress — pico-search-converter

> 只記**現況、已定案決策與理由、阻塞點**。待辦細項在 `Todo.md`，規格在 `spec.md`。

## 現況（2026-11-13）

- 階段：**M0 — 規劃完成，等待 D1–D9 定案**
- 程式碼：尚未開始（無 `package.json`、無 `src/`）
- 阻塞：`Todo.md` M0 的 9 項決策

| Milestone | 狀態 |
|---|---|
| M0 決策定案 | 進行中（3/9） |
| M1 鷹架 | 未開始 |
| M2 Core | 未開始 |
| M3 Renderers | 未開始 |
| M4 匯出 | 未開始 |
| M5 UI | 未開始 |
| M6 CI／部署／文件 | 未開始 |
| M7 Live 驗證與發布 | 未開始 |

## 環境

- Node v24.15.0／npm 11.12.1／git 2.54.0／gh 2.92.0（Windows 11）
- 本機路徑：`C:\Users\liang\projects\pico-search-converter`
- Remote：尚未建立（待 D7）

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
| Embase.com／Ovid 無院內權限做 live 驗證 | 只能以 unverified 發布 | D8；UI 標章機制在 M5 就做進去 |
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

## 變更紀錄

- 2026-11-13：讀取 spec、完成評估；建立 `Todo.md`、`Progress.md`、`.gitignore`；`git init`（main）並完成首次 commit。
