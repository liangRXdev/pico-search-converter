// 資料模型：spec §3.2（輸入 JSON model）與 §3.3（AST、Result）。
// 本檔只放型別，不含邏輯。

export type ConceptId = 'P' | 'I' | 'C' | 'O';

export type Platform = 'pubmed' | 'embase-com' | 'ovid-medline';

// ── 輸入 model（spec §3.2）────────────────────────────────

/**
 * `user_confirmed` 只代表使用者自述已查證，不是外部詞彙庫的驗證結果。
 * `unconfirmed` 的 heading 不得輸出到任何 query。
 */
export type HeadingVerification = 'user_confirmed' | 'unconfirmed';

export interface ControlledTermInput {
  term: string;
  explode: boolean;
  verification: HeadingVerification;
  source: 'user_input';
}

export interface BlockInput {
  id: ConceptId;
  enabled: boolean;
  /** 原始輸入，一個元素一行；尚未 normalize 或驗證。 */
  freeText: string[];
  mesh: ControlledTermInput[];
  emtree: ControlledTermInput[];
}

export interface SearchModel {
  schemaVersion: '1.0';
  searchMode: 'explicit_free_text';
  blocks: BlockInput[];
}

// ── AST（spec §3.3）──────────────────────────────────────

export interface FreeTextTerm {
  kind: 'freeText';
  /** 已 normalize、已去外層引號、不含結尾 `*` 的字面文字。 */
  value: string;
  /** true 時各平台必須加引號輸出（含空白、連字號，或使用者明確加引號）。 */
  phrase: boolean;
  trailingTruncation: boolean;
}

export interface MeshTerm {
  kind: 'mesh';
  value: string;
  explode: boolean;
}

export interface EmtreeTerm {
  kind: 'emtree';
  value: string;
  explode: boolean;
}

export type TermNode = FreeTextTerm | MeshTerm | EmtreeTerm;

export type Expr =
  | { kind: 'term'; term: TermNode }
  | { kind: 'or'; children: Expr[] }
  | { kind: 'and'; children: Expr[] };

/** 單一 PICO block 的 AST：block 內所有 term 以 OR 連接。 */
export interface ConceptExpr {
  id: ConceptId;
  terms: TermNode[];
}

/** 完整查詢：已啟用的 block 依 P → I → C → O 以 AND 連接。 */
export interface QueryAst {
  concepts: ConceptExpr[];
}

// ── 訊息與輸出 ───────────────────────────────────────────

export type Severity = 'info' | 'warning' | 'error';

export interface Message {
  code: string;
  severity: Severity;
  message: string;
}

/** 輸入驗證訊息：可定位到 block、欄位與行，供 UI 指向出錯位置。 */
export interface ValidationIssue extends Message {
  concept?: ConceptId;
  field?: 'freeText' | 'mesh' | 'emtree';
  /** 0-based，對應該欄位陣列的索引。 */
  index?: number;
}

export interface Result {
  platform: Platform;
  /**
   * 可直接貼上執行的 query。該平台有 blocking error 時為 null
   * （spec §4.3：不得輸出空 OR 群組或誤導性的 query）。
   */
  query: string | null;
  warnings: Message[];
}
