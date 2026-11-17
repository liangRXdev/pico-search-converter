// 產生 PWA 圖示：SVG 原稿 → 本機 Chrome headless 截圖成 PNG。零 npm 依賴。
// 執行：node scripts/gen-icons.mjs（需本機安裝 Chrome；可用 CHROME_PATH 指定路徑）
// 產物進版控，CI 不重新產生。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { iconSvg } from './icon-source.mjs';

const OUT = 'public/icons';
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('找不到 Chrome，請以 CHROME_PATH 指定。');
  process.exit(1);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true }, // iOS 自行裁圓角，需不透明全幅
];

/** Windows 的 chrome.exe 可能在截圖寫完前就結束，最多等 20 秒。 */
function waitForFile(path) {
  const deadline = Date.now() + 20000;
  while (!existsSync(path) || statSync(path).size === 0) {
    if (Date.now() > deadline) throw new Error(`Chrome 未產生 ${path}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); // 等寫入完成
}

const work = mkdtempSync(join(tmpdir(), 'pico-icons-'));
try {
  for (const { file, size, maskable } of TARGETS) {
    const svgPath = join(work, `${file}.html`);
    // 包一層 HTML 確保 body 無邊距、背景透明
    writeFileSync(
      svgPath,
      `<!doctype html><html><body style="margin:0;background:transparent">${iconSvg({ maskable, size })}</body></html>`,
    );
    const out = join(OUT, file);
    if (existsSync(out)) unlinkSync(out);
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      // 獨立 profile：否則 Chrome 已開啟時，指令會被轉交給既有視窗而直接結束、不產生截圖
      `--user-data-dir=${join(work, 'profile')}`,
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${resolve(out)}`,
      pathToFileURL(svgPath).href,
    ], { stdio: 'ignore' });
    waitForFile(out);
    const png = readFileSync(out);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== size || height !== size) throw new Error(`${file} 尺寸 ${width}×${height}，預期 ${size}×${size}`);
    console.log(`wrote ${out} (${size}×${size}, ${png.length} bytes)`);
  }
  writeFileSync(join(OUT, 'icon.svg'), iconSvg());
  writeFileSync('public/favicon.svg', iconSvg({ size: 32 }));
  console.log('wrote public/icons/icon.svg, public/favicon.svg');
} finally {
  rmSync(work, { recursive: true, force: true });
}
