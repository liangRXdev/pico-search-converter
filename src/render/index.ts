import type { QueryAst, Result } from '../model/types';
import { renderEmbaseCom } from './embaseCom';
import { renderOvidMedline } from './ovidMedline';
import { renderPubmed } from './pubmed';

/** 依 PLATFORM_ORDER 的固定順序輸出三個平台的結果。 */
export function renderAll(ast: QueryAst): Result[] {
  return [renderPubmed(ast), renderEmbaseCom(ast), renderOvidMedline(ast)];
}
