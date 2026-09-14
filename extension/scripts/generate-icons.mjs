import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const iconDirectory = join(currentDirectory, "..", "icons");

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function pixel(size, x, y) {
  const center = (size - 1) / 2;
  const distance = Math.hypot(x - center, y - center) / size;
  if (distance > 0.48) {
    return [0, 0, 0, 0];
  }
  if (distance > 0.365 && distance < 0.435) {
    return [56, 220, 255, 255];
  }
  if (distance < 0.205) {
    const blend = Math.min(1, distance / 0.205);
    return [
      Math.round(180 - blend * 53),
      Math.round(168 + blend * 65),
      255,
      255,
    ];
  }
  const glow = Math.max(0, 1 - Math.abs(distance - 0.3) / 0.13);
  return [
    Math.round(7 + glow * 8),
    Math.round(10 + glow * 23),
    Math.round(17 + glow * 32),
    255,
  ];
}

function createPng(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue, alpha] = pixel(size, x, y);
      const offset = rowOffset + 1 + x * 4;
      scanlines[offset] = red;
      scanlines[offset + 1] = green;
      scanlines[offset + 2] = blue;
      scanlines[offset + 3] = alpha;
    }
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(iconDirectory, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await writeFile(
    join(iconDirectory, `rehearsal-${size}.png`),
    createPng(size),
  );
}
