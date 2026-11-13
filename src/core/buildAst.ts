// SearchModel → QueryAst（spec §3.1 pipeline、§4.1 block 規則、§4.2 順序）。
// 純函式：不修改輸入 model，相同輸入必得相同輸出（T25）。

import { CONCEPT_ORDER, LIMITS } from '../config';
import type {
  BlockInput,
  ConceptExpr,
  ConceptId,
  ControlledTermInput,
  EmtreeTerm,
  MeshTerm,
  QueryAst,
  TermNode,
  ValidationIssue,
} from '../model/types';
import { CODES } from './codes';
import { normalizeLine, splitLines } from './normalize';
import { parseFreeText, parseHeading, type ParseOutcome } from './validate';

export interface BuildOutcome {
  /** 有任何 error 時為 null；不輸出部分結果。 */
  ast: QueryAst | null;
  issues: ValidationIssue[];
}

type Field = NonNullable<ValidationIssue['field']>;

interface Collected<T> {
  terms: T[];
  /** 非空白的輸入筆數（含驗證失敗者），用於上限與空 block 判斷。 */
  entryCount: number;
}

function collect<T>(
  concept: ConceptId,
  field: Field,
  outcomes: ParseOutcome<T>[],
  issues: ValidationIssue[],
): Collected<T> {
  const terms: T[] = [];
  let entryCount = 0;
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'empty') return;
    entryCount += 1;
    if (outcome.status === 'ok') {
      terms.push(outcome.value);
      return;
    }
    const { code, message } = outcome;
    issues.push({ code, severity: 'error', message, concept, field, index });
  });
  return { terms, entryCount };
}

function parseControlled<K extends 'mesh' | 'emtree'>(
  kind: K,
  input: ControlledTermInput,
): ParseOutcome<{ kind: K; value: string; explode: boolean }> {
  const parsed = parseHeading(input.term);
  if (parsed.status !== 'ok') return parsed;
  if (input.verification !== 'user_confirmed') {
    return {
      status: 'error',
      code: CODES.HEADING_UNCONFIRMED,
      message: `「${parsed.value}」尚未確認。請先在對應的詞彙庫查證後勾選「已確認」，或移除此 heading。`,
    };
  }
  return { status: 'ok', value: { kind, value: parsed.value, explode: input.explode } };
}

function dedupeKey(term: TermNode): string {
  const flag = term.kind === 'freeText' ? term.trailingTruncation : term.explode;
  return `${term.value.toLowerCase()}|${flag}`;
}

/** block 內不分大小寫去重，保留首次出現者；被移除的重複項以 info 告知。 */
function dedupe<T extends TermNode>(
  terms: T[],
  concept: ConceptId,
  field: Field,
  issues: ValidationIssue[],
): T[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = dedupeKey(term);
    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    issues.push({
      code: CODES.DUPLICATE_REMOVED,
      severity: 'info',
      message: `${concept}：重複的「${term.value}」已合併為一筆。`,
      concept,
      field,
    });
    return false;
  });
}

function buildConcept(block: BlockInput, issues: ValidationIssue[]): ConceptExpr {
  const { id } = block;
  const lines = block.freeText.flatMap(splitLines);
  const free = collect(id, 'freeText', lines.map(parseFreeText), issues);
  const mesh = collect<MeshTerm>(
    id,
    'mesh',
    block.mesh.map((input) => parseControlled('mesh', input)),
    issues,
  );
  const emtree = collect<EmtreeTerm>(
    id,
    'emtree',
    block.emtree.map((input) => parseControlled('emtree', input)),
    issues,
  );
  checkEntryCount(id, free.entryCount + mesh.entryCount + emtree.entryCount, issues);
  return {
    id,
    terms: [
      ...dedupe(mesh.terms, id, 'mesh', issues),
      ...dedupe(emtree.terms, id, 'emtree', issues),
      ...dedupe(free.terms, id, 'freeText', issues),
    ],
  };
}

function checkEntryCount(concept: ConceptId, count: number, issues: ValidationIssue[]): void {
  if (count === 0) {
    issues.push({
      code: CODES.EMPTY_ENABLED_BLOCK,
      severity: 'error',
      message: `${concept} 已設為納入檢索，但沒有任何內容。請輸入至少一個詞，或關閉 ${concept} 的納入開關。`,
      concept,
    });
  }
  if (count > LIMITS.maxTermsPerConcept) {
    issues.push({
      code: CODES.TOO_MANY_TERMS,
      severity: 'error',
      message: `${concept} 共有 ${count} 筆輸入，超過上限 ${LIMITS.maxTermsPerConcept}。請刪減或合併同義詞。`,
      concept,
    });
  }
}

function isPopulated(block: BlockInput): boolean {
  const headings = [...block.mesh, ...block.emtree].map((heading) => heading.term);
  return [...block.freeText, ...headings].some((raw) => normalizeLine(raw) !== '');
}

/** 不擋輸出的方法學提醒（spec §7.3、T04）。 */
function methodologyNotes(concepts: ConceptExpr[]): ValidationIssue[] {
  const notes: ValidationIssue[] = [];
  const only = concepts.length === 1 ? concepts[0] : undefined;
  if (only) {
    notes.push({
      code: CODES.SINGLE_CONCEPT,
      severity: 'info',
      message: `目前只納入 ${only.id} 一個概念，結果可能過於廣泛。一般建議至少以 P 與 I 組合。`,
    });
  }
  const narrowing = concepts.filter(({ id }) => id === 'C' || id === 'O').map(({ id }) => id);
  if (narrowing.length > 0) {
    notes.push({
      code: CODES.COMPARATOR_OUTCOME_INCLUDED,
      severity: 'info',
      message: `已將 ${narrowing.join('、')} 納入 AND 條件。要求 C／O 出現在標題、摘要或關鍵字可能漏掉相關文獻，請確認這是你要的。`,
    });
  }
  return notes;
}

export function buildAst(model: { blocks: readonly BlockInput[] }): BuildOutcome {
  const issues: ValidationIssue[] = [];
  const concepts: ConceptExpr[] = [];
  for (const id of CONCEPT_ORDER) {
    const block = model.blocks.find((candidate) => candidate.id === id);
    if (!block) continue;
    if (block.enabled) {
      concepts.push(buildConcept(block, issues));
    } else if (isPopulated(block)) {
      issues.push({
        code: CODES.BLOCK_EXCLUDED,
        severity: 'info',
        message: `${id} 有內容但未納入檢索。`,
        concept: id,
      });
    }
  }
  if (concepts.length === 0) {
    issues.push({
      code: CODES.NO_ENABLED_BLOCK,
      severity: 'error',
      message: '沒有任何概念被納入檢索。請至少啟用一個（建議 P 與 I）並輸入關鍵字。',
    });
  }
  if (issues.some((issue) => issue.severity === 'error')) return { ast: null, issues };
  return { ast: { concepts }, issues: [...issues, ...methodologyNotes(concepts)] };
}
