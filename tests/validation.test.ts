import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/config';
import { CODES } from '../src/core/codes';
import { normalizeLine, splitLines } from '../src/core/normalize';
import { parseFreeText, parseHeading } from '../src/core/validate';

function okTerm(raw: string) {
  const outcome = parseFreeText(raw);
  if (outcome.status !== 'ok') throw new Error(`預期 ok，實際 ${JSON.stringify(outcome)}`);
  return outcome.value;
}

function errorCode(raw: string): string {
  const outcome = parseFreeText(raw);
  if (outcome.status !== 'error') throw new Error(`預期 error，實際 ${JSON.stringify(outcome)}`);
  expect(outcome.message.length).toBeGreaterThan(0);
  return outcome.code;
}

describe('normalize（T18）', () => {
  it('各種 Unicode 空白摺疊為單一半形空白並去頭尾', () => {
    expect(normalizeLine('  heart\u00A0\u00A0failure\t\u3000')).toBe('heart failure');
  });

  it('彎引號轉直引號', () => {
    expect(normalizeLine('\u201Cheart failure\u201D')).toBe('"heart failure"');
    expect(normalizeLine('\u2018heart failure\u2019')).toBe("'heart failure'");
  });

  it('移除零寬字元，破折號轉連字號', () => {
    expect(normalizeLine('\uFEFFbeta\u2013blocker\u200B')).toBe('beta-blocker');
  });

  it('CRLF、LF、CR 皆可分行，並保留空行位置', () => {
    expect(splitLines('a\r\nb\n\nc\rd')).toEqual(['a', 'b', '', 'c', 'd']);
  });

  it('相同輸入結果相同', () => {
    const raw = ' \u201CHigh  Blood\u00A0Pressure\u201D ';
    expect(normalizeLine(raw)).toBe(normalizeLine(raw));
  });
});

describe('parseFreeText：接受的輸入', () => {
  it('單一詞', () => {
    expect(okTerm('hypertension')).toEqual({
      kind: 'freeText',
      value: 'hypertension',
      phrase: false,
      trailingTruncation: false,
    });
  });

  it('含空白自動視為片語', () => {
    expect(okTerm('high blood pressure')).toMatchObject({
      value: 'high blood pressure',
      phrase: true,
    });
  });

  it('T10：直引號、單引號、彎引號的片語結果相同，外層引號被去除', () => {
    const expected = okTerm('heart failure');
    expect(okTerm('"heart failure"')).toEqual(expected);
    expect(okTerm("'heart failure'")).toEqual(expected);
    expect(okTerm('\u201Cheart failure\u201D')).toEqual(expected);
  });

  it('保留原始大小寫與拼字', () => {
    expect(okTerm('COVID-19').value).toBe('COVID-19');
  });

  it('D1：含連字號的詞標記為片語', () => {
    expect(okTerm('beta-blocker')).toMatchObject({ value: 'beta-blocker', phrase: true });
  });

  it('T07：詞尾 * 且前方至少 4 個字母', () => {
    expect(okTerm('diabet*')).toEqual({
      kind: 'freeText',
      value: 'diabet',
      phrase: false,
      trailingTruncation: true,
    });
    expect(okTerm('card*').trailingTruncation).toBe(true);
  });

  it('D2：明確加引號的片語可含 and/or/not', () => {
    expect(okTerm('"signs and symptoms"')).toMatchObject({
      value: 'signs and symptoms',
      phrase: true,
    });
  });

  it('含 Boolean 字母但非獨立字詞者不受影響', () => {
    expect(okTerm('android').value).toBe('android');
    expect(okTerm('oral anticoagulant').value).toBe('oral anticoagulant');
  });

  it('空行與純空白回傳 empty', () => {
    expect(parseFreeText('').status).toBe('empty');
    expect(parseFreeText(' \u3000\t').status).toBe('empty');
  });
});

