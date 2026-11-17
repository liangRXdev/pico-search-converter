import type { ConceptId, Platform } from './model/types';

export const APP_NAME = 'PICO 檢索語法轉換器';
export const APP_VERSION = '0.1.0';

/** 語法規則的查證來源（spec §1.1），顯示於頁尾與 TXT 匯出。 */
export const SOURCE_LINKS: readonly { label: string; url: string }[] = [
  { label: 'NLM PubMed User Guide', url: 'https://pubmed.ncbi.nlm.nih.gov/help/' },
  { label: 'NLM MeSH Browser', url: 'https://meshb.nlm.nih.gov/' },
  {
    label: 'Elsevier Embase：field codes',
    url: 'https://www.elsevier.support/embase/answer/what-field-codes-can-i-use-in-embase',
  },
  {
    label: 'Elsevier Embase：Boolean、wildcards、proximity',
    url: 'https://www.elsevier.support/embase/answer/can-i-use-boolean-operators-wildcards-and-proximity-operators-in-embase',
  },
  {
    label: 'Elsevier Embase：how to search',
    url: 'https://www.elsevier.support/embase/answer/how-do-i-search-in-embase',
  },
  { label: 'Ovid Quick Reference Card', url: 'https://tools.ovid.com/ovidtools/pdf/OvidQRC.pdf' },
  {
    label: 'NCBI Bookshelf：Ovid syntax guide',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK601822/table/t11/?report=objectonly',
  },
  {
    label: 'Cochrane Handbook, Chapter 4',
    url: 'https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-04',
  },
];

/** 匯出與畫面共用的固定聲明（spec §7）。 */
export const DISCLAIMER =
  '三組查詢是語法結構的轉譯，不是經過驗證的完整檢索策略。各平台的欄位涵蓋範圍只是近似，收錄內容不同，MeSH 與 Emtree 也不是一對一對應；命中筆數不會相同。請在各資料庫實際執行，檢查 search details 與 subject heading 的對應，並記錄檢索日期、資料庫、平台與完整字串。';

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
 * 驗證涵蓋的是 golden fixture 的語法形態；新增輸出形態時須補 live 紀錄。
 */
export const LIVE_VALIDATED: Readonly<Record<Platform, boolean>> = {
  pubmed: true,
  'embase-com': true,
  'ovid-medline': true,
};

/** live 驗證的執行日期（docs/live-validation.md）。 */
export const LIVE_VALIDATION_DATE = '2026-11-17';
