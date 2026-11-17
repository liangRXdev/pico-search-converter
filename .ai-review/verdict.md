# Codex 覆審判定

- 日期：2026-11-17｜Commit：36a61eb｜原始意見：`codex-review.md`
- 統計：**接受 7／部分接受 3／拒絕 0**
- 每項皆回原始碼該行驗證；未發現幻覺（引用的檔案、函式、行號都存在且內容相符）。

| # | 項目 | 嚴重度 | 判定 | 理由 |
|---|------|--------|------|------|
| C1 | Ovid 保留字分支吃掉截字 `*` | High | **接受** | `src/render/ovidMedline.ts:38` 在 `hasReservedWord` 成立時直接回傳 `doubleQuoted(term.value)`，`:39` 的 `trailingTruncation` 永遠到不了。`validate` 允許 ≥4 字母詞幹加 `*`，所以 `from*`／`same*`／`with*`／`freq*` 能通過驗證並被輸出成完整詞 → 檢索範圍靜默縮小。live 測試 B3 證實 Ovid 對未加引號的保留字**不報錯、只是搜不到**，加引號詞幹加 `*` 的寫法未驗證。修法：保留字 × 截字對 Ovid target 回 blocking error（其他平台照常），不要猜語法。 |
| C2 | heading 改名後沿用舊的「已查證」 | High | **接受** | `src/ui/HeadingList.tsx:46` 的 `update(row.key, { term })` 只改名稱，`confirmed` 原樣保留（`:17` 為淺合併）。違反 Progress 決策「未勾選已確認的 heading 為 blocking error」的目的。修法：`term` 變更時一併設 `confirmed: false`（MeSH、Emtree 共用此元件，一處修好）。 |
| C3 | 新 query 顯示舊 query 的「已複製」 | Medium | **接受** | `src/ui/OutputCard.tsx:40` 的 `copied` 是布林，只靠 2 秒計時器清除，與 query 無關；`:87` 依此顯示「已複製」。修法：改存「已複製的 query 字串」，顯示條件為 `copiedQuery === query`；非同步完成時若 query 已變則不設定。 |
| C4 | heading 錯誤時 Generate 焦點落在 free-text | Medium | **接受** | `src/ui/App.tsx:28` 的 `firstErrorConcept` 只取 `concept`；`ValidationIssue` 已有 `field`／`index`（`src/model/types.ts:95-97`）。狀態訊息「已移到第一個問題」與實際不符。heading 有錯時 `<details>` 必為展開（`src/ui/ConceptPanel.tsx:99` 的 `hasHeadings`），定位到 heading input 不需另外展開。 |
| C5 | query 組裝在 `joinGroups` 與 `QueryView` 各寫一遍 | Low | **部分接受** | 重複屬實（`src/render/shared.ts:133`、`src/ui/QueryView.tsx:39-60`）。但 `tests/ui.test.tsx:28-29,48` 已用 DOM `textContent` 比對 golden，漂移會被抓到，風險低於描述。不建議重構成 token 序列；改為在 UI 測試加一條 `textContent === result.query`（任意輸入，不只 golden）即可。 |
| T1 | 離線檢查可被 `new Image().src = 允許主機` 繞過 | Medium | **部分接受** | 屬實：`scripts/check-offline.mjs:69-77` 只比對 API 字串與主機白名單，白名單含 `pubmed.ncbi.nlm.nih.gov`（`:14`）。但目前 app 無此類程式碼，且 D6 本就宣告 T23 為「靜態檢查 + 手動斷網」。修法收斂為：成功訊息改成只宣稱實際檢查的性質；補 `.src=`、`import(` 等樣式與 1–2 個負向 fixture。不做完整 AST 分析。 |
| T2 | App 測試全用 `debounceMs={0}`，D9 等待期間未測 | Medium | **接受** | `tests/ui.test.tsx:20` 唯一的 render 呼叫固定為 0；沒有 fake timers。D9「更新中時停用 Copy／不顯示舊輸出」只靠實作，沒有測試防線。 |
| T3 | live 驗證包一致性測試只檢查字串存在 | Medium | **部分接受** | 屬實：`tests/renderers.test.ts:66-71` 用 `toContain` 搜整份 Markdown，平台標題錯置不會失敗。但本次使用者已逐條貼上，人工對照標題與 query 正確；嚴重度降為 Low。修法照建議：依「案例 × 平台」區段比對。 |
| T4 | clipboard fallback 成功路徑未測 | Low | **接受** | `tests/ui.test.tsx:90` 只測 `execCommand` 回傳 false。 |
| D1 | engines `>=22` 寬於 jsdom 需求 | Low | **接受** | `package.json` engines `>=22`、`README.md:71`「Node.js 22 以上」，lock 中 jsdom 要求 `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`（`package-lock.json:1384`）。對齊即可。 |

## 與 live 驗證的交互影響

- **C1 必須在 Ovid 標為 live-validated 前修掉**：A 組沒有涵蓋「保留字 × 截字」，A 組通過不代表此路徑正確。
- C2 不影響 live 驗證結論（是 UI 狀態問題，不是語法問題），但會讓「未查證的 heading」繞過防線，同樣列必修。
