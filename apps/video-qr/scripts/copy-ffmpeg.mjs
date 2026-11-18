import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(resolve(root, 'public/ffmpeg'), { recursive: true });
for (const name of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(resolve(root, 'node_modules/@ffmpeg/core/dist/esm', name), resolve(root, 'public/ffmpeg', name));
}
