# Codex 獨立覆審原始輸出

- 審查日期：2026-11-17
- Codex 版本：codex-cli 0.164.0（plugin openai-codex 1.0.6，task read-only）
- 審查範圍：整個 repository
- Commit：36a61eb（審查期間 docs/live-validation.md 有未 commit 的使用者填寫紀錄）
- Codex job：task-mwkbipew-cx1mph

---

結論：發現 **2 項 High**，其中一項會確定性地縮小 Ovid 檢索範圍；另有複製狀態誤導、錯誤焦點不正確及離線檢查假綠燈。未發現 Critical，也未將嚴格白名單、Phase 1 範圍或尚未 live 驗證當成缺陷。

本次未寫入或修改檔案。驗證範圍：

- `tsc --noEmit` 通過。
- 直接於記憶體執行 pipeline，四份 golden 的三平台輸出均符合固定期望值。
- 以 jsdom／RTL 直接重現下列 heading、焦點及複製狀態問題。
- 既有 `dist` 通過離線檢查，但該檢查可被反例繞過。
- Vitest 即使停用 cache，仍因建立暫存目錄遭唯讀環境拒絕；**本次未能重新確認 166 項測試通過**，此限制不列為產品缺陷。
- 覆審期間觀察到 `docs/live-validation.md` 被外部填入部分紀錄；沒有把這些新增紀錄推論為三平台驗證完成。

## 1. Code review

**C1｜High｜Ovid 保留字處理會靜默刪除合法截字**

- **位置：** [src/render/ovidMedline.ts:38](C:/Users/liang/projects/pico-search-converter/src/render/ovidMedline.ts:38)
- **問題：** 保留字分支先回傳加引號的 `term.value`，尚未附上 `trailingTruncation` 的 `*`。已重現：
  
  | 輸入 | PubMed | Ovid MEDLINE |
  |---|---|---|
  | `freq*` | `(freq*[tiab])` | `("freq".ti,ab,kf.)` |
  | `with*` | `(with*[tiab])` | `("with".ti,ab,kf.)` |
  
  `from*`、`same*` 亦同。這會把截字搜尋改成完整詞搜尋，造成 false negative；結果仍顯示截字差異提示，沒有揭露截字已被刪除。
- **建議修法：** 將截字與保留字處理分開，禁止任何成功分支遺失截字旗標。若目前無法保證保留字詞幹加 `*` 的 Ovid 安全語法，應對該 target 明確 blocking，保留其他平台輸出，待 live 確認後再開放。

**C2｜High｜修改 heading 後沿用舊的查證確認**

- **位置：** [src/ui/HeadingList.tsx:17](C:/Users/liang/projects/pico-search-converter/src/ui/HeadingList.tsx:17)、[src/ui/HeadingList.tsx:46](C:/Users/liang/projects/pico-search-converter/src/ui/HeadingList.tsx:46)
- **問題：** 修改 `term` 時只更新名稱，保留 `confirmed: true`。已重現「輸入 Hypertension → 勾選查證 → 改成 Invented Heading」，新名稱直接輸出為 `"Invented Heading"[MeSH Terms]`，且沒有未確認錯誤。使用者確認的是舊名稱，上游卻把新名稱送成 `user_confirmed`。
- **建議修法：** heading 名稱變更時撤銷確認，要求重新勾選；或將確認綁定至經正規化後的確切名稱。MeSH、Emtree 都應適用。

**C3｜Medium｜新 query 仍顯示舊 query 的「已複製」狀態**

- **位置：** [src/ui/OutputCard.tsx:40](C:/Users/liang/projects/pico-search-converter/src/ui/OutputCard.tsx:40)、[src/ui/OutputCard.tsx:48](C:/Users/liang/projects/pico-search-converter/src/ui/OutputCard.tsx:48)、[src/ui/OutputCard.tsx:87](C:/Users/liang/projects/pico-search-converter/src/ui/OutputCard.tsx:87)
- **問題：** `copied` 只在計時器結束時清除，與 query 身分無關。已重現「複製 hypertension 範例 → 兩秒內改成 asthma」：畫面已顯示 asthma，新按鈕仍顯示「已複製」，但 clipboard 沒有 asthma。延遲完成的舊 clipboard Promise 也可能在輸入變更後回報成功。
- **建議修法：** 記錄實際複製成功的 query；僅當它與目前 query 相同才顯示成功。query 或輸出狀態變更時撤銷回饋，並忽略過期的非同步完成通知。

**C4｜Medium｜heading 錯誤的 Generate 焦點落在 free-text**

- **位置：** [src/ui/App.tsx:28](C:/Users/liang/projects/pico-search-converter/src/ui/App.tsx:28)、[src/ui/App.tsx:62](C:/Users/liang/projects/pico-search-converter/src/ui/App.tsx:62)
- **問題：** 第一個錯誤只保留 `concept`，忽略已有的 `field`、`index`。已重現 P 的 MeSH 輸入 `Invalid/Heading` 後按 Generate，焦點移到 `terms-P`，沒有移到錯誤 heading，狀態卻宣告「已移到第一個問題」。
- **建議修法：** 保留完整 `ValidationIssue`，依 `concept + field + index` 定位實際控制項；必要時先展開進階區域。

