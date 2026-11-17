// 自寫的 Vite plugin：build 時依實際產物產生 dist/sw.js（不引入 vite-plugin-pwa／workbox）。
// 預先快取清單 = bundle 產物 + public/ 靜態檔；版本 = 所有預先快取檔內容的 SHA-256 前 12 碼，
// 任何檔案內容變更都會換新快取名稱，舊快取在 activate 時清除。

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** 讀 sw-template.js（延後到 build 時才讀；測試以 ?raw 直接匯入原稿）。 */
export function readSwTemplate() {
  return readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
}

/** 不預先快取：SW 自己、舊瀏覽器才用的 woff（支援 SW 的瀏覽器都支援 woff2）、source map。 */
export function shouldPrecache(file) {
  return file !== 'sw.js' && !file.endsWith('.woff') && !file.endsWith('.map');
}

/**
 * 由檔案清單產生 sw.js 原始碼。`index.html` 以 './' 取代（導覽的快取 key）。
 * 清單缺 index.html 時拋錯：沒有 shell 的 SW 離線時只會回錯誤頁。
 */
export function buildServiceWorker(entries, template) {
  const kept = entries.filter((entry) => shouldPrecache(entry.file)).sort((a, b) => a.file.localeCompare(b.file));
  if (!kept.some((entry) => entry.file === 'index.html')) {
    throw new Error('預先快取清單缺少 index.html，無法產生 sw.js');
  }
  const hash = createHash('sha256');
  for (const entry of kept) {
    hash.update(entry.file);
    hash.update('\0');
    hash.update(entry.content);
    hash.update('\0');
  }
  const version = hash.digest('hex').slice(0, 12);
  const urls = kept.map((entry) => (entry.file === 'index.html' ? './' : entry.file));
  return template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls, null, 2));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function serviceWorkerPlugin() {
  let publicDir = '';
  return {
    name: 'pico-service-worker',
    apply: 'build',
    enforce: 'post', // 須在 Vite 產生 index.html 之後執行，清單才含 shell
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle).map((item) => ({
        file: item.fileName,
        content: item.type === 'chunk' ? item.code : item.source,
      }));
      if (publicDir) {
        for (const path of walk(publicDir)) {
          entries.push({ file: relative(publicDir, path).split(sep).join('/'), content: readFileSync(path) });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorker(entries, readSwTemplate()) });
    },
  };
}
