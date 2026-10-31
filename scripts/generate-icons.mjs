import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#147d80"/><path d="m256 116 39 101 101 39-101 39-39 101-39-101-101-39 101-39Z" fill="none" stroke="#fff" stroke-width="17" stroke-linejoin="round"/><circle cx="256" cy="256" r="15" fill="#d5f6fa"/></svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/source.svg', svg);
for (const [size, file] of [[192, 'icons/icon-192.png'], [512, 'icons/icon-512.png'], [512, 'icons/maskable-512.png'], [180, 'apple-touch-icon.png'], [32, 'icons/favicon-32.png']]) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${file}`);
