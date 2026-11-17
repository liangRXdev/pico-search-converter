// 三個平台共用的組裝邏輯（spec §4.2）：block 內 OR、block 間 AND、括號全部明寫。
// 各平台只提供「單一 term 怎麼寫」，Boolean 結構由這裡統一產生，避免優先序錯誤。

import { LIMITS, LIVE_VALIDATED, PLATFORM_LABELS } from '../config';
import { CODES } from '../core/codes';
import type {
  ConceptExpr,
  FreeTextTerm,
  Message,
  Platform,
  QueryAst,
  QueryGroup,
  Result,
} from '../model/types';

export type Vocabulary = 'mesh' | 'emtree';

export const VOCABULARY_LABELS: Readonly<Record<Vocabulary, string>> = {
  mesh: 'MeSH',
  emtree: 'Emtree',
};

export interface Emitter {
  platform: Platform;
  /** 此平台使用的控制詞彙；另一種詞彙的 heading 一律不輸出（spec §4.3）。 */
  vocabulary: Vocabulary;
  freeText(term: FreeTextTerm): string;
  heading(value: string, explode: boolean): string;
  /**
   * 此平台無法安全輸出的 free text（語法未經驗證）。回傳 blocking error 時整個平台不輸出，
   * 其他平台不受影響；不可改寫 term 後照樣輸出（spec §2.2 不得靜默改變）。
   */
  unsupported?(term: FreeTextTerm, concept: ConceptExpr): Message | null;
  /** 平台專屬的補充說明，只在成功產生 query 時呼叫。 */
  notes?(ast: QueryAst, query: string): Message[];
}

function renderConcept(concept: ConceptExpr, emitter: Emitter): string[] {
  return concept.terms.flatMap((term) => {
    if (term.kind === 'freeText') return [emitter.freeText(term)];
    if (term.kind === emitter.vocabulary) return [emitter.heading(term.value, term.explode)];
    return [];
  });
}

function foreignOf(vocabulary: Vocabulary): Vocabulary {
  return vocabulary === 'mesh' ? 'emtree' : 'mesh';
}

function noTermsError(concept: ConceptExpr, emitter: Emitter): Message {
  const platform = PLATFORM_LABELS[emitter.platform];
  const foreign = VOCABULARY_LABELS[foreignOf(emitter.vocabulary)];
  const native = VOCABULARY_LABELS[emitter.vocabulary];
  return {
    code: CODES.NO_TERMS_FOR_PLATFORM,
    severity: 'error',
    message: `${concept.id} 只有 ${foreign} heading，沒有可用於 ${platform} 的內容，無法產生此平台的查詢。${foreign} 不會自動轉換為 ${native}；請為 ${concept.id} 補上 free text 關鍵字，或另外輸入已確認的 ${native} heading。`,
  };
}

/** 概念內有另一種詞彙的 heading、卻沒有本平台的 heading 時提醒（spec §1.3）。 */
function headingGap(concept: ConceptExpr, emitter: Emitter): Message | null {
  const kinds = new Set(concept.terms.map((term) => term.kind));
  if (kinds.has(emitter.vocabulary) || !kinds.has(foreignOf(emitter.vocabulary))) return null;
  const platform = PLATFORM_LABELS[emitter.platform];
  const foreign = VOCABULARY_LABELS[foreignOf(emitter.vocabulary)];
  const native = VOCABULARY_LABELS[emitter.vocabulary];
  return {
    code: CODES.NATIVE_HEADING_MISSING,
    severity: 'warning',
    message: `${concept.id}：已提供 ${foreign} heading，但未提供 ${native} heading（${native} mapping requires verification）。兩者是不同的詞彙庫，不會自動對應；${concept.id} 在 ${platform} 僅以 free text 檢索。`,
  };
}

function commonNotes(ast: QueryAst, emitter: Emitter): Message[] {
  const notes: Message[] = [];
  if (!LIVE_VALIDATED[emitter.platform]) {
    notes.push({
      code: CODES.NOT_LIVE_VALIDATED,
      severity: 'warning',
      message: `Not live-validated：此輸出格式尚未在 ${PLATFORM_LABELS[emitter.platform]} 實際執行驗證。`,
    });
  }
  const truncated = ast.concepts.some((concept) =>
    concept.terms.some((term) => term.kind === 'freeText' && term.trailingTruncation),
  );
  if (truncated) {
    notes.push({
      code: CODES.TRUNCATION_DIFFERS,
      severity: 'info',
      message: '含有 * 截字：各平台對 * 的展開規則與上限不同，命中範圍可能不一致。',
    });
  }
  notes.push({
    code: CODES.STRUCTURAL_TRANSLATION,
    severity: 'info',
    message:
      '這是語法結構的轉譯，不是等價的檢索策略：各平台的欄位涵蓋範圍只是近似，收錄內容也不同。請實際執行並檢查 search details 與命中結果。',
  });
  return notes;
}

function tooLong(query: string, emitter: Emitter): Message {
  return {
    code: CODES.QUERY_TOO_LONG,
    severity: 'error',
    message: `${PLATFORM_LABELS[emitter.platform]} 查詢長度 ${query.length} 字元，超過上限 ${LIMITS.maxQueryLength}。請刪減同義詞或關閉部分概念。`,
  };
}

export function renderWith(ast: QueryAst, emitter: Emitter): Result {
  const { platform } = emitter;
  const errors: Message[] = [];
  const gaps: Message[] = [];
  const groups: QueryGroup[] = [];
  for (const concept of ast.concepts) {
    for (const term of concept.terms) {
      const problem = term.kind === 'freeText' ? emitter.unsupported?.(term, concept) : null;
      if (problem) errors.push(problem);
    }
  }
  if (errors.length > 0) {
    return { platform, groups: [], query: null, warnings: errors };
  }
  for (const concept of ast.concepts) {
    const parts = renderConcept(concept, emitter);
    if (parts.length === 0) {
      errors.push(noTermsError(concept, emitter));
      continue;
    }
    groups.push({ concept: concept.id, parts });
    const gap = headingGap(concept, emitter);
    if (gap) gaps.push(gap);
  }
  if (errors.length > 0) {
    return { platform, groups: [], query: null, warnings: [...errors, ...gaps] };
  }
  const query = joinGroups(groups);
  if (query.length > LIMITS.maxQueryLength) {
    return { platform, groups: [], query: null, warnings: [tooLong(query, emitter)] };
  }
  const extra = emitter.notes?.(ast, query) ?? [];
  return { platform, groups, query, warnings: [...gaps, ...extra, ...commonNotes(ast, emitter)] };
}

/** block 內 OR、block 間 AND、每個 block 都加括號（spec §4.2）。 */
export function joinGroups(groups: readonly QueryGroup[]): string {
  return groups.map((group) => `(${group.parts.join(' OR ')})`).join(' AND ');
}

export function hasVocabulary(ast: QueryAst, vocabulary: Vocabulary): boolean {
  return ast.concepts.some((concept) => concept.terms.some((term) => term.kind === vocabulary));
}
