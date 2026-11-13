// 輸入正規化（spec §2.3、§4.1、T18）：只處理空白、換行與排版用標點，不改變詞義。
// 正規化後仍不合規的字元交由 validate 拒絕，這裡不做任何刪字或拼字修正。

const LINE_BREAK = /\r\n|[\r\n\u0085\u2028\u2029]/;
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
/** \u201C \u201D \u201E \u201F \u00AB \u00BB \uFF02 → " */
const DOUBLE_QUOTES = /[\u201C-\u201F\u00AB\u00BB\uFF02]/g;
/** \u2018 \u2019 \u201A \u201B \u2032 \uFF07 ` \u00B4 → ' */
const SINGLE_QUOTES = /[\u2018-\u201B\u2032\uFF07`\u00B4]/g;
/** \u2010 \u2011 \u2012 \u2013 \u2014 \u2015 \u2212 → -（文書軟體自動替換的破折號） */
const DASHES = /[\u2010-\u2015\u2212]/g;

/** 將多行文字切成逐行陣列；保留空行，讓索引對應使用者看到的行號。 */
export function splitLines(text: string): string[] {
  return text.split(LINE_BREAK);
}

/**
 * 正規化單行輸入：移除零寬字元、統一引號與連字號、
 * 所有 Unicode 空白轉為單一半形空白並去頭尾。
 */
export function normalizeLine(raw: string): string {
  return raw
    .replace(ZERO_WIDTH, '')
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
