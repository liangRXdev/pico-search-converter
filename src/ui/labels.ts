import type { ConceptId } from '../model/types';
import type { Vocabulary } from '../render/shared';

export const CONCEPT_LABELS: Readonly<Record<ConceptId, { name: string; english: string }>> = {
  P: { name: '病人或問題', english: 'Population' },
  I: { name: '介入', english: 'Intervention' },
  C: { name: '對照', english: 'Comparison' },
  O: { name: '結果', english: 'Outcome' },
};

export const VOCABULARY_HELP: Readonly<
  Record<Vocabulary, { label: string; platforms: string; linkLabel: string; url: string }>
> = {
  mesh: {
    label: 'MeSH',
    platforms: '用於 PubMed 與 Ovid MEDLINE',
    linkLabel: '到 NLM MeSH Browser 查證',
    url: 'https://meshb.nlm.nih.gov/',
  },
  emtree: {
    label: 'Emtree',
    platforms: '只用於 Embase.com',
    linkLabel: 'Embase 檢索說明',
    url: 'https://www.elsevier.support/embase/answer/how-do-i-search-in-embase',
  },
};
