# PICO 檢索語法轉換器

輸入 PICO 關鍵字，同時得到三個資料庫介面的檢索語法：

- **PubMed**（NLM 介面）
- **Embase.com**（Elsevier 介面；**不是** Ovid Embase）
- **Ovid MEDLINE**（Wolters Kluwer／Ovid 介面）

**線上使用：<https://liangrxdev.github.io/pico-search-converter/>**

純前端工具，免安裝、免登入。所有運算都在瀏覽器內完成，不會上傳任何輸入內容。

可加到手機或電腦的主畫面（PWA）。開啟過一次後，離線也能使用；有網路時一律載入最新版，語法規則修正後立即生效。

> **這是語法轉譯工具，不是檢索策略產生器。** 三組輸出的括號與 Boolean 結構相同，但各平台的欄位涵蓋範圍只是近似、收錄內容不同，MeSH 與 Emtree 也不是一對一對應，命中筆數不會相同。輸出不代表系統性文獻回顧等級的完整檢索。

## 驗證狀態

| 平台 | 輸出格式是否已在實際資料庫貼上執行驗證 |
|---|---|
| PubMed | 已驗證（2026-11-17） |
| Embase.com (Elsevier) | 已驗證（2026-11-17） |
| Ovid MEDLINE | 已驗證（2026-11-17） |

驗證紀錄在 [`docs/live-validation.md`](docs/live-validation.md)：四組 golden 查詢在三個平台皆無語法錯誤，平台的解析結果與預期結構一致。驗證涵蓋的是這些語法形態（片語、截字、連字號、引號內含 and、explode／non-explode heading、含逗號的 heading），不代表任意輸入在任何資料庫版本都已驗證。

實測後確定的規則：

- 撇號（如 `Crohn's`）維持拒絕：Embase.com 以雙引號包覆會出現語法錯誤。
- Ovid 中 `and`、`use` 等保留字必須加引號；未加引號時 Ovid 不一定報錯，可能直接搜不到。
- Ovid 遇到「保留字加截字」（如 `freq*`、`with*`）時不產生查詢：加引號會失去截字、不加引號會被當成運算子，安全寫法尚未驗證。其他平台照常輸出。

## 語法對照

| 元素 | PubMed | Embase.com | Ovid MEDLINE |
|---|---|---|---|
| 單一詞 | `term[tiab]` | `term:ti,ab,kw` | `term.ti,ab,kf.` |
| 片語 | `"heart failure"[tiab]` | `'heart failure':ti,ab,kw` | `"heart failure".ti,ab,kf.` |
| 詞尾截字 | `diabet*[tiab]` | `diabet*:ti,ab,kw` | `diabet*.ti,ab,kf.` |
| heading（含下位詞） | `"Hypertension"[MeSH Terms]` | `'hypertension'/exp` | `exp Hypertension/` |
| heading（不含下位詞） | `"Hypertension"[MeSH Terms:noexp]` | `'hypertension'/de` | `Hypertension/` |

同一個概念內的詞以 `OR` 連接，概念之間以 `AND` 連接，每個概念都加括號。順序固定為 P → I → C → O；預設只納入 P 與 I。

## 支援的輸入

- 英文單一詞、片語（含空白即視為片語，引號可加可不加）
- 含連字號的詞（如 `beta-blocker`、`COVID-19`），會加引號輸出
- 詞尾 `*` 截字：只能用在單一純字母詞，且 `*` 前至少 4 個字母
- 含 `and`／`or`／`not` 的片語：**必須自己加引號**（如 `"signs and symptoms"`）
- 自行查證過的 MeSH 與 Emtree heading，兩者分開輸入，並勾選「我已查證」

## 不支援的輸入

以下輸入會被拒絕並說明如何修正，不會被靜默修改或丟棄：

- 撇號（`Crohn's disease` → 請改 `Crohn disease`）與非 ASCII 字母（`Sjögren` → `Sjogren`）
- 欄位代碼（`[tiab]`、`:ti`、`.mp.`）、括號、未加引號的 `AND`／`OR`／`NOT`
- 詞首、詞中的 `*`，以及 `?`、`$`、`#`
- proximity（`[tiab:~N]`、`NEAR/n`、`adjN`）：各平台的距離定義不同，無法直接換算
- 貼上整串既有的檢索式、日期與語言限制、檢索歷程行號

工具不會做的事：

