# Live 驗證紀錄

> spec §6.2、§10：每個平台至少一次實際貼上執行的紀錄。
> 以下 query 由 `tests/golden/*.json` 的 expected 欄位逐字產生，與自動化測試比對的是同一份字串。
> 全部通過後，才可將 `src/config.ts` 的 `LIVE_VALIDATED` 對應平台改為 `true`。

## 執行方式

1. 逐條複製 code block 內的 query，貼到對應平台的進階／命令列搜尋框執行。
2. 在該條下方填寫紀錄。重點是**有無語法錯誤**與**平台實際怎麼解析**，命中筆數只供參考（三個平台本來就不會相同）。
3. 貼上的是教學用範例關鍵字，不含任何病患資料；紀錄中也不要填入病患資訊。

## 環境

- PubMed：執行日期＿＿＿＿
- Embase.com：執行日期＿＿＿＿，確認網址為 embase.com（不是 Ovid 平台上的 Embase）
- Ovid MEDLINE：執行日期＿＿＿＿，資料庫區段名稱（如 Ovid MEDLINE(R) ALL 1946 to ...）＿＿＿＿

## A. Golden fixtures

### A1. spec §5 golden example：P、I 各兩個詞，O 有內容但未納入

來源：`tests/golden/01-spec-section-5.json`

**PubMed**

```text
(hypertension[tiab] OR "high blood pressure"[tiab]) AND (exercise[tiab] OR "physical activity"[tiab])
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Embase.com (Elsevier)**

```text
(hypertension:ti,ab,kw OR 'high blood pressure':ti,ab,kw) AND (exercise:ti,ab,kw OR 'physical activity':ti,ab,kw)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Ovid MEDLINE**

```text
(hypertension.ti,ab,kf. OR "high blood pressure".ti,ab,kf.) AND (exercise.ti,ab,kf. OR "physical activity".ti,ab,kf.)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

### A2. 四個概念全部納入：truncation、連字號片語、引號內含 and 的片語、單一詞的概念

來源：`tests/golden/02-all-blocks-truncation-hyphen.json`

**PubMed**

```text
(diabet*[tiab] OR "type 2 diabetes"[tiab]) AND ("SGLT-2 inhibitor"[tiab] OR empagliflozin[tiab]) AND (placebo[tiab]) AND (mortality[tiab] OR "morbidity and mortality"[tiab])
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Embase.com (Elsevier)**

```text
(diabet*:ti,ab,kw OR 'type 2 diabetes':ti,ab,kw) AND ('SGLT-2 inhibitor':ti,ab,kw OR empagliflozin:ti,ab,kw) AND (placebo:ti,ab,kw) AND (mortality:ti,ab,kw OR 'morbidity and mortality':ti,ab,kw)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Ovid MEDLINE**

```text
(diabet*.ti,ab,kf. OR "type 2 diabetes".ti,ab,kf.) AND ("SGLT-2 inhibitor".ti,ab,kf. OR empagliflozin.ti,ab,kf.) AND (placebo.ti,ab,kf.) AND (mortality.ti,ab,kf. OR "morbidity and mortality".ti,ab,kf.)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

### A3. 已確認的 MeSH 與 Emtree：explode 與 non-explode、含逗號的 heading、含 and 的 heading

來源：`tests/golden/03-verified-headings.json`

**PubMed**

```text
("Diabetes Mellitus, Type 2"[MeSH Terms] OR "type 2 diabetes"[tiab]) AND ("Wounds and Injuries"[MeSH Terms:noexp] OR wound*[tiab])
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Embase.com (Elsevier)**

```text
('non insulin dependent diabetes mellitus'/exp OR 'type 2 diabetes':ti,ab,kw) AND ('injury'/de OR wound*:ti,ab,kw)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Ovid MEDLINE**

```text
(exp Diabetes Mellitus, Type 2/ OR "type 2 diabetes".ti,ab,kf.) AND ("Wounds and Injuries"/ OR wound*.ti,ab,kf.)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

### A4. T14：P 只有 MeSH、沒有 free text → Embase.com 不輸出查詢，另外兩個平台照常

來源：`tests/golden/04-mesh-only-block.json`

**PubMed**

```text
("Hypertension"[MeSH Terms]) AND (exercise[tiab])
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
- 備註：

**Embase.com (Elsevier)**：此案例預期不輸出查詢（blocking error），無需貼上。

**Ovid MEDLINE**

```text
(exp Hypertension/) AND (exercise.ti,ab,kf.)
```

- 執行日期：
- 語法錯誤（有／無，原文）：
- 命中筆數：
- 平台實際解析結果（Search Details／history 顯示）：
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

- 第一條有無語法錯誤：
- 兩條的命中筆數：
- 結論（撇號可否以雙引號包覆）：

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

- 三條的命中筆數（前兩條相同代表連字號被當成空白）：
- 第三條有無語法錯誤或被解析成其他意思：

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

- 第一條是否正確對應到 MeSH heading：
- 第二條的實際解析結果（是否被拆成 Boolean）：
- 第三、四條有無語法錯誤，命中筆數是否相同：

### B4. Ovid MEDLINE：含逗號的 heading

```text
exp Diabetes Mellitus, Type 2/
```

- 是否正確對應到 MeSH heading（未被逗號拆開）：

### B5. PubMed：連字號片語與片語索引

```text
"SGLT-2 inhibitor"[tiab]
```

- Search Details 顯示的實際解析：
- 是否出現「Quoted phrase not found」之類的提示：

## C. 結論

| 平台 | A 組全部無語法錯誤 | 需修正的項目 | 可標為 live-validated |
|---|---|---|---|
| PubMed | | | |
| Embase.com (Elsevier) | | | |
| Ovid MEDLINE | | | |
