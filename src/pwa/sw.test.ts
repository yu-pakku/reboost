// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import config from './config.json';
const files = [...config.staticPages, '/_next/static/app.js', '/icons/icon-192.png'];
let stores: Map<string, Map<string, Response>>;
let fetchMock: ReturnType<typeof vi.fn>;
let skipWaiting: ReturnType<typeof vi.fn>;
let openDatabase: ReturnType<typeof vi.fn>;
let handlers: Map<string, (event: Record<string, unknown>) => void>;
let version: string;
function loadWorker(key: string) {
  version = key;
  handlers = new Map();
  const code = readFileSync('src/pwa/sw-template.js', 'utf8').replace('__REBOOST_VERSION__', JSON.stringify(key)).replace('__REBOOST_PRECACHE__', JSON.stringify(files)).replace('__REBOOST_PAGES__', JSON.stringify(config.staticPages)).replace('__REBOOST_DYNAMIC__', JSON.stringify(config.dynamicPattern));
  const caches = {
    open: async (name: string) => { if (!stores.has(name)) stores.set(name, new Map()); const store = stores.get(name)!; return { put: async (key: string, response: Response) => { store.set(key, response.clone()); }, match: async (key: string) => store.get(key)?.clone() }; },
    keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name),
  };
  runInNewContext(code, { self: { location: { origin: 'https://app.test' }, addEventListener: (name: string, fn: (e: Record<string, unknown>) => void) => handlers.set(name, fn), skipWaiting, clients: { claim: async () => {} } }, caches, fetch: fetchMock, URL, Request, Response, Set, indexedDB: { open: openDatabase, deleteDatabase: openDatabase } });
}
async function event(name: string, data: Record<string, unknown> = {}) {
  const tasks: Promise<unknown>[] = []; const responses: Promise<Response>[] = [];
  handlers.get(name)!({ ...data, waitUntil: (p: Promise<unknown>) => tasks.push(p), respondWith: (p: Promise<Response>) => responses.push(p) });
  await Promise.all(tasks); return responses.length ? responses[0] : undefined;
}
const request = (path: string, mode = 'navigate', method = 'GET', headers = new Headers()) => ({ url: 'https://app.test' + path, method, mode, headers });
beforeEach(() => {
  stores = new Map(); skipWaiting = vi.fn(async () => {}); openDatabase = vi.fn();
  fetchMock = vi.fn(async (req: { url: string; credentials?: string }) => new Response('public shell or asset', { headers: { 'content-type': config.staticPages.includes(new URL(req.url).pathname) ? 'text/html' : 'application/javascript', 'cache-control': 'public' } }));
  loadWorker('v1');
});
describe('Service Workerのキャッシュと更新', () => {
  it('インストールで公開画面・許可資産を保存し、自動で新SWへ切り替えない', async () => {
    await event('install'); expect(stores.get('reboost-shell-v1')?.size).toBe(files.length); expect(fetchMock.mock.calls.every(call => call[0].credentials === 'omit')).toBe(true); expect(skipWaiting).not.toHaveBeenCalled();
  });
  it('オフライン時は静的画面を返し、未訪問の動的URLは専用シェルへ送る', async () => {
    await event('install'); stores.get('reboost-shell-v1')!.set('/knowledge/new', new Response('<html><head></head><body>new</body></html>')); fetchMock.mockRejectedValue(new Error('offline'));
    const saved = await event('fetch', { request: request('/knowledge/new') }); expect(saved?.status).toBe(200); expect(await saved?.text()).toContain('reboost-offline-shell');
    const response = await event('fetch', { request: request('/knowledge/48dd520f-dff2-40c5-ab92-2b8b234aeecc/edit') });
    expect(response?.status).toBe(302); expect(response?.headers.get('location')).toContain('/offline?route=');
    expect((await event('fetch', { request: request('/offline?route=%2Fknowledge%2Fid') }))?.status).toBe(200);
    expect((await event('fetch', { request: request('/_next/static/app.js', 'cors') }))?.status).toBe(200);
  });
  it('API・RSC・認証・外部・POST・未知の画面をキャッシュで処理しない', async () => {
    await event('install'); fetchMock.mockClear();
    for (const req of [request('/api/data', 'cors'), request('/knowledge?_rsc=secret', 'cors'), request('/account', 'navigate', 'GET', new Headers({ authorization: 'Bearer test' })), request('/knowledge', 'cors', 'POST'), request('/login')]) expect(await event('fetch', { request: req })).toBeUndefined();
    expect(await event('fetch', { request: { ...request('/'), url: 'https://other.test/' } })).toBeUndefined(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('ネットワークで取得した新HTMLや認証相当のHTMLを既存キャッシュへ混ぜない', async () => {
    await event('install'); fetchMock.mockResolvedValue(new Response('new private page', { headers: { 'cache-control': 'private', 'content-type': 'text/html' } }));
    await event('fetch', { request: request('/') }); expect(await stores.get('reboost-shell-v1')!.get('/')!.text()).toBe('public shell or asset');
  });
  it('インストールが不完全なら新しいキャッシュだけを破棄する', async () => {
    stores.set('reboost-shell-old', new Map()); fetchMock.mockResolvedValue(new Response('private', { headers: { 'cache-control': 'no-store', 'content-type': 'text/html' } }));
    await expect(event('install')).rejects.toThrow('Unsafe'); expect(stores.has('reboost-shell-old')).toBe(true); expect(stores.has('reboost-shell-v1')).toBe(false);
  });
  it('利用者の操作で更新し、現版と直前版だけを残してIndexedDBには触れない', async () => {
    stores.set('unrelated-cache', new Map()); stores.set('reboost-shell-oldest', new Map()); stores.set('reboost-shell-previous', new Map()); await event('install'); await event('message', { data: { type: 'APPLY_UPDATE' } }); expect(skipWaiting).toHaveBeenCalledOnce();
    await event('activate'); expect([...stores.keys()]).toEqual(['unrelated-cache', 'reboost-shell-previous', `reboost-shell-${version}`]); expect(openDatabase).not.toHaveBeenCalled();
  });
});
