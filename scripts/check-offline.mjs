// T23 的靜態檢查：掃描 build 產物，規則見 offline-rules.mjs。
// 這是間接驗證，不取代真實瀏覽器的斷網測試（見 docs/live-validation.md 與 README）。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PASS_MESSAGE, checkFile } from './offline-rules.mjs';

const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error(`找不到 ${DIST}/，請先執行 npm run build。`);
  process.exit(1);
}

const checked = files.filter((file) => /\.(?:html|css|js)$/.test(file));
const problems = checked.flatMap((file) => checkFile(file, readFileSync(file, 'utf8')));

if (problems.length > 0) {
  console.error('離線檢查未通過：');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`離線檢查通過（已檢查 ${checked.length} 個 HTML／CSS／JS 檔）：${PASS_MESSAGE}`);
