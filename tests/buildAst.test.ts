import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/config';
import { buildAst } from '../src/core/buildAst';
import { CODES } from '../src/core/codes';
import type {
  BlockInput,
  ConceptId,
  ControlledTermInput,
  SearchModel,
  ValidationIssue,
} from '../src/model/types';

function block(id: ConceptId, enabled: boolean, freeText: string[] = []): BlockInput {
  return { id, enabled, freeText, mesh: [], emtree: [] };
}

function model(blocks: BlockInput[]): SearchModel {
  return { schemaVersion: '1.0', searchMode: 'explicit_free_text', blocks };
}

function heading(
  term: string,
  explode = true,
  verification: ControlledTermInput['verification'] = 'user_confirmed',
): ControlledTermInput {
  return { term, explode, verification, source: 'user_input' };
}

/** spec §5 golden example 的輸入。 */
function goldenModel(): SearchModel {
  return model([
    block('P', true, ['hypertension', '"high blood pressure"']),
    block('I', true, ['exercise', '"physical activity"']),
    block('C', false),
    block('O', false, ['"blood pressure"']),
  ]);
}

function codes(issues: ValidationIssue[], severity?: ValidationIssue['severity']): string[] {
  return issues.filter((issue) => !severity || issue.severity === severity).map((i) => i.code);
}

function values(outcome: ReturnType<typeof buildAst>, id: ConceptId): string[] {
  const concept = outcome.ast?.concepts.find((candidate) => candidate.id === id);
  return concept ? concept.terms.map((term) => term.value) : [];
}

describe('buildAst：結構', () => {
  it('T01：P、I 各兩個 term，依序產生兩個概念', () => {
    const outcome = buildAst(goldenModel());
    expect(outcome.ast?.concepts.map((concept) => concept.id)).toEqual(['P', 'I']);
    expect(values(outcome, 'P')).toEqual(['hypertension', 'high blood pressure']);
    expect(values(outcome, 'I')).toEqual(['exercise', 'physical activity']);
    expect(codes(outcome.issues, 'error')).toEqual([]);
  });

  it('T02：O 有內容但未啟用 → 排除並明示，且不修改輸入 model', () => {
    const input = goldenModel();
    const snapshot = structuredClone(input);
    const outcome = buildAst(input);
    expect(values(outcome, 'O')).toEqual([]);
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({ code: CODES.BLOCK_EXCLUDED, severity: 'info', concept: 'O' }),
    );
    expect(codes(outcome.issues)).not.toContain(CODES.EMPTY_ENABLED_BLOCK);
    expect(input).toEqual(snapshot);
  });

  it('未啟用且空白的 block 不產生提示', () => {
    const outcome = buildAst(goldenModel());
    expect(outcome.issues.filter((issue) => issue.concept === 'C')).toEqual([]);
  });

  it('T03：啟用 C、O 後成為額外概念，並提醒可能降低敏感度', () => {
    const outcome = buildAst(
      model([
        block('O', true, ['mortality']),
        block('C', true, ['placebo']),
        block('I', true, ['exercise']),
        block('P', true, ['hypertension']),
      ]),
    );
    expect(outcome.ast?.concepts.map((concept) => concept.id)).toEqual(['P', 'I', 'C', 'O']);
    expect(codes(outcome.issues)).toContain(CODES.COMPARATOR_OUTCOME_INCLUDED);
  });

  it('T04：只啟用 P → 合法，附方法學提醒', () => {
    const outcome = buildAst(model([block('P', true, ['hypertension']), block('I', false)]));
    expect(outcome.ast?.concepts).toHaveLength(1);
    expect(codes(outcome.issues, 'error')).toEqual([]);
    expect(codes(outcome.issues, 'info')).toContain(CODES.SINGLE_CONCEPT);
  });

  it('T25：相同輸入兩次結果完全相同', () => {
    expect(JSON.stringify(buildAst(goldenModel()))).toBe(JSON.stringify(buildAst(goldenModel())));
  });

  it('單一元素內含換行時視為多行', () => {
    const outcome = buildAst(model([block('P', true, ['hypertension\r\nhigh blood pressure'])]));
    expect(values(outcome, 'P')).toEqual(['hypertension', 'high blood pressure']);
  });
});

