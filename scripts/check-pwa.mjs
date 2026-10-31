import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:3105';
const html = await (await fetch(new URL('/', base))).text();
assert.ok(html.includes('href="/manifest.webmanifest"') && html.includes('rel="manifest"'));
assert.ok(html.includes('mobile-web-app-capable') && html.includes('/apple-touch-icon.png'));
const manifestResponse = await fetch(new URL('/manifest.webmanifest', base));
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
for (const key of ['name', 'short_name']) assert.equal(manifest[key], 'ReBoost');
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/'); assert.equal(manifest.start_url, '/');
for (const [path, size] of [['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512], ['/icons/maskable-512.png', 512], ['/apple-touch-icon.png', 180]]) {
  const response = await fetch(new URL(path, base)); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
}
const sw = await fetch(new URL('/sw.js', base)); assert.equal(sw.status, 200); assert.match(sw.headers.get('content-type'), /javascript/); assert.match(sw.headers.get('cache-control'), /no-store/); assert.equal(sw.headers.get('service-worker-allowed'), '/');
const assets = await (await fetch(new URL('/pwa-assets.json', base))).json();
for (let start = 0; start < assets.precache.length; start += 6) await Promise.all(assets.precache.slice(start, start + 6).map(async path => {
  assert.ok(!path.startsWith('/api/') && !path.includes('_rsc'));
  const result = await fetch(new URL(path, base), { credentials: 'omit' }); assert.equal(result.status, 200, path); assert.equal(result.redirected, false, path); assert.ok(!/no-store|private/.test(result.headers.get('cache-control') ?? ''), path); await result.arrayBuffer();
}));
console.log(JSON.stringify({ manifest: 'pass', iconSizes: [192, 512, 180], serviceWorkerHeaders: 'pass', publicAssets: assets.precache.length, version: assets.version }, null, 2));