- **不會把 MeSH 自動轉成 Emtree**，反之亦然。某個概念只有 MeSH、沒有關鍵字時，Embase.com 不會輸出查詢。
- 不會自動補同義詞、不會推測 PICO、不會呼叫任何 AI 或外部服務。
- 不重現 PubMed 的 Automatic Term Mapping：所有關鍵字都加了明確的欄位標籤。
- heading 欄位的內容是你輸入的文字；工具不檢查它是否真的存在於詞彙庫。

## 貼到資料庫之後

1. 執行查詢，確認沒有語法錯誤。
2. 看 search details 或檢索歷程，確認每個詞與 heading 被解析成你要的意思。
3. 拿幾篇已知相關的文獻核對，確認查得到。
4. 記下檢索日期、資料庫、平台與完整的查詢字串。

## 開發

需要 Node.js 22.22.2 以上的 22.x、24.15.0 以上的 24.x，或 26 以上（與測試依賴 jsdom 的需求一致；CI 使用 Node 24）。

```bash
npm ci
npm run dev            # 本機開發
npm run typecheck
npm test
npm run build
npm run check:offline  # 靜態檢查 build 產物的外部資源與網路 API（需先 build）
node scripts/gen-icons.mjs  # 重新產生 PWA 圖示（需本機 Chrome；產物已進版控）
```

PWA：`scripts/sw-plugin.mjs` 在 build 時依實際產物產生 `dist/sw.js`（預先快取清單與以內容雜湊命名的快取版本），不使用 workbox。網頁本體網路優先、靜態資源快取優先；清舊快取時只刪 `pico-search-converter-` 前綴，不影響同網域其他工具。

架構：`UI → normalize + validate → AST → 各平台 emitter`。`src/core` 與 `src/render` 是不依賴 React 的純函式；`tests/golden/*.json` 是固定的輸入與預期輸出。

### 測試涵蓋範圍與限制

規格（`spec.md` §6.1）的 T01–T25 中，以下兩項不是真實瀏覽器的自動化測試：

- **T23（離線可用）**：以 `npm run check:offline` 靜態檢查 build 產物——HTML／CSS 只載入同源資源；JS 不含 `fetch`、`XMLHttpRequest`、`new Image`、動態 `import()` 等已知網路 API 字串，外部網址只能是允許清單內的導覽連結，不能出現在 `src`／`href` 等資源載入寫法中；唯一例外是 Service Worker：主程式只能註冊同源 `sw.js`，`sw.js` 的 `fetch` 必須在同源守衛之後且不得含外部網址（規則與反例測試見 `scripts/offline-rules.mjs`、`tests/check-offline.test.ts`）。這是字串樣式比對，無法證明執行期沒有網路請求；真實瀏覽器的斷網操作需手動執行。
- **T24（鍵盤與螢幕閱讀器）**：自動化測試涵蓋控制項的可辨識名稱、原生語意元素、Tab 可達與鍵盤觸發；螢幕閱讀器的實際朗讀需手動檢查。

自動化測試驗證的是「本工具是否依規則產生字串」，不是各資料庫是否接受這些字串，後者見上方的驗證狀態。

## 語法查證來源

查證日期：2026-11-13。

- [NLM PubMed User Guide](https://pubmed.ncbi.nlm.nih.gov/help/)
- [NLM MeSH Browser](https://meshb.nlm.nih.gov/)
- [Elsevier Embase：field codes](https://www.elsevier.support/embase/answer/what-field-codes-can-i-use-in-embase)
- [Elsevier Embase：Boolean、wildcards、proximity](https://www.elsevier.support/embase/answer/can-i-use-boolean-operators-wildcards-and-proximity-operators-in-embase)
- [Elsevier Embase：how to search](https://www.elsevier.support/embase/answer/how-do-i-search-in-embase)
- [Ovid Quick Reference Card](https://tools.ovid.com/ovidtools/pdf/OvidQRC.pdf)
- [NCBI Bookshelf：Ovid syntax guide](https://www.ncbi.nlm.nih.gov/books/NBK601822/table/t11/?report=objectonly)
- [Cochrane Handbook, Chapter 4](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04)

廠商介面的語法可能改版；若輸出在資料庫中出現語法錯誤，請以各平台的官方說明為準。

## 授權

程式碼以 [MIT License](LICENSE) 釋出。內含的 IBM Plex Mono 字型以 SIL Open Font License 1.1 授權。
