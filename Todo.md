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
- [x] **D8 live 驗證資源** — 2026-11-13 定案：使用者有 Embase.com 與 Ovid MEDLINE 權限，三個 target 皆由使用者執行貼上測試
  - M3 完成後產出固定測試包（約 5–6 條 × 3 平台）；結果記入 `docs/live-validation.md`
  - 驗證完成前 UI 仍顯示「Not live-validated」，逐 target 通過後才移除
- [x] **D9 Generate 行為** — 2026-11-13 定案：採建議
  - live preview（debounce 約 300 ms）為主；Generate 按鈕保留，立即驗證並移動焦點至輸出區或第一個錯誤
  - 輸入有錯時**不保留舊輸出**：輸出卡顯示錯誤狀態，Copy／匯出停用

### 已自行定案的小缺口（實作時照此處理，不另詢問）

- `Result.query` 型別改為 `string | null`：§4.3 要求單一 target blocking error 時不得輸出 query，§3.3 型別未涵蓋
- 去重保留**首次出現**的大小寫；`heart failure` 與 `"heart failure"` 視為同一 term
- Heading 欄位（MeSH/Emtree）字元規則獨立於 free text：允許逗號、連字號（`Diabetes Mellitus, Type 2`），其餘比照 D1
- PubMed 連結：`encodeURIComponent` 後 URL 過長（暫定 > 2,000 字元）時停用連結並提示改用複製貼上
- 上限（30 terms／200 字元／10,000 字元）集中於單一 config 常數

## M1 — 專案鷹架

- [x] Vite + React + TypeScript（strict）+ Vitest 初始化；`npm run typecheck / test / build`
- [x] 目錄結構依 §3.1；`src/model/types.ts`（輸入 model、AST、Message、ValidationIssue、Result）
- [x] `src/config.ts`：順序、平台標籤、輸入上限、live 驗證旗標（message code 常數延至 M2 隨 validate 一起定義）
- [x] `.gitattributes` 統一 LF

## M2 — Core（純函式，先寫測試）

- [x] `core/codes.ts`：訊息代碼常數
- [x] `core/normalize.ts`：Unicode 空白、CRLF、curly quotes、零寬字元、破折號→連字號（T18）
- [x] `core/validate.ts`（`parseFreeText`、`parseHeading`）
  - [x] 字元白名單（依 D1）、長度上限（T19）
  - [x] wildcard：僅結尾 `*` 且前方 ≥4 個純字母（T07、T08、T09）
  - [x] 拒絕 Boolean／括號／field tag／proximity／`?` `$` `#`（T11、T15、T16；D2）
  - [x] 每個錯誤訊息含修正建議，不靜默丟棄 term
- [x] `core/buildAst.ts`：block 內去重（T06）、P→I→C→O 固定順序、筆數上限（T19）、空 block／無啟用 block（T05）
- [x] 通知：C/O 有內容但未啟用（T02）、僅單一 block（T04）、納入 C/O 的敏感度提醒、重複項合併
- [x] `tests/validation.test.ts`、`tests/buildAst.test.ts`（105 個測試）

### M2 留給 M3 的事項（皆已於 M3 處理）

- Ovid：heading 或片語含保留字時加引號輸出 — 已實作，保留字清單為假設，待 B3 驗證
- 最終 query 長度上限（10,000）在 renderer 層檢查 — 已實作

## M3 — Renderers

- [x] `render/escaping.ts`：三平台引號策略 + 未驗證值的最後防線（拋錯）
- [x] `render/shared.ts`：共用 Boolean 組裝、heading 缺口警告、query 長度上限
- [x] `render/pubmed.ts`：`[tiab]`、`[MeSH Terms]`／`[MeSH Terms:noexp]`、PubMed URL（T22）
- [x] `render/embaseCom.ts`：`:ti,ab,kw`、`/exp`／`/de`；MeSH 不輸出並給 warning；MeSH-only block → blocking error（T12、T13、T14）
- [x] `render/ovidMedline.ts`：`.ti,ab,kf.`（per-term）、`exp X/`／`X/`；Emtree 不輸出；保留字加引號
- [x] `core/generate.ts`：完整 pipeline 入口
- [x] 各平台固定提示（結構轉譯、Not live-validated、truncation、PubMed 不觸發 ATM、Ovid MeSH 確認）
- [x] `tests/golden/*.json`：§5 golden、四概念 + truncation + 連字號、heading、MeSH-only
- [x] `tests/renderers.test.ts`（29 個測試）：T01、T03、T12–T14、T22、T25
- [x] `docs/live-validation.md`：live 測試包（A 組 11 條 + B 組探測 11 條），**待使用者執行**