**重複實作：C5｜Low｜query 組裝規則在 renderer 與 UI 各寫一遍**

- **兩端位置：** [src/render/shared.ts:133](C:/Users/liang/projects/pico-search-converter/src/render/shared.ts:133)、[src/ui/QueryView.tsx:39](C:/Users/liang/projects/pico-search-converter/src/ui/QueryView.tsx:39)
- **問題：** `joinGroups()` 組裝可複製字串；`QueryView` 另外組裝相同的括號、` OR `、` AND `。目前 golden 相符，這不是現存輸出錯誤；但任一端改變括號或分隔規則，畫面文字與實際 Copy／TXT 就會漂移。
- **建議修法：** 共用純函式產生的結構化 token 序列，分別供字串串接與 JSX 呈現。保留既有 core／render 與 React 分離的架構。
- 此項不包含刻意的 renderer 最後防線，也不把三平台各自的欄位語法視為重複缺陷。

## 2. Test gap analysis

既有測試已涵蓋主要正常流程、非法字元、截字、去重、heading ontology 隔離、target blocking、URL 編碼及 TXT。**四份 golden 是固定字串，未發現由受測程式即時計算 golden 期望值的情形。**

**T1｜Medium｜離線檢查把「主機允許」誤當成「用途安全」**

- **位置：** [scripts/check-offline.mjs:69](C:/Users/liang/projects/pico-search-converter/scripts/check-offline.mjs:69)、[scripts/check-offline.mjs:73](C:/Users/liang/projects/pico-search-converter/scripts/check-offline.mjs:73)
- **問題：** JS 只搜尋部分 API 字串及 URL 主機，沒有辨識 URL 是否只用於主動連結。記憶體內替換待檢產物後，以下反例仍得到「無外部資源載入、無網路 API」：
  
  ```js
  const image = new Image();
  image.src = "https://pubmed.ncbi.nlm.nih.gov/?term=private";
  ```
  
  這不是目前 app 已傳輸輸入的證據，而是 CI 防線的確定假綠燈。
- **建議修法：** 加入此類負向 fixture，區分導覽連結與資源載入；涵蓋 DOM 資源指派、動態 import、間接呼叫等路徑。靜態檢查只能宣告實際檢查的性質，仍保留 D6 的手動斷網驗證。

**T2｜Medium｜全部 App 測試將 debounce 設為 0，未驗證 D9 的等待期間**

- **位置：** [tests/ui.test.tsx:20](C:/Users/liang/projects/pico-search-converter/tests/ui.test.tsx:20)、[tests/ui.test.tsx:149](C:/Users/liang/projects/pico-search-converter/tests/ui.test.tsx:149)
- **問題：** 測試只檢查 settle 後錯誤狀態。即使程式在 production 的 300 ms 等待期間保留舊輸出並允許 Copy，這些案例仍可能通過。
- **建議修法：** 使用非零 debounce 與 fake timers，分別斷言修改當下、299 ms、完成更新後的 query、Copy、TXT、PubMed link 狀態；加入連續兩次修改，確認舊 timer 不會還原舊輸出。

**T3｜Medium｜live pack 一致性只檢查字串存在，沒有驗證對應關係**

- **位置：** [tests/renderers.test.ts:66](C:/Users/liang/projects/pico-search-converter/tests/renderers.test.ts:66)
- **問題：** `toContain()` 搜尋整份 Markdown。交換 PubMed／Embase 的平台標題，或把 query 移到錯誤案例，所有期望字串仍存在，測試照樣通過；因此不能證明註解宣稱的「送驗的就是測試比對的字串」。
- **建議修法：** 依「fixture ID × platform」比對完整 query，並拒絕缺漏、錯置及重複對應。這只需處理專案自己的測試包結構，不涉及新增 query parser 功能。

**T4｜Low｜clipboard fallback 沒有成功路徑與內容驗證**

- **位置：** [tests/ui.test.tsx:76](C:/Users/liang/projects/pico-search-converter/tests/ui.test.tsx:76)、[tests/ui.test.tsx:87](C:/Users/liang/projects/pico-search-converter/tests/ui.test.tsx:87)
- **問題：** 成功案例走 Clipboard API；fallback 只測 `execCommand` 回傳 false。若 fallback 回傳 true 卻選到錯誤文字，測試不會發現。
- **建議修法：** 測試 API 不存在及拒絕後 fallback 成功兩種情境；於 `execCommand` 呼叫時驗證暫存 textarea 的內容與選取狀態，並確認清理及成功通知。

此外，應補入 C1 的「保留字 × 截字」、C2 的「確認後改名」、C3 的「複製後改輸入／延遲完成」、C4 的「heading 錯誤焦點」。現有保留字測試僅涵蓋 `use`／`usage`，heading UI 測試也未涵蓋確認後修改。