describe('parseFreeText：拒絕的輸入', () => {
  it.each([
    ['T08 詞幹不足 4 字母', 'cat*', CODES.TRUNCATION_STEM_TOO_SHORT],
    ['T09 詞中 *', 'tumo*r', CODES.WILDCARD_POSITION],
    ['T09 ?', 'cardio?', CODES.WILDCARD_UNSUPPORTED],
    ['T09 $', 'heart$', CODES.WILDCARD_UNSUPPORTED],
    ['Ovid #', 'wom#n', CODES.WILDCARD_UNSUPPORTED],
    ['詞首 *', '*itis', CODES.WILDCARD_POSITION],
    ['多個 *', 'diab**', CODES.WILDCARD_POSITION],
    ['片語內 *', 'heart fail*', CODES.WILDCARD_IN_PHRASE],
    ['引號片語內 *', '"diabet*"', CODES.WILDCARD_IN_PHRASE],
    ['連字號詞加 *', 'beta-block*', CODES.TRUNCATION_STEM_NOT_LETTERS],
    ['含數字詞加 *', 'sglt2*', CODES.TRUNCATION_STEM_NOT_LETTERS],
    ['T11 括號', '(hypertension)', CODES.PARENTHESES_UNSUPPORTED],
    ['T11 不成對括號', 'hypertension)', CODES.PARENTHESES_UNSUPPORTED],
    ['T11 raw AND', 'hypertension AND exercise', CODES.BOOLEAN_IN_TERM],
    ['D2 小寫 and 未加引號', 'signs and symptoms', CODES.BOOLEAN_IN_TERM],
    ['raw OR', 'aspirin OR ibuprofen', CODES.BOOLEAN_IN_TERM],
    ['raw NOT', 'cancer NOT pediatric', CODES.BOOLEAN_IN_TERM],
    ['引號內只有 Boolean 字詞', '"and"', CODES.BOOLEAN_IN_TERM],
    ['T15 [tiab]', 'hypertension[tiab]', CODES.FIELD_TAG_UNSUPPORTED],
    ['T15 [tw]', '"heart failure"[tw]', CODES.FIELD_TAG_UNSUPPORTED],
    ['Embase 欄位代碼', "'heart failure':ti,ab,kw", CODES.FIELD_TAG_UNSUPPORTED],
    ['Embase /exp', "'hypertension'/exp", CODES.FIELD_TAG_UNSUPPORTED],
    ['Ovid 欄位代碼', 'hypertension.ti,ab,kf.', CODES.FIELD_TAG_UNSUPPORTED],
    ['Ovid heading', 'exp Hypertension/', CODES.FIELD_TAG_UNSUPPORTED],
    ['T16 PubMed proximity', '"hip pain"[tiab:~3]', CODES.PROXIMITY_UNSUPPORTED],
    ['Embase proximity', 'hip NEAR/3 pain', CODES.PROXIMITY_UNSUPPORTED],
    ['Ovid proximity', 'hip adj3 pain', CODES.PROXIMITY_UNSUPPORTED],
    ['D1 撇號', "Crohn's disease", CODES.APOSTROPHE_UNSUPPORTED],
    ['D1 彎撇號', 'Crohn\u2019s disease', CODES.APOSTROPHE_UNSUPPORTED],
    ['D1 單引號片語內撇號', "'Crohn's disease'", CODES.APOSTROPHE_UNSUPPORTED],
    ['D1 非 ASCII 字母', 'Sj\u00F6gren', CODES.NON_ASCII_UNSUPPORTED],
    ['D1 希臘字母', 'TNF-\u03B1', CODES.NON_ASCII_UNSUPPORTED],
    ['全形字母', '\uFF41\uFF53\uFF50\uFF49\uFF52\uFF49\uFF4E', CODES.NON_ASCII_UNSUPPORTED],
    ['中文', '高血壓', CODES.NON_ASCII_UNSUPPORTED],
    ['逗號', 'aspirin, ibuprofen', CODES.COMMA_IN_TERM],
    ['不成對引號', '"heart failure', CODES.QUOTE_UNBALANCED],
    ['詞中引號', 'heart "failure" acute', CODES.QUOTE_UNBALANCED],
    ['一行兩個引號片語', '"heart failure" "cardiac failure"', CODES.QUOTE_UNBALANCED],
    ['空引號', '""', CODES.EMPTY_PHRASE],
    ['詞首連字號', '-blocker', CODES.HYPHEN_POSITION],
    ['詞尾連字號', 'beta-', CODES.HYPHEN_POSITION],
    ['連續連字號', 'beta--blocker', CODES.HYPHEN_POSITION],
    ['T17 HTML 標籤', '<b>aspirin</b>', CODES.CHARACTER_UNSUPPORTED],
    ['T17 script', '<script>alert(1)</script>', CODES.PARENTHESES_UNSUPPORTED],
    ['T17 事件屬性', '<img src=x onerror=alert`1`>', CODES.APOSTROPHE_UNSUPPORTED],
    ['URL 特殊字元', 'a&b#c', CODES.WILDCARD_UNSUPPORTED],
    ['& 符號', 'R&D', CODES.CHARACTER_UNSUPPORTED],
    ['斜線', 'and/or', CODES.CHARACTER_UNSUPPORTED],
  ])('%s：%s', (_label, raw, code) => {
    expect(errorCode(raw)).toBe(code);
  });

  it('T19：超過長度上限', () => {
    expect(parseFreeText('a'.repeat(LIMITS.maxTermLength)).status).toBe('ok');
    expect(errorCode('a'.repeat(LIMITS.maxTermLength + 1))).toBe(CODES.TERM_TOO_LONG);
  });

  it('控制字元以碼位顯示，不直接輸出到訊息', () => {
    const outcome = parseFreeText('asp\u0007irin');
    expect(outcome).toMatchObject({ status: 'error', code: CODES.CHARACTER_UNSUPPORTED });
    if (outcome.status === 'error') {
      expect(outcome.message).toContain('U+0007');
      expect(outcome.message).not.toContain('\u0007');
    }
  });
});

