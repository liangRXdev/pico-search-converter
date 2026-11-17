/* pico-search-converter Service Worker（由 scripts/swPlugin.ts 於 build 時產生 dist/sw.js）
 *
 * - 網頁本體：網路優先，離線才用快取 → 語法規則修正後，有網路的使用者立即拿到新版
 * - JS／CSS／字型／圖示：安裝時預先快取（清單由 build 產生，檔名含 content hash）
 * - 只處理同源 GET；跨來源請求一律不攔截（本工具本來就不發任何跨來源請求）
 * - 共用 liangrxdev.github.io origin：清舊快取時只刪自家前綴，不得碰其他工具的快取
 */
const PREFIX = 'pico-search-converter-';
const CACHE = `${PREFIX}__VERSION__`;
const PRECACHE = __PRECACHE__;
/** 導覽一律以 './' 為快取 key，避免 index.html 與目錄網址各存一份或遇到轉址。 */
const SHELL_KEY = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});

function networkFirst(request) {
  return fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    .then((response) => {
      // 導覽請求不可直接回傳 redirected response（瀏覽器會判定失敗），重建一份乾淨的回應
      const clean = response.redirected
        ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
        : response;
      if (clean.ok) {
        const copy = clean.clone();
        caches.open(CACHE).then((cache) => cache.put(SHELL_KEY, copy));
      }
      return clean;
    })
    .catch(() => caches.open(CACHE).then((cache) => cache.match(SHELL_KEY)).then((hit) => hit || Response.error()));
}
