// Ovid MEDLINE（Wolters Kluwer／Ovid 介面）emitter：spec §4.4。
// 採 per-term 欄位（每個詞各自加 .ti,ab,kf.），不做 (a OR b).ti,ab,kf. 的壓縮寫法。

import { CODES } from '../core/codes';
import type { ConceptExpr, FreeTextTerm, Message, QueryAst, Result } from '../model/types';
import { assertRenderable, doubleQuoted } from './escaping';
import { hasVocabulary, renderWith, type Emitter } from './shared';

const FIELDS = '.ti,ab,kf.';

/**
 * Ovid 會當成運算子或指令的字詞。含這些字詞的 term 必須加引號，
 * 否則 `Wounds and Injuries/` 會被解析成 Boolean。
 * live 測試（2026-11-17，docs/live-validation.md B3）證實 `and`（heading 內）與 `use` 必須加引號；
 * 其餘字詞仍是依 Ovid 常見保留字整理的假設，未取得官方完整清單。加引號對一般詞無害，寧可多列。
 */
const RESERVED = new Set(['and', 'or', 'not', 'adj', 'use', 'from', 'exp', 'same', 'with', 'freq']);

function hasReservedWord(value: string): boolean {
  return value.split(/[ ,]+/).some((word) => RESERVED.has(word.toLowerCase()));
}

function notes(ast: QueryAst): Message[] {
  if (!hasVocabulary(ast, 'mesh')) return [];
  return [
    {
      code: CODES.OVID_MESH_VERIFY,
      severity: 'info',
      message:
        'MeSH heading 沿用你輸入的名稱。請在 Ovid 的 heading 對應畫面確認該名稱存在，且樹狀結構版本與你預期的一致。',
    },
  ];
}

/**
 * 保留字加截字（如 `freq*`）：加引號會吃掉 `*`、不加引號會被當運算子（live 測試 B3：
 * 未加引號的 `use` 不報錯但搜不到）。可用寫法未經驗證，因此整個 Ovid target 擋下。
 */
function isReservedTruncation(term: FreeTextTerm): boolean {
  return term.trailingTruncation && !term.phrase && hasReservedWord(term.value);
}

function unsupported(term: FreeTextTerm, concept: ConceptExpr): Message | null {
  if (!isReservedTruncation(term)) return null;
  return {
    code: CODES.OVID_RESERVED_TRUNCATION,
    severity: 'error',
    message: `${concept.id} 的「${term.value}*」：${term.value.toLowerCase()} 是 Ovid 的保留字，截字寫法尚未驗證，無法產生 Ovid MEDLINE 查詢（其他平台不受影響）。請改用更長、不等於保留字的詞幹，或分別列出完整詞形。`,
  };
}

const emitter: Emitter = {
  platform: 'ovid-medline',
  vocabulary: 'mesh',
  unsupported,
  freeText(term) {
    if (isReservedTruncation(term)) {
      throw new Error(`Ovid 保留字截字應已在 unsupported 擋下：${JSON.stringify(term.value)}`);
    }
    if (term.phrase || hasReservedWord(term.value)) return `${doubleQuoted(term.value)}${FIELDS}`;
    const suffix = term.trailingTruncation ? '*' : '';
    return `${assertRenderable(term.value)}${suffix}${FIELDS}`;
  },
  heading(value, explode) {
    const name = hasReservedWord(value) ? doubleQuoted(value) : assertRenderable(value);
    return `${explode ? 'exp ' : ''}${name}/`;
  },
  notes,
};

export function renderOvidMedline(ast: QueryAst): Result {
  return renderWith(ast, emitter);
}
