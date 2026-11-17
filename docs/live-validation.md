# Live 驗證紀錄

> spec §6.2、§10：每個平台至少一次實際貼上執行的紀錄。
> 以下 query 由 `tests/golden/*.json` 的 expected 欄位逐字產生，與自動化測試比對的是同一份字串。
> 全部通過後，才可將 `src/config.ts` 的 `LIVE_VALIDATED` 對應平台改為 `true`。

## 執行方式

1. 逐條複製 code block 內的 query，貼到對應平台的進階／命令列搜尋框執行。
2. 在該條下方填寫紀錄。重點是**有無語法錯誤**與**平台實際怎麼解析**，命中筆數只供參考（三個平台本來就不會相同）。
3. 貼上的是教學用範例關鍵字，不含任何病患資料；紀錄中也不要填入病患資訊。

## 環境

- PubMed：執行日期＿2026/11/17＿＿＿
- Embase.com：執行日期＿2026/11/17＿，確認網址為 embase.com（不是 Ovid 平台上的 Embase）
- Ovid MEDLINE：執行日期＿2026/11/17＿，資料庫區段名稱（如 Ovid MEDLINE(R) ALL 1946 to ...）＿＿＿＿

## A. Golden fixtures

### A1. spec §5 golden example：P、I 各兩個詞，O 有內容但未納入

來源：`tests/golden/01-spec-section-5.json`

**PubMed**

```text
(hypertension[tiab] OR "high blood pressure"[tiab]) AND (exercise[tiab] OR "physical activity"[tiab])
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：27109
- 平台實際解析結果（Search Details／history 顯示）：("hypertension"[Title/Abstract] OR "high blood pressure"[Title/Abstract]) AND ("exercise"[Title/Abstract] OR "physical activity"[Title/Abstract])
- 備註：

**Embase.com (Elsevier)**

```text
(hypertension:ti,ab,kw OR 'high blood pressure':ti,ab,kw) AND (exercise:ti,ab,kw OR 'physical activity':ti,ab,kw)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：49703
- 平台實際解析結果（Search Details／history 顯示）：(hypertension:ti,ab,kw OR 'high blood pressure':ti,ab,kw) AND (exercise:ti,ab,kw OR 'physical activity':ti,ab,kw)
- 備註：

**Ovid MEDLINE**

```text
(hypertension.ti,ab,kf. OR "high blood pressure".ti,ab,kf.) AND (exercise.ti,ab,kf. OR "physical activity".ti,ab,kf.)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：27041
- 平台實際解析結果（Search Details／history 顯示）：((hypertension or "high blood pressure") and (exercise or "physical activity")).ti,ab,kf.
- 備註：

### A2. 四個概念全部納入：truncation、連字號片語、引號內含 and 的片語、單一詞的概念

來源：`tests/golden/02-all-blocks-truncation-hyphen.json`

**PubMed**

```text
(diabet*[tiab] OR "type 2 diabetes"[tiab]) AND ("SGLT-2 inhibitor"[tiab] OR empagliflozin[tiab]) AND (placebo[tiab]) AND (mortality[tiab] OR "morbidity and mortality"[tiab])
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：181
- 平台實際解析結果（Search Details／history 顯示）：("diabet*"[Title/Abstract] OR "type 2 diabetes"[Title/Abstract]) AND ("SGLT-2 inhibitor"[Title/Abstract] OR "empagliflozin"[Title/Abstract]) AND "placebo"[Title/Abstract] AND ("mortality"[Title/Abstract] OR "morbidity and mortality"[Title/Abstract])
- 備註：

**Embase.com (Elsevier)**

