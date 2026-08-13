// Draws the app icons — an amber crate on the belt — with no image deps.
// Run `npm run icons` after changing the artwork; the PNGs are committed.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

const GRAPHITE = [0x22, 0x28, 0x31];
const BELT_DARK = [0x11, 0x15, 0x1a];
const BELT_TREAD = [0x1a, 0x20, 0x29];
const BELT_EDGE = [0x41, 0x4c, 0x5b];
const AMBER = [0xff, 0xb5, 0x20];
const AMBER_DARK = [0xc8, 0x88, 0x0a];

/** `inset` is the fraction of the canvas kept clear for maskable safe zones. */
function draw(size, inset) {
  const px = new Uint8Array(size * size * 3);
  const fill = (x0, y0, x1, y1, rgb) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(size, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(size, Math.round(x1)); x++) {
        const i = (y * size + x) * 3;
        px[i] = rgb[0];
        px[i + 1] = rgb[1];
        px[i + 2] = rgb[2];
      }
    }
  };

  const scale = 1 - inset * 2;
  const s = (fraction) => size * (inset + fraction * scale);

  fill(0, 0, size, size, GRAPHITE);

  // Belt running top to bottom, with treads and steel edges.
  fill(s(0.3), 0, s(0.7), size, BELT_DARK);
  const tread = size * 0.06 * scale;
  for (let y = 0; y < size; y += tread * 2) {
    fill(s(0.3), y, s(0.7), y + tread, BELT_TREAD);
  }
  const edge = Math.max(2, size * 0.016);
  fill(s(0.3), 0, s(0.3) + edge, size, BELT_EDGE);
  fill(s(0.7) - edge, 0, s(0.7), size, BELT_EDGE);

  // The crate riding it.
  fill(s(0.32), s(0.34), s(0.68), s(0.66), AMBER_DARK);
  const b = size * 0.022 * scale;
  fill(s(0.32) + b, s(0.34) + b, s(0.68) - b, s(0.66) - b, AMBER);
  fill(s(0.32) + b, s(0.49), s(0.68) - b, s(0.51), AMBER_DARK);

  return px;
}

function png(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) | 0;
}

const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 0.14],
  ['apple-touch-icon.png', 180, 0.08],
];

mkdirSync(OUT, { recursive: true });
for (const [name, size, inset] of targets) {
  writeFileSync(resolve(OUT, name), png(size, draw(size, inset)));
  console.log(`wrote icons/${name}`);
}
