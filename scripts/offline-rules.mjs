// T23 靜態檢查的規則（純函式，供 check-offline.mjs 與 tests/check-offline.test.ts 共用）。
// 這是字串樣式比對：能抓到常見的資源載入與網路 API 寫法，但無法證明執行期沒有網路請求
// （例如把允許清單內的網址存進變數再指派給 img.src 就看不出來）。真正的保證仍靠手動斷網測試。

/** 只允許以連結（使用者主動點擊）或 XML namespace 形式出現的主機。 */
export const ALLOWED_HOSTS = new Set([
  'www.w3.org', // SVG／MathML／XLink namespace（React DOM）
  'react.dev', // React 錯誤訊息內的說明連結
  'pubmed.ncbi.nlm.nih.gov',
  'meshb.nlm.nih.gov',
  'www.ncbi.nlm.nih.gov',
  'www.elsevier.support',
  'tools.ovid.com',
  'www.cochrane.org',
]);

/** 出現即視為可能發出網路請求的 API 或建構式。 */
export const NETWORK_APIS = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'sendBeacon',
  'EventSource',
  'importScripts',
  'serviceWorker',
  'new Image',
  'new Audio',
  'new Worker',
  'new SharedWorker',
  'import(', // 本專案不做 code splitting，任何動態 import 都不該出現
];

/**
 * 外部網址前方若是這些寫法，代表它被當成「資源」載入而非導覽連結：
 * `x.src = "https://..."`、`{src: "https://..."}`（JSX 編譯後）、`x.srcset=`、`x.href=`（link 元素）、`url(`。
 */
const RESOURCE_CONTEXT = /(?:\.src|\bsrc|\bsrcset|\.srcSet|\.href|\bposter|\burl\()\s*[=:(]?\s*[`'"]?\s*$/;

const LOOKBEHIND = 24;

export function isExternal(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(reference.trim().replace(/^['"]/, ''));
}

/** 回傳單一檔案的問題清單；空陣列代表通過。 */
export function checkFile(file, text) {
  const problems = [];

  if (file.endsWith('.html')) {
    for (const [, tag, reference] of text.matchAll(/<(script|link|img|iframe|source|video|audio)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
      if (isExternal(reference)) problems.push(`${file}：<${tag}> 載入外部資源 ${reference}`);
    }
  }

  if (file.endsWith('.css')) {
    for (const [, reference] of text.matchAll(/url\(([^)]+)\)/g)) {
      if (isExternal(reference)) problems.push(`${file}：url() 指向外部資源 ${reference}`);
    }
    if (/@import/.test(text)) problems.push(`${file}：含有 @import`);
  }

  if (file.endsWith('.js')) {
    for (const api of NETWORK_APIS) {
      if (text.includes(api)) problems.push(`${file}：含有網路 API「${api}」`);
    }
    for (const match of text.matchAll(/(?:https?:)?\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
      const [url, host] = match;
      const before = text.slice(Math.max(0, match.index - LOOKBEHIND), match.index);
      if (url.startsWith('//') && !/[`'"(=:]\s*$/.test(before)) continue; // 註解或 regex 內的 //，不是網址
      if (!ALLOWED_HOSTS.has(host.toLowerCase())) {
        problems.push(`${file}：出現未列入允許清單的主機 ${url}`);
      } else if (RESOURCE_CONTEXT.test(before)) {
        problems.push(`${file}：允許清單內的網址被當成資源載入 ${url}`);
      }
    }
  }

  return problems;
}

export const PASS_MESSAGE =
  'HTML／CSS 沒有載入外部資源；JS 不含已知的網路 API 字串，外部網址都在允許清單內且未出現在資源載入的寫法中。' +
  '這是靜態樣式比對，不能證明執行期沒有網路請求，仍需手動斷網測試（T23）。';