```text
(diabet*:ti,ab,kw OR 'type 2 diabetes':ti,ab,kw) AND ('SGLT-2 inhibitor':ti,ab,kw OR empagliflozin:ti,ab,kw) AND (placebo:ti,ab,kw) AND (mortality:ti,ab,kw OR 'morbidity and mortality':ti,ab,kw)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：441
- 平台實際解析結果（Search Details／history 顯示）：(diabet*:ti,ab,kw OR 'type 2 diabetes':ti,ab,kw) AND ('sglt-2 inhibitor':ti,ab,kw OR empagliflozin:ti,ab,kw) AND placebo:ti,ab,kw AND (mortality:ti,ab,kw OR 'morbidity and mortality':ti,ab,kw)
- 備註：

**Ovid MEDLINE**

```text
(diabet*.ti,ab,kf. OR "type 2 diabetes".ti,ab,kf.) AND ("SGLT-2 inhibitor".ti,ab,kf. OR empagliflozin.ti,ab,kf.) AND (placebo.ti,ab,kf.) AND (mortality.ti,ab,kf. OR "morbidity and mortality".ti,ab,kf.)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：180
- 平台實際解析結果（Search Details／history 顯示）：	
((diabet* or "type 2 diabetes") and ("SGLT-2 inhibitor" or empagliflozin) and placebo and (mortality or "morbidity and mortality")).ti,ab,kf.
- 備註：

### A3. 已確認的 MeSH 與 Emtree：explode 與 non-explode、含逗號的 heading、含 and 的 heading

來源：`tests/golden/03-verified-headings.json`

**PubMed**

```text
("Diabetes Mellitus, Type 2"[MeSH Terms] OR "type 2 diabetes"[tiab]) AND ("Wounds and Injuries"[MeSH Terms:noexp] OR wound*[tiab])
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：1924
- 平台實際解析結果（Search Details／history 顯示）：("diabetes mellitus, type 2"[MeSH Terms] OR "type 2 diabetes"[Title/Abstract]) AND ("Wounds and Injuries"[MeSH Terms:noexp] OR "wound*"[Title/Abstract])
- 備註：

**Embase.com (Elsevier)**

```text
('non insulin dependent diabetes mellitus'/exp OR 'type 2 diabetes':ti,ab,kw) AND ('injury'/de OR wound*:ti,ab,kw)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：5903
- 平台實際解析結果（Search Details／history 顯示）：('non insulin dependent diabetes mellitus'/exp OR 'type 2 diabetes':ti,ab,kw) AND ('injury'/de OR wound*:ti,ab,kw)
- 備註：

**Ovid MEDLINE**

```text
(exp Diabetes Mellitus, Type 2/ OR "type 2 diabetes".ti,ab,kf.) AND ("Wounds and Injuries"/ OR wound*.ti,ab,kf.)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：1915
- 平台實際解析結果（Search Details／history 顯示）：(exp Diabetes Mellitus, Type 2/ or "type 2 diabetes".ti,ab,kf.) and ("Wounds and Injuries"/ or wound*.ti,ab,kf.)
- 備註：

### A4. T14：P 只有 MeSH、沒有 free text → Embase.com 不輸出查詢，另外兩個平台照常

來源：`tests/golden/04-mesh-only-block.json`

**PubMed**

```text
("Hypertension"[MeSH Terms]) AND (exercise[tiab])
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：10760
- 平台實際解析結果（Search Details／history 顯示）："Hypertension"[MeSH Terms] AND "exercise"[Title/Abstract]
- 備註：

**Embase.com (Elsevier)**：此案例預期不輸出查詢（blocking error），無需貼上。

**Ovid MEDLINE**

```text
(exp Hypertension/) AND (exercise.ti,ab,kf.)
```

- 執行日期：2026/11/17
- 語法錯誤（有／無，原文）：無
- 命中筆數：10741
- 平台實際解析結果（Search Details／history 顯示）：exp Hypertension/ and exercise.ti,ab,kf.
- 備註：

## B. 探測題（決定未定案行為，不是工具目前的輸出）

這些 query 用來回答官方文件沒有記載的問題，結果會回頭影響驗證規則或 renderer。

