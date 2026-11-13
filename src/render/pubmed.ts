// PubMed（NLM 介面）emitter：spec §4.4。

import { LIMITS, PUBMED_SEARCH_URL } from '../config';
import { CODES } from '../core/codes';
import type { Message, QueryAst, Result } from '../model/types';
import { assertRenderable, doubleQuoted } from './escaping';
import { renderWith, type Emitter } from './shared';

/**
 * 產生可直接開啟的 PubMed 搜尋連結。
 * 編碼後超過長度上限時回傳 null，由 UI 改提示複製貼上。
 */
export function buildPubmedUrl(query: string): string | null {
  const url = PUBMED_SEARCH_URL + encodeURIComponent(query);
  return url.length > LIMITS.maxPubmedUrlLength ? null : url;
}

function notes(_ast: QueryAst, query: string): Message[] {
  const result: Message[] = [
    {
      code: CODES.PUBMED_EXPLICIT_FIELDS,
      severity: 'info',
      message:
        '所有關鍵字都加了 [tiab] 欄位標籤，因此不會觸發 PubMed 的 Automatic Term Mapping；結果會與直接輸入未加標籤的關鍵字不同。',
    },
  ];
  if (buildPubmedUrl(query) === null) {
    result.push({
      code: CODES.PUBMED_LINK_DISABLED,
      severity: 'info',
      message: '查詢過長，無法產生 PubMed 直接連結。請複製查詢後貼到 PubMed 搜尋框。',
    });
  }
  return result;
}

const emitter: Emitter = {
  platform: 'pubmed',
  vocabulary: 'mesh',
  freeText(term) {
    if (term.phrase) return `${doubleQuoted(term.value)}[tiab]`;
    const suffix = term.trailingTruncation ? '*' : '';
    return `${assertRenderable(term.value)}${suffix}[tiab]`;
  },
  heading(value, explode) {
    return `${doubleQuoted(value)}[${explode ? 'MeSH Terms' : 'MeSH Terms:noexp'}]`;
  },
  notes,
};

export function renderPubmed(ast: QueryAst): Result {
  return renderWith(ast, emitter);
}
