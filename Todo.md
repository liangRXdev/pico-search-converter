# Todo — pico-search-converter

> 依據 `spec.md` v0.1.0-draft，範圍限 **Phase 1 (MVP)**。
> 順序原則：先定案決策 → core/render 純函式 + 測試 → UI → CI/部署 → live 驗證。
> 進度與決策紀錄見 `Progress.md`。

## M0 — 動工前待定案（spec 未定或自相矛盾，未定案前不寫程式）

- [x] **D1 字元白名單與 apostrophe 政策** — 2026-11-13 定案：採建議；apostrophe 待 M7 Embase.com 實測雙引號後再評估放行（§4.1 只說「無法保證就拒絕」，沒定義允許字元）
  - 影響：`Crohn's disease`、`beta-blocker`、`COVID-19`、`Sjögren`、`TNF-α`
  - 建議：free text 僅允許 ASCII 字母／數字／空白／連字號；含連字號或空白一律加引號輸出；apostrophe 與非 ASCII 字母 v1 一律拒絕並提示改寫（如 `Crohn disease`）
  - 查證結果（2026-11-13，Elsevier support 三頁）：**無** apostrophe escape 的官方記載；有記載片語可用單或雙引號；連字號的 tokenization 未記載。→ `'...'` 內含 apostrophe 無法保證安全，雙引號包覆屬未測試推論，需 live 測試才能放行
- [x] **D2 片語內 Boolean 字詞** — 2026-11-13 定案：採建議（明確加引號才接受，不分大小寫）（§2.1 步驟 2「含空白 → 自動片語」與 §4.1／T11「raw AND 拒絕」衝突，`signs and symptoms` 無解）
  - 建議：使用者**明確加引號**才接受含 and/or/not 的片語；未加引號一律拒絕並提示加引號（不分大小寫）
- [x] **D3 UI 技術** — 2026-11-13 定案：**React**（推翻建議；與既有專案一致）
  - 連帶：`src/main.tsx` + `src/ui/*.tsx`；props 定義 interface、不用 `any`；CSS 採 BEM；禁用 `dangerouslySetInnerHTML`（T17）；`src/core`、`src/render` 維持與 React 無關的純函式
- [x] **D4 視覺路由** — 2026-11-13 定案：**`frontend-design`**（推翻建議；定位偏教學與展示，建立獨立視覺識別）
  - 連帶：M5 動 UI 前載入 `frontend-design` skill；warning／「Not live-validated」／MeSH vs Emtree 的視覺層級仍須顯眼（spec §7）
- [x] **D5 字型** — 2026-11-13 定案：採建議
  - 一律 self-host（`@fontsource`），零第三方請求；英文與 query 等寬字由 `frontend-design` 於 M5 選定（不綁 DM Mono）；中文用系統字型堆疊，不打包中文 webfont
- [x] **D6 UI／瀏覽器層測試範圍** — 2026-11-13 定案：採建議
  - Vitest + jsdom + React Testing Library；v1 不引入 Playwright
  - T17、T20 全自動；T24 自動化 accessible name／語意元素／Tab 可達，screen reader 朗讀列 M7 手動；T23 以 build 產物無外部 URL 的靜態檢查 + M7 手動斷網
  - README 與 Progress.md 須照實註明 T23、T24 為間接驗證 + 手動檢核
- [x] **D7 部署與 repo** — 2026-11-13 定案：GitHub Pages + public repo `pico-search-converter` + MIT
  - Vite `base` = `/pico-search-converter/`；建立 remote 與 push 於 M6 執行前須再向使用者確認一次
- [ ] **D8 live 驗證資源**：院內是否有 Embase.com 與 Ovid MEDLINE 權限、由誰執行貼上測試
  - 無權限 → 該 target 於 UI 與 README 標示「Not live-validated」（§6.2、§10）
- [ ] **D9 Generate 行為**：按鈕觸發 vs live preview（§2.1 兩者皆可）
  - 建議：輸入合法時 live preview，保留 Generate 按鈕作為鍵盤／教學流程的明確動作

### 已自行定案的小缺口（實作時照此處理，不另詢問）

- `Result.query` 型別改為 `string | null`：§4.3 要求單一 target blocking error 時不得輸出 query，§3.3 型別未涵蓋
- 去重保留**首次出現**的大小寫；`heart failure` 與 `"heart failure"` 視為同一 term
- Heading 欄位（MeSH/Emtree）字元規則獨立於 free text：允許逗號、連字號（`Diabetes Mellitus, Type 2`），其餘比照 D1
- PubMed 連結：`encodeURIComponent` 後 URL 過長（暫定 > 2,000 字元）時停用連結並提示改用複製貼上
- 上限（30 terms／200 字元／10,000 字元）集中於單一 config 常數

## M1 — 專案鷹架

