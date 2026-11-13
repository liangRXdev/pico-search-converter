// 三個平台的引號策略（spec §4.4）。
// v1 不做 escape：core 已拒絕所有引號、撇號與特殊字元（D1），
// 這裡只做最後一道防線，確保未經驗證的值不會被拼進查詢語法。

const RENDERABLE = /^[A-Za-z0-9 ,-]+$/;

/** 值若含白名單以外的字元即拋錯：代表 AST 未經 core 驗證，屬程式錯誤而非使用者輸入錯誤。 */
export function assertRenderable(value: string): string {
  if (!RENDERABLE.test(value)) {
    throw new Error(`無法安全輸出的 term（未經 core 驗證）：${JSON.stringify(value)}`);
  }
  return value;
}

/** PubMed 與 Ovid 的片語引號。 */
export function doubleQuoted(value: string): string {
  return `"${assertRenderable(value)}"`;
}

/** Embase.com 的片語引號。 */
export function singleQuoted(value: string): string {
  return `'${assertRenderable(value)}'`;
}
