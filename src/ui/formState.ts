// 表單狀態與 SearchModel 之間的轉換。UI 只保存使用者輸入的原樣，驗證全交給 core。

import { CONCEPT_ORDER, DEFAULT_ENABLED } from '../config';
import { normalizeLine, splitLines } from '../core/normalize';
import type { BlockInput, ConceptId, ControlledTermInput, SearchModel } from '../model/types';

export interface HeadingRow {
  /** React list key，僅供畫面使用。 */
  key: number;
  term: string;
  explode: boolean;
  confirmed: boolean;
}

export interface ConceptState {
  enabled: boolean;
  /** textarea 原文，一行一個詞。 */
  text: string;
  mesh: HeadingRow[];
  emtree: HeadingRow[];
}

export type FormState = Record<ConceptId, ConceptState>;

let nextKey = 1;

export function newHeadingRow(): HeadingRow {
  nextKey += 1;
  return { key: nextKey, term: '', explode: true, confirmed: false };
}

function concept(id: ConceptId, text = '', enabled = DEFAULT_ENABLED[id]): ConceptState {
  return { enabled, text, mesh: [], emtree: [] };
}

export function emptyForm(): FormState {
  return { P: concept('P'), I: concept('I'), C: concept('C'), O: concept('O') };
}

/** spec §5 的教學範例：O 有內容但預設不納入。 */
export function exampleForm(): FormState {
  return {
    P: concept('P', 'hypertension\n"high blood pressure"'),
    I: concept('I', 'exercise\n"physical activity"'),
    C: concept('C'),
    O: concept('O', '"blood pressure"'),
  };
}

function toControlled(row: HeadingRow): ControlledTermInput {
  return {
    term: row.term,
    explode: row.explode,
    verification: row.confirmed ? 'user_confirmed' : 'unconfirmed',
    source: 'user_input',
  };
}

export function toModel(form: FormState): SearchModel {
  const blocks: BlockInput[] = CONCEPT_ORDER.map((id) => ({
    id,
    enabled: form[id].enabled,
    freeText: splitLines(form[id].text),
    mesh: form[id].mesh.map(toControlled),
    emtree: form[id].emtree.map(toControlled),
  }));
  return { schemaVersion: '1.0', searchMode: 'explicit_free_text', blocks };
}

/** 整張表單沒有任何內容：顯示引導而不是錯誤。 */
export function isBlank(form: FormState): boolean {
  return CONCEPT_ORDER.every((id) => {
    const { text, mesh, emtree } = form[id];
    const headings = [...mesh, ...emtree].map((row) => row.term);
    return [text, ...headings].every((value) => normalizeLine(value) === '');
  });
}