## M4 — 匯出

- [x] `export/txt.ts`：輸入內容、三組 query、warnings、驗證狀態、disclaimer、產生時間、來源連結（T21）
- [x] 時間戳以參數注入，確保 T25 可重現；下載時加 UTF-8 BOM
- [x] `tests/export.test.ts`（10 個測試）

## M5 — UI（D3–D5、D9 定案後）

- [x] P/I/C/O 四面板：一行一 term、include 開關（預設 P+I ON）、未納入提示
- [x] Advanced 面板：MeSH／Emtree 分開輸入、explode 開關、「我已查證」勾選、MeSH Browser／Embase help 連結
- [x] 三平台輸出：平台全名與介面說明、Copy、per-platform warnings、「尚未實機驗證」標章
- [x] 輸出分色顯示（`QueryView`）：詞依 P/I/C/O 分色、平台語法灰底；DOM 文字與 query 逐字相同
- [x] Copy（僅 query）+ execCommand fallback、Copy all、TXT 下載、清空、載入範例（T20）
- [x] live preview（debounce）+ 產生查詢按鈕焦點管理；輸入有錯或更新中時不顯示舊輸出並停用 Copy／匯出（D9）
- [x] inline validation 訊息（含行號）、勿輸入病患識別資訊提醒、§7 guardrail 文案、貼上後的查核步驟
- [x] 使用者輸入只經 JSX 文字節點渲染，無 `dangerouslySetInnerHTML`（T17）
- [x] mobile-first CSS；長 query 只在 code panel 內換行／捲動
- [x] 字型：IBM Plex Mono（latin 400／600，self-host，OFL-1.1）；中文用系統字型
- [x] `tests/ui.test.tsx`（22 個測試）：T02、T03、T12、T14、T17、T20、T21、T24
- [x] 真實 Chrome 檢查（production build）：query 正確、字型載入、雙欄版面、無橫向溢出、無 console error、只有同源請求
- [x] 目視檢查：使用者於 2026-11-13 確認通過（Claude 端截圖工具逾時，僅以 JS 量測版面）
- [ ] 手機寬度實測（使用者回覆未提及，列入 M7 手動檢核）

## M6 — CI／部署／文件

- [x] `.github/workflows/ci.yml`：`npm ci → typecheck → test → build → check:offline`，PR 與 main push；main 通過後部署 GitHub Pages
- [x] T23：`scripts/check-offline.mjs` 靜態檢查 build 產物（無外部資源、無網路 API、外部主機白名單）；已關閉 Vite modulepreload polyfill 以移除 bundle 內唯一的 fetch
- [x] `README.md`：支援／不支援語法、驗證狀態、測試限制、來源連結
- [x] `LICENSE`（MIT）
- [x] 建立 GitHub public repo 並 push（使用者 2026-11-13 確認後執行）
- [x] repo 設定：Pages source 設為 GitHub Actions
- [x] CI 首次執行通過（check + deploy）；線上頁面與 JS／CSS 皆回 200
- [x] README 補上線上網址
- [ ] 線上版在真實瀏覽器開啟並操作一次（目前只以 HTTP 200 確認，列入 M7）

## M7 — Live 驗證與發布（依 D8）

- [x] 產出 live 測試包 `docs/live-validation.md`（2026-11-13）
- [ ] **使用者**：PubMed 貼上 A 組 + B5，填寫紀錄
- [ ] **使用者**：Embase.com 貼上 A 組 + B1（apostrophe）、B2（連字號），填寫紀錄
- [ ] **使用者**：Ovid MEDLINE 貼上 A 組 + B3（保留字）、B4（逗號 heading），填寫紀錄（含資料庫區段名稱）
- [ ] 依紀錄修正 renderer／驗證規則；通過的平台將 `LIVE_VALIDATED` 改為 `true`
- [ ] 手動檢核：斷網後產生／複製／匯出（T23）、screen reader 朗讀（T24）
- [ ] §10 Definition of Done 逐項核對
- [ ] `/codex-review` 獨立覆審

## Backlog（Phase 2+，本期不做）

- 受限 PubMed query parser、MeSH lookup（NLM API）、proximity 轉譯、Ovid history 格式
- MeSH→Emtree 建議流程、Ovid Embase／Cochrane／Scopus、PRISMA-S 文件產生