describe('buildAst：blocking 驗證', () => {
  it('T05：全部未啟用', () => {
    const outcome = buildAst(model([block('P', false), block('I', false)]));
    expect(outcome.ast).toBeNull();
    expect(codes(outcome.issues, 'error')).toEqual([CODES.NO_ENABLED_BLOCK]);
  });

  it('T05：沒有任何 block', () => {
    expect(codes(buildAst(model([])).issues, 'error')).toEqual([CODES.NO_ENABLED_BLOCK]);
  });

  it('T05：啟用但空白（含純空白行）', () => {
    const outcome = buildAst(model([block('P', true, ['hypertension']), block('I', true, [' '])]));
    expect(outcome.ast).toBeNull();
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({ code: CODES.EMPTY_ENABLED_BLOCK, concept: 'I' }),
    );
  });

  it('無效 term 不被靜默丟棄：回報位置，且不輸出部分結果', () => {
    const outcome = buildAst(
      model([block('P', true, ['hypertension', '', 'cat*']), block('I', true, ['exercise'])]),
    );
    expect(outcome.ast).toBeNull();
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({
        code: CODES.TRUNCATION_STEM_TOO_SHORT,
        severity: 'error',
        concept: 'P',
        field: 'freeText',
        index: 2,
      }),
    );
  });

  it('block 內全是無效 term 時只報 term 錯誤，不另報空 block', () => {
    const outcome = buildAst(model([block('P', true, ['cat*'])]));
    expect(codes(outcome.issues, 'error')).toEqual([CODES.TRUNCATION_STEM_TOO_SHORT]);
  });

  it('未啟用 block 內的無效輸入不擋輸出', () => {
    const outcome = buildAst(model([block('P', true, ['hypertension']), block('O', false, ['cat*'])]));
    expect(outcome.ast).not.toBeNull();
    expect(codes(outcome.issues)).toContain(CODES.BLOCK_EXCLUDED);
  });

  it('T19：超過每個概念的筆數上限', () => {
    const terms = (count: number) => Array.from({ length: count }, (_, i) => `term${i}`);
    const atLimit = buildAst(model([block('P', true, terms(LIMITS.maxTermsPerConcept))]));
    expect(codes(atLimit.issues, 'error')).toEqual([]);
    const over = buildAst(model([block('P', true, terms(LIMITS.maxTermsPerConcept + 1))]));
    expect(over.ast).toBeNull();
    expect(codes(over.issues, 'error')).toEqual([CODES.TOO_MANY_TERMS]);
  });
});

describe('buildAst：去重（T06）', () => {
  it('不分大小寫、忽略多餘空白與引號，保留首次出現的寫法與順序', () => {
    const outcome = buildAst(
      model([
        block('P', true, [
          'Hypertension',
          'hypertension',
          ' HYPERTENSION ',
          'high  blood pressure',
          '"High Blood Pressure"',
          'exercise',
        ]),
      ]),
    );
    expect(values(outcome, 'P')).toEqual(['Hypertension', 'high blood pressure', 'exercise']);
    expect(codes(outcome.issues).filter((code) => code === CODES.DUPLICATE_REMOVED)).toHaveLength(3);
  });

  it('只在 block 內去重，跨 block 保留', () => {
    const outcome = buildAst(
      model([block('P', true, ['blood pressure']), block('I', true, ['blood pressure'])]),
    );
    expect(values(outcome, 'P')).toEqual(['blood pressure']);
    expect(values(outcome, 'I')).toEqual(['blood pressure']);
  });

  it('不做拼字或詞幹合併；truncation 與完整詞視為不同', () => {
    const outcome = buildAst(model([block('P', true, ['diabetes', 'diabetic', 'diabet*', 'diabet'])]));
    expect(values(outcome, 'P')).toEqual(['diabetes', 'diabetic', 'diabet', 'diabet']);
  });
});

describe('buildAst：subject heading', () => {
  it('已確認的 MeSH 與 Emtree 分開保留，排在 free text 之前', () => {
    const input = block('P', true, ['hypertension']);
    input.mesh = [heading('Hypertension', true)];
    input.emtree = [heading('hypertension', false)];
    const outcome = buildAst(model([input]));
    expect(outcome.ast?.concepts[0]?.terms).toEqual([
      { kind: 'mesh', value: 'Hypertension', explode: true },
      { kind: 'emtree', value: 'hypertension', explode: false },
      { kind: 'freeText', value: 'hypertension', phrase: false, trailingTruncation: false },
    ]);
  });

  it('只有 heading、沒有 free text 的 block 在 core 層合法（各平台是否可輸出由 renderer 判斷）', () => {
    const input = block('P', true);
    input.mesh = [heading('Hypertension')];
    expect(buildAst(model([input])).ast).not.toBeNull();
  });

  it('未確認的 heading → blocking error，不輸出', () => {
    const input = block('P', true, ['hypertension']);
    input.mesh = [heading('Hypertension', true, 'unconfirmed')];
    const outcome = buildAst(model([input]));
    expect(outcome.ast).toBeNull();
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({ code: CODES.HEADING_UNCONFIRMED, field: 'mesh', index: 0 }),
    );
  });

  it('空白的 heading 列被略過', () => {
    const input = block('P', true, ['hypertension']);
    input.mesh = [heading('  ', true, 'unconfirmed')];
    const outcome = buildAst(model([input]));
    expect(outcome.ast?.concepts[0]?.terms).toHaveLength(1);
  });

  it('同名 heading 去重；explode 設定不同者兩筆都保留', () => {
    const input = block('P', true);
    input.mesh = [heading('Hypertension', true), heading('hypertension', true), heading('Hypertension', false)];
    const outcome = buildAst(model([input]));
    expect(outcome.ast?.concepts[0]?.terms).toEqual([
      { kind: 'mesh', value: 'Hypertension', explode: true },
      { kind: 'mesh', value: 'Hypertension', explode: false },
    ]);
  });

  it('heading 語法錯誤回報欄位與索引', () => {
    const input = block('P', true, ['hypertension']);
    input.emtree = [heading('hypertension'), heading("'hypertension'/exp")];
    const outcome = buildAst(model([input]));
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({ code: CODES.HEADING_SYNTAX, field: 'emtree', index: 1 }),
    );
  });
});
