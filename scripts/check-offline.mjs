// T23 的靜態檢查：build 產物不得發出任何非同源請求，也不得含網路 API。
// 邏輯：頁面只載入同源資源 + 程式碼沒有任何網路呼叫 → 初次載入後不需網路即可運作。
// 這是間接驗證，不取代真實瀏覽器的斷網測試（見 docs/live-validation.md 與 README）。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

/** 只允許以連結（使用者主動點擊）或 XML namespace 形式出現的主機。 */
const ALLOWED_HOSTS = new Set([
  'www.w3.org', // SVG／MathML／XLink namespace（React DOM）
  'react.dev', // React 錯誤訊息內的說明連結
  'pubmed.ncbi.nlm.nih.gov',
  'meshb.nlm.nih.gov',
  'www.ncbi.nlm.nih.gov',
  'www.elsevier.support',
  'tools.ovid.com',
  'www.cochrane.org',
]);

const NETWORK_APIS = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'sendBeacon',
  'EventSource',
  'importScripts',
  'serviceWorker',
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isExternal(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(reference.trim().replace(/^['"]/, ''));
}

const problems = [];
let files;
try {
  files = walk(DIST);
} catch {
  console.error(`找不到 ${DIST}/，請先執行 npm run build。`);
  process.exit(1);
}

for (const file of files) {
  if (!/\.(?:html|css|js)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');

  if (file.endsWith('.html')) {
    for (const [, tag, reference] of text.matchAll(/<(script|link|img|iframe)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
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
    for (const [url, host] of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      if (!ALLOWED_HOSTS.has(host.toLowerCase())) {
        problems.push(`${file}：出現未列入允許清單的主機 ${url}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('離線檢查未通過：');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`離線檢查通過：已檢查 ${files.length} 個檔案，無外部資源載入、無網路 API。`);
