// Ovid MEDLINE（Wolters Kluwer／Ovid 介面）emitter：spec §4.4。
// 採 per-term 欄位（每個詞各自加 .ti,ab,kf.），不做 (a OR b).ti,ab,kf. 的壓縮寫法。

import { CODES } from '../core/codes';
import type { Message, QueryAst, Result } from '../model/types';
import { assertRenderable, doubleQuoted } from './escaping';
import { hasVocabulary, renderWith, type Emitter } from './shared';

const FIELDS = '.ti,ab,kf.';

/**
 * Ovid 會當成運算子或指令的字詞。含這些字詞的 term 必須加引號，
 * 否則 `Wounds and Injuries/` 會被解析成 Boolean。
 * 假設：此清單依 Ovid 常見保留字整理，未取得官方完整清單，需經 live 驗證。
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

const emitter: Emitter = {
  platform: 'ovid-medline',
  vocabulary: 'mesh',
  freeText(term) {
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
