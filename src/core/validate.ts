// term 層級的解析與驗證（spec §4.1；決策 D1、D2）。
// 原則：無法保證三個平台都安全輸出的輸入一律拒絕並給修正建議，不做靜默修補。

import { LIMITS } from '../config';
import type { FreeTextTerm } from '../model/types';
import { CODES, type Code } from './codes';
import { normalizeLine } from './normalize';

export type ParseOutcome<T> =
  | { status: 'empty' }
  | { status: 'ok'; value: T }
  | { status: 'error'; code: Code; message: string };

type ParseError = Extract<ParseOutcome<never>, { status: 'error' }>;

const EMPTY = { status: 'empty' } as const;

function fail(code: Code, message: string): ParseError {
  return { status: 'error', code, message };
}

const PROXIMITY = /\[[^\]]*:~\s*\d+\s*\]|\b(?:NEAR|NEXT)\/\d+|\badj\d*\b/i;
/** PubMed `[tag]`、Embase `:ti,ab`／`/exp`、Ovid `.ti,ab.`／結尾 `/` */
const FIELD_TAG = /[[\]]|:[a-z]{2}(?:,[a-z]{2})*$|\/(?:exp|de|mj)?$|\.[a-z]{2}(?:,[a-z]{2})*\.?$/i;
const BOOLEAN_WORD = /^(?:and|or|not)$/i;
const FREE_TEXT_CHARS = /[A-Za-z0-9 -]/;
const FREE_TEXT_TOKEN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const HEADING_CHARS = /[A-Za-z0-9 ,-]/;
const HEADING_TOKEN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*,?$/;
const HEADING_SYNTAX = /[[\]/*:?$#()]|^exp\s/i;

function checkLength(line: string): ParseError | null {
  if (line.length <= LIMITS.maxTermLength) return null;
  return fail(
    CODES.TERM_TOO_LONG,
    `單一 term 長度 ${line.length} 字元，超過上限 ${LIMITS.maxTermLength}。請拆成多行或縮短。`,
  );
}

/** 偵測使用者貼入的檢索語法（proximity、field tag、括號）。 */
function checkPastedSyntax(line: string): ParseError | null {
  if (PROXIMITY.test(line)) {
    return fail(
      CODES.PROXIMITY_UNSUPPORTED,
      '不支援 proximity 語法（[tiab:~N]、NEAR/n、NEXT/n、adjN）：各平台的距離定義不同，無法直接換算，預計日後版本才處理。請改輸入片語或分行輸入各個詞。',
    );
  }
  if (FIELD_TAG.test(line)) {
    return fail(
      CODES.FIELD_TAG_UNSUPPORTED,
      '請只輸入關鍵字本身，不要加欄位代碼（如 [tiab]、[tw]、:ti,ab、.ti.、/exp）。欄位代碼會由工具依平台自動加上。',
    );
  }
  if (/[()]/.test(line)) {
    return fail(
      CODES.PARENTHESES_UNSUPPORTED,
      '不支援括號。每行只輸入一個詞或片語，括號與 Boolean 邏輯由工具自動產生。',
    );
  }
  return null;
}

type Unquoted = { status: 'ok'; text: string; quoted: boolean } | ParseError;

function apostropheError(): ParseError {
  return fail(
    CODES.APOSTROPHE_UNSUPPORTED,
    "不支援含撇號（'）的詞：Embase.com 以單引號包片語，無法保證安全輸出。請改寫為不含撇號的形式，例如 Crohn's disease → Crohn disease。",
  );
}

/** 去除一組成對的外層引號（直引號；彎引號已先正規化）。 */
function unquote(line: string): Unquoted {
  const first = line[0];
  const isQuote = first === '"' || first === "'";
  if (isQuote && line.length >= 2 && line.endsWith(first)) {
    const inner = line.slice(1, -1).trim();
    if (inner.includes('"')) return quoteError();
    if (inner.includes("'")) return apostropheError();
    if (inner === '') return fail(CODES.EMPTY_PHRASE, '引號內沒有內容。請輸入片語或刪除此行。');
    return { status: 'ok', text: inner, quoted: true };
  }
  if (line.includes('"')) return quoteError();
  if (line.includes("'")) return apostropheError();
  return { status: 'ok', text: line, quoted: false };
}

function quoteError(): ParseError {
  return fail(
    CODES.QUOTE_UNBALANCED,
    '引號不成對，或出現在詞的中間。每行只能有一個詞或片語；片語請用一組引號包住整行。',
  );
}

type Wildcard = { status: 'ok'; stem: string; truncated: boolean } | ParseError;

/** 只接受「單一純字母詞 + 結尾一個 *」，且 * 前至少 minTruncationStem 個字母。 */
function analyzeWildcard(text: string, quoted: boolean): Wildcard {
  if (/[?$#]/.test(text)) {
    return fail(
      CODES.WILDCARD_UNSUPPORTED,
      '不支援 ?、$、# 萬用字元：各平台意義不同。僅支援詞尾的 *（如 diabet*）。',
    );
  }
  if (!text.includes('*')) return { status: 'ok', stem: text, truncated: false };
  if (quoted || text.includes(' ')) {
    return fail(
      CODES.WILDCARD_IN_PHRASE,
      '片語內不支援 *。請改成單一詞加詞尾 *（如 diabet*），或移除 * 保留片語。',
    );
  }
  if (text.indexOf('*') !== text.length - 1) {
    return fail(
      CODES.WILDCARD_POSITION,
      '* 只能出現一次且必須在詞尾（如 diabet*）。不支援詞首或詞中的 *。',
    );
  }
  const stem = text.slice(0, -1);
  if (!/^[A-Za-z]+$/.test(stem)) {
    return fail(
      CODES.TRUNCATION_STEM_NOT_LETTERS,
      '* 前面只能是英文字母。含數字或連字號的詞會以片語輸出，片語內不支援 *；請移除 * 或改用純字母詞幹。',
    );
  }
  if (stem.length < LIMITS.minTruncationStem) {
    return fail(
      CODES.TRUNCATION_STEM_TOO_SHORT,
      `* 前至少需要 ${LIMITS.minTruncationStem} 個字母（PubMed 的限制），目前只有 ${stem.length} 個。請加長詞幹或改列完整的詞。`,
    );
  }
  return { status: 'ok', stem, truncated: true };
}

/** D2：含 and/or/not 的輸入，使用者明確加引號才視為片語。 */
function checkBoolean(text: string, quoted: boolean): ParseError | null {
  const tokens = text.split(' ');
  const hits = tokens.filter((token) => BOOLEAN_WORD.test(token));
  if (hits.length === 0) return null;
  if (quoted && hits.length < tokens.length) return null;
  return fail(
    CODES.BOOLEAN_IN_TERM,
    '此行含有 AND／OR／NOT。若是片語（如 signs and symptoms），請用引號包住整行；若是多個詞，請分行輸入，Boolean 邏輯由工具自動產生。',
  );
}

function describeChar(char: string): string {
  const code = char.codePointAt(0) ?? 0;
  if (code > 0x20 && code !== 0x7f) return char;
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

function checkCharacters(
  text: string,
  allowed: RegExp,
  token: RegExp,
  kind: 'freeText' | 'heading',
): ParseError | null {
  if (kind === 'freeText' && text.includes(',')) {
    return fail(
      CODES.COMMA_IN_TERM,
      '逗號不會分隔 term，且關鍵字不支援逗號。多個詞請分行輸入。',
    );
  }
  const bad = [...new Set([...text].filter((char) => !allowed.test(char)))];
  if (bad.length > 0) {
    const list = bad.map(describeChar).join(' ');
    if (bad.some((char) => (char.codePointAt(0) ?? 0) > 0x7f)) {
      return fail(
        CODES.NON_ASCII_UNSUPPORTED,
        `含有非 ASCII 字元（${list}）。請改用 ASCII 拼法，例如 Sjögren → Sjogren、TNF-α → TNF-alpha。`,
      );
    }
    return fail(
      CODES.CHARACTER_UNSUPPORTED,
      `含有不支援的字元（${list}）。僅接受英文字母、數字、空白與連字號。`,
    );
  }
  if (!text.split(' ').every((part) => token.test(part))) {
    return fail(
      CODES.HYPHEN_POSITION,
      '連字號或逗號的位置不正確：連字號必須在字母或數字之間（如 beta-blocker），不可在詞首、詞尾或連續出現。',
    );
  }
  return null;
}

/** 解析一行 free-text 輸入。空行回傳 empty，由呼叫端略過。 */
export function parseFreeText(raw: string): ParseOutcome<FreeTextTerm> {
  const line = normalizeLine(raw);
  if (line === '') return EMPTY;
  const early = checkLength(line) ?? checkPastedSyntax(line);
  if (early) return early;
  const unquoted = unquote(line);
  if (unquoted.status === 'error') return unquoted;
  const wildcard = analyzeWildcard(unquoted.text, unquoted.quoted);
  if (wildcard.status === 'error') return wildcard;
  const { stem, truncated } = wildcard;
  const error =
    checkBoolean(stem, unquoted.quoted) ??
    checkCharacters(stem, FREE_TEXT_CHARS, FREE_TEXT_TOKEN, 'freeText');
  if (error) return error;
  return {
    status: 'ok',
    value: {
      kind: 'freeText',
      value: stem,
      phrase: /[ -]/.test(stem),
      trailingTruncation: truncated,
    },
  };
}

/**
 * 解析一個 MeSH／Emtree heading 名稱。只檢查能否安全輸出，
 * 不驗證該 heading 是否真的存在於詞彙庫（spec §1.3）。
 */
export function parseHeading(raw: string): ParseOutcome<string> {
  const line = normalizeLine(raw);
  if (line === '') return EMPTY;
  const tooLong = checkLength(line);
  if (tooLong) return tooLong;
  if (HEADING_SYNTAX.test(line)) {
    return fail(
      CODES.HEADING_SYNTAX,
      '請只輸入 heading 名稱本身，不要含 exp、/、[MeSH Terms]、/exp、* 等語法（是否 explode 請用開關）。名稱含括號的 heading 目前不支援。',
    );
  }
  const unquoted = unquote(line);
  if (unquoted.status === 'error') return unquoted;
  const error = checkCharacters(unquoted.text, HEADING_CHARS, HEADING_TOKEN, 'heading');
  if (error) return error;
  return { status: 'ok', value: unquoted.text };
}
