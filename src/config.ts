import type { ConceptId, Platform } from './model/types';

/** AND 連接與畫面呈現的固定順序（spec §4.2）。 */
export const CONCEPT_ORDER: readonly ConceptId[] = ['P', 'I', 'C', 'O'];

/** 預設納入檢索的 block（spec §2.1 步驟 4）。 */
export const DEFAULT_ENABLED: Readonly<Record<ConceptId, boolean>> = {
  P: true,
  I: true,
  C: false,
  O: false,
};

export const PLATFORM_ORDER: readonly Platform[] = ['pubmed', 'embase-com', 'ovid-medline'];

/** 平台全名。Embase.com 與 Ovid Embase 是不同介面，標示不可省略（spec §2.2）。 */
export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  pubmed: 'PubMed',
  'embase-com': 'Embase.com (Elsevier)',
  'ovid-medline': 'Ovid MEDLINE',
};

/**
 * 輸入上限。這些是 UI 安全界線，不是各資料庫的官方限制（spec §6.3）。
 */
export const LIMITS = {
  maxTermsPerConcept: 30,
  maxTermLength: 200,
  maxQueryLength: 10_000,
  /** 結尾 `*` 前至少需要的字母數；取 PubMed 的限制作為三平台共同下限（spec §1.2）。 */
  minTruncationStem: 4,
  /** encodeURIComponent 後超過此長度即停用 PubMed 連結。暫定值，非官方限制。 */
  maxPubmedUrlLength: 2_000,
} as const;

export const LIVE_PREVIEW_DEBOUNCE_MS = 300;

export const PUBMED_SEARCH_URL = 'https://pubmed.ncbi.nlm.nih.gov/?term=';

/**
 * 各平台是否已完成 live 貼上驗證（spec §6.2、§10）。
 * 只有在 docs/live-validation.md 有對應紀錄後才可改為 true。
 */
export const LIVE_VALIDATED: Readonly<Record<Platform, boolean>> = {
  pubmed: false,
  'embase-com': false,
  'ovid-medline': false,
};
