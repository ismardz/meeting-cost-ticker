#!/usr/bin/env node
/**
 * Generates the extension icons (16/48/128 px) as PNG files.
 * Zero dependencies: writes a minimal valid PNG by hand.
 *
 * Usage: node icons/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

// 16x16 logical grid: green rounded square + white "$" glyph.
const GRID = 16;
const GLYPH = [
  '................',
  '.......##.......',
  '......####......',
  '.....##..##.....',
  '.....##..#......',
  '.....####.......',
  '......###.......',
  '.....####.......',
  '....##..##......',
  '....##...#......',
  '.....##.##......',
  '......###.......',
  '.......#........',
  '................',
  '................',
  '................',
];

function drawIcon() {
  const px = Buffer.alloc(GRID * GRID * 4);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 4;
      const dx = Math.min(x, GRID - 1 - x);
      const dy = Math.min(y, GRID - 1 - y);
      const inRoundedSquare = dx + dy >= 3; // simple rounded-corner mask
      const isGlyph = GLYPH[y][x] === '#';
      if (isGlyph) {
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
      } else if (inRoundedSquare) {
        px[i] = 34; px[i + 1] = 139; px[i + 2] = 87; px[i + 3] = 255;
      } else {
        px[i + 3] = 0;
      }
    }
  }
  return px;
}

function encodePng(size) {
  const pixels = drawIcon();
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter type: none
    const sy = Math.floor((y * GRID) / size);
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * GRID) / size);
      const i = (sy * GRID + sx) * 4;
      raw[o++] = pixels[i];
      raw[o++] = pixels[i + 1];
      raw[o++] = pixels[i + 2];
      raw[o++] = pixels[i + 3];
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  const file = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size));
  console.log(`Wrote ${file}`);
}