- [ ] Vite + React + TypeScript（strict）+ Vitest 初始化；`npm run typecheck / test / build`
- [ ] 目錄結構依 §3.1；`src/model/types.ts`（ConceptId、TermNode、Expr、Result、Warning）
- [ ] `src/config.ts`：輸入上限與 warning code 常數

## M2 — Core（純函式，先寫測試）

- [ ] `core/normalize.ts`：Unicode 空白、CRLF、curly quotes、外層引號剝除、空白摺疊（T18）
- [ ] `core/validate.ts`
  - [ ] 字元白名單（依 D1）、長度／數量上限（T19）
  - [ ] wildcard：僅結尾 `*` 且前方 ≥4 字母（T07、T08、T09）
  - [ ] 拒絕 Boolean／括號／field tag／proximity／`?` `$` `[]` `/`（T11、T15、T16）
  - [ ] block 層級：至少一個 enabled block、enabled 不可為空（T05）
  - [ ] 每個錯誤訊息含修正建議，不靜默丟棄 term
- [ ] `core/buildAst.ts`：block 內去重（T06）、P→I→C→O 固定順序、`and(or(...))` 結構
- [ ] 通知產生：C/O 有內容但未啟用（T02）、僅單一 block（T04）

## M3 — Renderers

- [ ] `render/escaping.ts`：三平台引號策略
- [ ] `render/pubmed.ts`：`[tiab]`、`[MeSH Terms]`／`[MeSH Terms:noexp]`、PubMed URL（T22）
- [ ] `render/embaseCom.ts`：`:ti,ab,kw`、`/exp`／`/de`；MeSH 不輸出並給 warning；MeSH-only block → blocking error（T12、T13、T14）
- [ ] `render/ovidMedline.ts`：`.ti,ab,kf.`（per-term）、`exp X/`／`X/`；Emtree 不輸出
- [ ] 各平台固定 warning（結構轉譯非等價、欄位涵蓋近似、Emtree 需驗證）
- [ ] `tests/golden/*.json`：§5 golden example + heading、truncation、C/O 啟用案例
- [ ] `tests/renderers.test.ts`、`tests/validation.test.ts`：T01–T16、T18、T19、T22、T25

## M4 — 匯出

- [ ] `export/txt.ts`：三組 query、warnings、disclaimer、產生日期、來源連結；UTF-8（T21）
- [ ] 時間戳以參數注入，確保 T25 可重現

## M5 — UI（D3–D5、D9 定案後）

- [ ] P/I/C/O 四面板：一行一 term、include 開關（預設 P+I ON）、未納入提示
- [ ] Advanced 面板：MeSH／Emtree 分開輸入、explode 開關、「我已確認」勾選、MeSH Browser／Embase help 連結
- [ ] 三平台輸出卡：平台全名標示（`Embase.com (Elsevier)，非 Ovid Embase`）、Copy、per-platform warnings、live 驗證狀態標章
- [ ] Copy（僅 query）+ fallback、Copy all、TXT 下載、Reset、內建範例（T20）
- [ ] inline validation 訊息、勿輸入病患識別資訊提醒、§7 guardrail 文案
- [ ] 使用者輸入只經 JSX 文字節點渲染，無 `dangerouslySetInnerHTML`（T17）
- [ ] mobile-first；長 query 只在 code panel 內捲動
- [ ] `tests/ui.test.ts`：T17、T20、T24

## M6 — CI／部署／文件

- [ ] 建立 GitHub public repo 並 push（**執行前先向使用者確認**）
- [ ] `.github/workflows/ci.yml`：`npm ci → typecheck → test → build`，PR 與 main push
- [ ] 部署 workflow（依 D7），checks 通過才部署；Vite `base` 設定
- [ ] T23：build 產物外部請求靜態檢查
- [ ] `README.md`：支援／不支援語法、來源連結、驗證限制（§10）
- [ ] LICENSE

## M7 — Live 驗證與發布（依 D8）

- [ ] PubMed：貼上 golden + heading + truncation 案例，記錄日期、query、Search Details、錯誤
- [ ] Embase.com：同上
- [ ] Ovid MEDLINE：同上（含資料庫版本區段）
- [ ] 驗證紀錄寫入 `docs/live-validation.md`；未驗證的 target 標「Not live-validated」
- [ ] 手動檢核：斷網後產生／複製／匯出（T23）、screen reader 朗讀（T24）
- [ ] §10 Definition of Done 逐項核對
- [ ] `/codex-review` 獨立覆審

## Backlog（Phase 2+，本期不做）

- 受限 PubMed query parser、MeSH lookup（NLM API）、proximity 轉譯、Ovid history 格式
- MeSH→Emtree 建議流程、Ovid Embase／Cochrane／Scopus、PRISMA-S 文件產生
