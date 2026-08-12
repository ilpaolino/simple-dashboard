import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imagesDir = join(root, 'assets', 'images');

mkdirSync(imagesDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function createPng(width, height, rgb) {
  const [r, g, b] = rgb;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 3;
    row[offset] = r;
    row[offset + 1] = g;
    row[offset + 2] = b;
  }

  const raw = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y += 1) {
    row.copy(raw, y * row.length);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const brand = [0x1f, 0x4b, 0x5c];

writeFileSync(join(imagesDir, 'small.png'), createPng(250, 175, brand));
writeFileSync(join(imagesDir, 'large.png'), createPng(500, 350, brand));
writeFileSync(join(imagesDir, 'xlarge.png'), createPng(1000, 700, brand));

const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Welcome Wall">
  <rect width="100" height="100" rx="18" fill="#1F4B5C"/>
  <rect x="18" y="24" width="64" height="42" rx="4" fill="none" stroke="#F4F7F8" stroke-width="4"/>
  <rect x="38" y="70" width="24" height="6" rx="2" fill="#F4F7F8"/>
</svg>
`;

writeFileSync(join(root, 'assets', 'icon.svg'), iconSvg);
console.log('Generated Homey app assets.');