## 3. Dependency audit

**D1｜Low｜宣告支援的 Node 範圍寬於實際依賴需求**

- **位置：** [package.json:35](C:/Users/liang/projects/pico-search-converter/package.json:35)、[package-lock.json:1384](C:/Users/liang/projects/pico-search-converter/package-lock.json:1384)、[README.md:71](C:/Users/liang/projects/pico-search-converter/README.md:71)
- **問題：** 專案宣告 `>=22`，README 寫 Node 22 以上；但鎖定的 jsdom 31.0.1 要求 `^22.22.2 || ^24.15.0 || >=26.0.0`。Node 22.0 或 24.0 雖符合專案宣告，卻不符合測試依賴需求。
- **建議修法：** 將 engines／README 對齊實際支援範圍；CI 可繼續使用 Node 24，並明確選定最低支援版本。

其他結果與限制：

- React 19.3.1、TypeScript 7.0.2、Vitest 5.1.0 已與官方 registry 的 latest 核對相符，未據此提出升級需求。[React](https://registry.npmjs.org/react/latest)、[TypeScript](https://registry.npmjs.org/typescript/latest)、[Vitest](https://registry.npmjs.org/vitest/latest)
- Vite 8.3.8 不在近期 `GHSA-p4f5-76q4-ffq7` 的受影響範圍，該公告於 8.3.7 修復；不能把這項 Critical 公告直接套到本 repo。[官方公告](https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7)
- 未發現明確不必要的直接依賴。lock 中 IBM Plex Mono 的 OFL-1.1、開發工具 lightningcss 的 MPL-2.0，不因與專案 MIT 不同就構成授權衝突。
- bulk advisory 查詢受網路限制失敗，因此**不能宣稱整份 lock 零已知漏洞**；其餘依賴也不宣稱已完成全部 latest 比對。這是稽核限制，不是假報零漏洞。

## 4. 規格符合度稽核

以下交叉引用前述發現，不重複計算風險。

| 條款／覆蓋決策 | 實作位置 | 嚴重度 | 未履行或做弱的承諾／建議修法 |
|---|---|---|---|
| spec §4.1、§4.4：合法詞尾截字須保留 | `src/render/ovidMedline.ts:38` | High | C1：合法 `freq*` 等成功輸出卻遺失 `*`。保留截字或明確 target blocking。 |
| spec §4.3；Progress 決策列 82：未確認 heading 為 blocking | `src/ui/HeadingList.tsx:46` | High | C2：新名稱沿用舊確認，實際未重新確認卻繞過阻擋。名稱變更須撤銷確認。 |
| spec §2.2：Copy 成功確認應反映實際操作；D9 的輸入／輸出一致性目的 | `src/ui/OutputCard.tsx:40`、`:51` | Medium | C3：新 query 繼承舊 query 的成功標示。將回饋綁定實際複製的 query。 |
| Todo M0 D9，行 31：移至輸出或第一個錯誤 | `src/ui/App.tsx:62` | Medium | C4：heading 錯誤只定位到概念的 free-text，訊息與行為不符。按完整 issue 定位。 |
| D6；Todo M6 行 106；README 行 88：靜態檢查無外部資源／網路 API | `scripts/check-offline.mjs:69`、`:73` | Medium | T1：只驗 API 字串與主機，未驗資源載入用途。補負向案例並縮限成功宣告。 |
| README 行 71：Node 22 以上可開發 | `package.json:35`、`package-lock.json:1384` | Low | D1：允許依賴不支援的版本。對齊 engines 與文件。 |

其餘重點核對：

- §5 golden、Boolean 分組、P→I→C→O 順序及 ontology 隔離，在已直接執行案例中符合。
- `PUBMED_LINK_DISABLED`、heading 缺口警告及 target blocking 均有可到達的產生路徑；未發現這些功能只有 UI 分支、上游永不產生的情況。
- README 已明確揭露 T23／T24 的間接與手動驗證限制，沒有把 jsdom 宣稱為真實瀏覽器驗證。
- `Progress.md:10` 的 166 項通過屬既有紀錄，本次因 EPERM 無法重新確認；沒有證據將它判成錯誤宣稱。
- §10 DoD 與 M7 仍列未完成，沒有把待完成項目偽稱為已完成。

## 前 5 項修正優先順序

1. **High — C1：** Ovid 靜默刪除 `*`，直接造成檢索範圍縮小。
2. **High — C2：** heading 改名後沿用確認，讓未重新查證的名稱直接輸出。
3. **Medium — C3：** 新 query 顯示舊 query 的「已複製」，可能誤用過期 clipboard。
4. **Medium — T1：** 離線檢查存在已重現的假綠燈，CI 宣告強於實際驗證。
5. **Medium — C4：** heading 錯誤焦點落錯欄位，且成功定位訊息不實。

Codex session ID: 01a1e837-9b53-7bd1-b2f4-4ee257d2c2d9
Resume in Codex: codex resume 01a1e837-9b53-7bd1-b2f4-4ee257d2c2d9
