import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../apps/video-qr/dist/', import.meta.url);
const target = new URL('../public/tools/video-qr/', import.meta.url);
// Check the build before replacing the previous staged app.
await readFile(new URL('index.html', source));
await mkdir(new URL('../public/tools/', import.meta.url), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
console.log(`Staged Video QR at ${fileURLToPath(target)}`);