describe('parseHeading', () => {
  it.each([
    ['Hypertension', 'Hypertension'],
    ['Diabetes Mellitus, Type 2', 'Diabetes Mellitus, Type 2'],
    ['Receptors, Adrenergic, beta-2', 'Receptors, Adrenergic, beta-2'],
    ['Wounds and Injuries', 'Wounds and Injuries'],
    ['"Heart Failure"', 'Heart Failure'],
    ['  non insulin  dependent diabetes mellitus ', 'non insulin dependent diabetes mellitus'],
  ])('接受 %s', (raw, value) => {
    expect(parseHeading(raw)).toEqual({ status: 'ok', value });
  });

  it.each([
    ['exp Hypertension/', CODES.HEADING_SYNTAX],
    ['Hypertension/', CODES.HEADING_SYNTAX],
    ['"Hypertension"[MeSH Terms]', CODES.HEADING_SYNTAX],
    ["'hypertension'/exp", CODES.HEADING_SYNTAX],
    ['Hypertens*', CODES.HEADING_SYNTAX],
    ['Poly(ADP-ribose) Polymerases', CODES.HEADING_SYNTAX],
    ["Sjogren's Syndrome", CODES.APOSTROPHE_UNSUPPORTED],
    ['Sj\u00F6gren Syndrome', CODES.NON_ASCII_UNSUPPORTED],
    ['Diabetes Mellitus,, Type 2', CODES.HYPHEN_POSITION],
    [', Type 2', CODES.HYPHEN_POSITION],
    ['a'.repeat(LIMITS.maxTermLength + 1), CODES.TERM_TOO_LONG],
  ])('拒絕 %s', (raw, code) => {
    expect(parseHeading(raw)).toMatchObject({ status: 'error', code });
  });

  it('空白回傳 empty', () => {
    expect(parseHeading('  ').status).toBe('empty');
  });
});
