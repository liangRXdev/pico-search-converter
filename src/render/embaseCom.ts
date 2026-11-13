// Embase.com（Elsevier 介面）emitter：spec §4.4。
// 注意：這不是 Ovid Embase，兩者語法不同。MeSH heading 在此一律不輸出。

import type { QueryAst, Result } from '../model/types';
import { assertRenderable, singleQuoted } from './escaping';
import { renderWith, type Emitter } from './shared';

const FIELDS = ':ti,ab,kw';

const emitter: Emitter = {
  platform: 'embase-com',
  vocabulary: 'emtree',
  freeText(term) {
    if (term.phrase) return `${singleQuoted(term.value)}${FIELDS}`;
    const suffix = term.trailingTruncation ? '*' : '';
    return `${assertRenderable(term.value)}${suffix}${FIELDS}`;
  },
  heading(value, explode) {
    return `${singleQuoted(value)}/${explode ? 'exp' : 'de'}`;
  },
};

export function renderEmbaseCom(ast: QueryAst): Result {
  return renderWith(ast, emitter);
}