### B1. Embase.com：片語內的撇號（D1 遺留）

工具目前拒絕含撇號的詞。若雙引號寫法可行，日後可放行。

```text
"crohn's disease":ti,ab,kw
```

```text
'crohn disease':ti,ab,kw
```

- 第一條有無語法錯誤：有, An unexpected character ' was found in:
<"crohn's disease":ti,ab,kw>
please check all brackets and quotes have been closed.
- 兩條的命中筆數： - / 9277
- 結論（撇號可否以雙引號包覆）： 否

### B2. Embase.com：連字號的斷詞行為

官方文件未記載。工具目前把含連字號的詞加引號輸出。

```text
'beta-blocker':ti,ab,kw
```

```text
'beta blocker':ti,ab,kw
```

```text
beta-blocker:ti,ab,kw
```

- 三條的命中筆數（前兩條相同代表連字號被當成空白）：19760/19755/19755
- 第三條有無語法錯誤或被解析成其他意思：無

### B3. Ovid MEDLINE：保留字與引號

工具假設含 `and`／`or`／`not`／`use` 等字詞的 heading 或單一詞必須加引號。保留字清單未取得官方完整版本。

```text
exp "Wounds and Injuries"/
```

```text
exp Wounds and Injuries/
```

```text
"use".ti,ab,kf.
```

```text
use.ti,ab,kf.
```

- 第一條是否正確對應到 MeSH heading：1106152個結果
- 第二條的實際解析結果（是否被拆成 Boolean）：exp Wounds/ and Injuries/
- 第三、四條有無語法錯誤，命中筆數是否相同：	
4159871/無法搜尋(沒看到錯誤)

### B4. Ovid MEDLINE：含逗號的 heading

```text
exp Diabetes Mellitus, Type 2/
```

- 是否正確對應到 MeSH heading（未被逗號拆開）：有，204805

### B5. PubMed：連字號片語與片語索引

```text
"SGLT-2 inhibitor"[tiab]
```

- Search Details 顯示的實際解析："SGLT-2 inhibitor"[Title/Abstract]
- 是否出現「Quoted phrase not found」之類的提示：無

## C. 結論

| 平台 | A 組全部無語法錯誤 | 需修正的項目 | 可標為 live-validated |
|--|---|---|---|
| PubMed |V |無 |可 |
| Embase.com (Elsevier) |V |無 |可 |
| Ovid MEDLINE |V |無 |可 |

## D. 判讀與後續處理（2026-11-17）

- **A 組**：三平台皆無語法錯誤。Ovid 會把 per-term 欄位合併顯示為 `(...).ti,ab,kf.`，PubMed 會把單一詞加引號顯示，皆為等價改寫。三個平台的 `LIVE_VALIDATED` 改為 `true`。
- **B1**：雙引號包覆撇號在 Embase.com 出現語法錯誤 → 撇號維持拒絕（D1 定案，不再待驗）。
- **B2**：`'beta-blocker'` 19760、`'beta blocker'` 19755、`beta-blocker` 19755。加引號的連字號寫法命中不少於另外兩種，不會造成漏檢 → 維持「含連字號一律加引號」。差 5 筆的原因未查（可能是連字號原樣比對，或執行時間差）。
- **B3**：`exp "Wounds and Injuries"/` 正確對應；未加引號被拆成 `exp Wounds/ and Injuries/`；未加引號的 `use.ti,ab,kf.` 無法搜尋且**沒有錯誤訊息** → 保留字加引號的規則屬實，且必要。
- **B4、B5**：符合預期。
- **獨立覆審發現（`.ai-review/verdict.md` C1）**：A 組未涵蓋「保留字加截字」。原實作會輸出 `"freq".ti,ab,kf.`（截字遺失）。已改為對 Ovid target 回傳 blocking error，其他平台照常；此路徑的 Ovid 寫法未經 live 驗證，因此不輸出。
- 待補：Ovid 資料庫區段名稱。
