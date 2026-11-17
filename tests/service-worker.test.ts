import { describe, expect, it, vi } from 'vitest';
import { buildServiceWorker, shouldPrecache } from '../scripts/sw-plugin.mjs';
import SW_TEMPLATE from '../scripts/sw-template.js?raw';

const ENTRIES = [
  { file: 'index.html', content: '<html>v1</html>' },
  { file: 'assets/index-abc.js', content: 'console.log(1)' },
  { file: 'assets/index-def.css', content: 'body{}' },
  { file: 'assets/font-400.woff2', content: new Uint8Array([1, 2, 3]) },
  { file: 'assets/font-400.woff', content: new Uint8Array([4, 5]) },
  { file: 'icons/icon-192.png', content: new Uint8Array([9]) },
  { file: 'manifest.webmanifest', content: '{}' },
  { file: 'sw.js', content: 'old' },
];

function precacheOf(source: string): string[] {
  const match = /const PRECACHE = (\[[\s\S]*?\]);/.exec(source);
  return JSON.parse(match?.[1] ?? 'null') as string[];
}

function cacheNameOf(source: string): string {
  const version = /const CACHE = `\$\{PREFIX\}([0-9a-f]+)`;/.exec(source)?.[1];
  return `pico-search-converter-${version ?? ''}`;
}

describe('sw.js 產生（scripts/sw-plugin.mjs）', () => {
  it('預先快取：index.html 以 ./ 表示，排除 sw.js 本身與 woff', () => {
    const urls = precacheOf(buildServiceWorker(ENTRIES, SW_TEMPLATE));
    expect([...urls].sort()).toEqual([
      './',
      'assets/font-400.woff2',
      'assets/index-abc.js',
      'assets/index-def.css',
      'icons/icon-192.png',
      'manifest.webmanifest',
    ]);
    expect(shouldPrecache('assets/x.js.map')).toBe(false);
  });

  it('快取版本：任何預先快取檔內容變更都換新名稱；不預先快取的檔案不影響；同輸入結果相同', () => {
    const base = cacheNameOf(buildServiceWorker(ENTRIES, SW_TEMPLATE));
    expect(base).toMatch(/^pico-search-converter-[0-9a-f]{12}$/);
    expect(cacheNameOf(buildServiceWorker(ENTRIES, SW_TEMPLATE))).toBe(base);

    const html = ENTRIES.map((e) => (e.file === 'index.html' ? { ...e, content: '<html>v2</html>' } : e));
    expect(cacheNameOf(buildServiceWorker(html, SW_TEMPLATE))).not.toBe(base);

    const woff = ENTRIES.map((e) => (e.file.endsWith('.woff') ? { ...e, content: new Uint8Array([7]) } : e));
    expect(cacheNameOf(buildServiceWorker(woff, SW_TEMPLATE))).toBe(base);
  });

  it('缺 index.html 時拒絕產生', () => {
    expect(() => buildServiceWorker(ENTRIES.filter((e) => e.file !== 'index.html'), SW_TEMPLATE)).toThrow(
      /index\.html/,
    );
  });

  it('所有佔位符都被取代', () => {
    const source = buildServiceWorker(ENTRIES, SW_TEMPLATE);
    expect(source).not.toContain('__VERSION__');
    expect(source).not.toContain('__PRECACHE__');
  });
});

// ── 行為測試：在模擬的 SW 全域環境執行產生出來的 sw.js ──────────────

const ORIGIN = 'https://liangrxdev.github.io';
const SCOPE = `${ORIGIN}/pico-search-converter/`;

class FakeCache {
  readonly store = new Map<string, Response>();
  private key(request: RequestInfo | URL): string {
    const raw = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
    return new URL(raw, SCOPE).href;
  }
  async addAll(urls: string[]) {
    for (const url of urls) this.store.set(this.key(url), new Response(`precached ${url}`));
  }
  async put(request: RequestInfo | URL, response: Response) {
    this.store.set(this.key(request), response);
  }
  async match(request: RequestInfo | URL) {
    return this.store.get(this.key(request))?.clone();
  }
}

