// Run with Node 24+ after installing apps/video-qr dependencies.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { packVideo, PacketCollector } from '../apps/video-qr/src/packet.ts';
const require = createRequire(new URL('../apps/video-qr/package.json', import.meta.url));
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const input = new Uint8Array(await readFile(new URL('../apps/video-qr/public/examples/demo.webm', import.meta.url)));
const packets = await packVideo(input);
assert.equal(packets.length, 1, 'Example must fit one QR');
const png = await QRCode.toBuffer([{data: Buffer.from(packets[0]), mode:'byte'}], {
  version:40, errorCorrectionLevel:'L', margin:4, scale:3,
});
const bitmap = PNG.sync.read(png);
const scan = jsQR(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height);
assert.ok(scan, 'Generated PNG must scan');
const result = await new PacketCollector().add(new Uint8Array(scan.binaryData));
assert.deepEqual(result.complete, input, 'Scanned PNG must recover exact video bytes');
for (const path of ['../apps/video-qr/public/examples/demo-qr.png','../public/examples/video-qr/demo-qr.png']) {
  await writeFile(new URL(path, import.meta.url), png);
}
console.log(`Verified QR image → ${input.length} identical video bytes (${packets[0].length}-byte packet).`);
