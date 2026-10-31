import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const config = JSON.parse(await readFile('src/pwa/config.json', 'utf8'));
async function files(dir) { const rows = await readdir(dir, { withFileTypes: true }); return (await Promise.all(rows.map(row => row.isDirectory() ? files(path.join(dir, row.name)) : path.join(dir, row.name)))).flat(); }
const assets = (await files('.next/static')).filter(file => /\.(?:js|css|woff2?|ttf)$/.test(file)).map(file => '/' + file.replace(/^\.next\//, '_next/'));
const precache = [...config.staticPages, '/manifest.webmanifest', ...config.icons, ...assets.sort()];
const template = await readFile('src/pwa/sw-template.js', 'utf8');
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
const version = createHash('sha256').update(buildId + template + JSON.stringify(precache)).digest('hex').slice(0, 16);
const worker = template.replace('__REBOOST_VERSION__', JSON.stringify(version)).replace('__REBOOST_PRECACHE__', JSON.stringify(precache)).replace('__REBOOST_PAGES__', JSON.stringify(config.staticPages)).replace('__REBOOST_DYNAMIC__', JSON.stringify(config.dynamicPattern));
await writeFile('public/sw.js', worker);
await writeFile('public/pwa-assets.json', JSON.stringify({ version, buildId, precache }, null, 2));
console.log(`PWA generated: ${version}, ${precache.length} public shells/assets`);