function setupWorker(source: string, network: (url: string) => Promise<Response>) {
  const caches = new Map<string, FakeCache>();
  const cacheStorage = {
    open: async (name: string) => {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name) as FakeCache;
    },
    keys: async () => [...caches.keys()],
    delete: async (name: string) => caches.delete(name),
    match: async (request: Request) => {
      for (const cache of caches.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    location: new URL(`${SCOPE}sw.js`),
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return network(new URL(raw, SCOPE).href);
  });
  new Function('self', 'caches', 'fetch', source)(self, cacheStorage, fetchMock);

  async function dispatch(type: string, extra: object = {}) {
    let pending: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    listeners.get(type)?.({
      ...extra,
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });
    await pending;
    return responded;
  }
  return { caches, cacheStorage, dispatch, fetchMock };
}

function navigate(url = SCOPE): Request {
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('sw.js 行為', () => {
  const source = buildServiceWorker(ENTRIES, SW_TEMPLATE);
  const cacheName = cacheNameOf(source);

  it('activate 只刪自家前綴的舊快取，同網域其他工具與哨兵快取不受影響', async () => {
    const { caches, cacheStorage, dispatch } = setupWorker(source, async () => new Response('net'));
    for (const name of [
      'pico-search-converter-000000000000',
      'tx-ebm-calc-v10',
      'tfda-static-v3',
      'workbox-precache-v2-https://liangrxdev.github.io/other/',
      'zz-sentinel-not-any-tool',
    ]) {
      await cacheStorage.open(name);
    }
    await dispatch('install');
    await dispatch('activate');
    expect([...caches.keys()].sort()).toEqual(
      [
        cacheName,
        'tfda-static-v3',
        'tx-ebm-calc-v10',
        'workbox-precache-v2-https://liangrxdev.github.io/other/',
        'zz-sentinel-not-any-tool',
      ].sort(),
    );
  });

  it('install 預先快取清單內所有檔案', async () => {
    const { caches, dispatch } = setupWorker(source, async () => new Response('net'));
    await dispatch('install');
    const stored = [...(caches.get(cacheName)?.store.keys() ?? [])];
    expect(stored).toContain(SCOPE);
    expect(stored).toContain(`${SCOPE}assets/index-abc.js`);
  });

  it('導覽：有網路時回傳網路版並更新 shell 快取（網路優先）', async () => {
    const { caches, dispatch } = setupWorker(source, async () => new Response('fresh html'));
    await dispatch('install');
    const response = await dispatch('fetch', { request: navigate() });
    expect(await response?.text()).toBe('fresh html');
    await flush();
    expect(await (await caches.get(cacheName)?.match('./'))?.text()).toBe('fresh html');
  });

  it('導覽：離線時退回快取的 shell', async () => {
    const { dispatch } = setupWorker(source, async () => {
      throw new TypeError('offline');
    });
    await dispatch('install');
    const response = await dispatch('fetch', { request: navigate(`${SCOPE}?q=1`) });
    expect(await response?.text()).toBe('precached ./');
  });

  it('導覽：網路回傳 redirected response 時重建乾淨回應（避免導覽失敗）', async () => {
    const redirected = new Response('after redirect');
    Object.defineProperty(redirected, 'redirected', { value: true });
    const { dispatch } = setupWorker(source, async () => redirected);
    await dispatch('install');
    const response = await dispatch('fetch', { request: navigate() });
    expect(response?.redirected).toBe(false);
    expect(await response?.text()).toBe('after redirect');
  });

  it('靜態資源：快取優先，命中時不連網', async () => {
    const { dispatch, fetchMock } = setupWorker(source, async () => new Response('net'));
    await dispatch('install');
    fetchMock.mockClear();
    const response = await dispatch('fetch', { request: new Request(`${SCOPE}assets/index-abc.js`) });
    expect(await response?.text()).toBe('precached assets/index-abc.js');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('跨來源與非 GET 請求一律不攔截', async () => {
    const { dispatch, fetchMock } = setupWorker(source, async () => new Response('net'));
    await dispatch('install');
    fetchMock.mockClear();
    expect(await dispatch('fetch', { request: new Request('https://pubmed.ncbi.nlm.nih.gov/?term=x') })).toBeUndefined();
    expect(await dispatch('fetch', { request: new Request(`${SCOPE}x`, { method: 'POST' }) })).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
