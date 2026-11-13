import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

// User-supplied artwork. Keep the source unchanged and normalize only the outer
// dark presentation background so OS icon masks do not expose black corners.
const source = new URL('../public/icons/source.png', import.meta.url);
const { data, info } = await sharp(fileURLToPath(source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const seen = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0, tail = 0;
function enqueue(index) {
  if (seen[index]) return;
  seen[index] = 1;
  const offset = index * channels;
  if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 96) queue[tail++] = index;
}
for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
while (head < tail) {
  const index = queue[head++], x = index % width, y = Math.floor(index / width), offset = index * channels;
  data[offset] = data[offset + 1] = data[offset + 2] = 255;
  if (x) enqueue(index - 1);
  if (x < width - 1) enqueue(index + 1);
  if (y) enqueue(index - width);
  if (y < height - 1) enqueue(index + width);
}
// Remove the presentation margin; keep the entire rounded white tile and motif.
const inset = Math.round(Math.min(width, height) * .06);
const artwork = await sharp(data, { raw: info }).extract({ left: inset, top: inset, width: width - inset * 2, height: height - inset * 2 }).png().toBuffer();
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
for (const [size, file] of [[192, 'icons/icon-192.png'], [512, 'icons/icon-512.png'], [180, 'apple-touch-icon.png'], [32, 'icons/favicon-32.png']]) {
  await sharp(artwork).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${file}`, import.meta.url)));
}
// Additional breathing room keeps the circular arrow inside Android's safe zone.
const maskable = await sharp(artwork).resize(440, 440).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } })
  .composite([{ input: maskable, left: 36, top: 36 }]).png().toFile(fileURLToPath(new URL('../public/icons/maskable-512.png', import.meta.url)));
