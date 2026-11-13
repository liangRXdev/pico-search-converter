// 完整 pipeline（spec §3.1）：SearchModel → 驗證 + AST → 三個平台的查詢。

import type { BlockInput, Result, ValidationIssue } from '../model/types';
import { renderAll } from '../render';
import { buildAst } from './buildAst';

export interface Generation {
  /** 輸入層級的錯誤與提示。 */
  issues: ValidationIssue[];
  /** 輸入有任何 error 時為 null：不輸出任何平台的查詢。 */
  results: Result[] | null;
}

export function generate(model: { blocks: readonly BlockInput[] }): Generation {
  const { ast, issues } = buildAst(model);
  return { issues, results: ast ? renderAll(ast) : null };
}
