import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// WASM workers cannot run in Node. Only the external engine is replaced;
// media.ts validation, scheduling, cancellation and cleanup run unchanged.
const engine = vi.hoisted(() => ({ exit: 0, output: new Uint8Array([1,2,3]), instances: [] as any[], loadGate: undefined as Promise<void> | undefined }));
vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: class {
  terminated = false; files = new Map(); args: string[] = []; loadedURLs: any;
  constructor() { engine.instances.push(this); }
  on() {} off() {}
  async load(urls: unknown) { this.loadedURLs = urls; await engine.loadGate; }
  async writeFile(name: string, data: Uint8Array) { this.files.set(name, data); }
  async exec(args: string[]) { this.args = args; return engine.exit; }
  async readFile() { return engine.output; }
  terminate() { this.terminated = true; this.files.clear(); }
} }));
import { compressVideo, playableVideo, cancelMedia } from '../src/media';
const options = {start:0,duration:2,width:96,fps:6,audioKbps:12};
const file = () => new File([new Uint8Array([1,2])], 'clip.mp4', {type:'video/mp4'});
beforeEach(() => {
  engine.exit = 0; engine.output = new Uint8Array([1,2,3]); engine.instances.length = 0; engine.loadGate = undefined;
  vi.stubGlobal('document', {baseURI:'https://localhost/tools/video-qr/', createElement: () => ({canPlayType: () => 'probably'})});
});
afterEach(() => { cancelMedia(); vi.unstubAllGlobals(); });
it('compresses using local assets and releases the worker and input on success', async () => {
  expect(await compressVideo(file(),options)).toEqual(new Uint8Array([1,2,3]));
  const e = engine.instances[0]; expect(e.terminated).toBe(true); expect(e.files.size).toBe(0);
  expect(e.loadedURLs.coreURL).toBe('https://localhost/tools/video-qr/ffmpeg/ffmpeg-core.js');
  expect(e.loadedURLs.wasmURL).toBe('https://localhost/tools/video-qr/ffmpeg/ffmpeg-core.wasm');
  expect(e.args).toContain('libvpx'); expect(e.args).toContain('libopus');
});
it('rejects ffmpeg nonzero exits and releases failed workers before a retry', async () => {
  engine.exit = 1; await expect(compressVideo(file(),options)).rejects.toThrow(/failed|exit/i);
  expect(engine.instances[0].terminated).toBe(true); engine.exit = 0;
  expect(await compressVideo(file(),options)).toEqual(new Uint8Array([1,2,3]));
});
it('suppresses stale jobs cancelled during load without killing their replacement', async () => {
  let release!: () => void; engine.loadGate = new Promise<void>(r => release=r);
  const old = compressVideo(file(),options); const oldRejected = expect(old).rejects.toThrow(/cancel/i);
  engine.loadGate = undefined;
  const latest = compressVideo(file(),options); release();
  await oldRejected; expect(await latest).toEqual(new Uint8Array([1,2,3]));
  expect(engine.instances.every(e => e.terminated)).toBe(true);
});
it('cancelMedia rejects pending work', async () => {
  let release!: () => void; engine.loadGate = new Promise<void>(r => release=r);
  const pending = compressVideo(file(),options); cancelMedia(); release();
  await expect(pending).rejects.toThrow(/cancel/i);
});
it.each([{duration:0},{duration:11},{start:-1},{fps:NaN},{fps:0},{width:0},{audioKbps:-1}])('rejects invalid options %j before loading WASM', async invalid => {
  await expect(compressVideo(file(),{...options,...invalid})).rejects.toThrow(); expect(engine.instances).toHaveLength(0);
});
it('rejects empty/oversized inputs and output', async () => {
  await expect(compressVideo(new File([], 'empty'),options)).rejects.toThrow();
  await expect(compressVideo({size:104857601} as File,options)).rejects.toThrow();
  engine.output = new Uint8Array(8388609); await expect(compressVideo(file(),options)).rejects.toThrow();
  expect(engine.instances[0].terminated).toBe(true);
});
it('returns WebM directly when supported without invoking WASM', async () => {
  const blob = await playableVideo(new Uint8Array([1,2,3]));
  expect(blob.type).toBe('video/webm'); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
  expect(engine.instances).toHaveLength(0);
});
it('converts unsupported WebM to MP4 and checks exec failure', async () => {
  vi.stubGlobal('document', {baseURI:'capacitor://localhost/',createElement: () => ({canPlayType: () => ''})});
  expect((await playableVideo(new Uint8Array([1,2,3]))).type).toBe('video/mp4');
  expect(engine.instances[0].args).toContain('libx264'); expect(engine.instances[0].terminated).toBe(true);
  engine.exit=1; await expect(playableVideo(new Uint8Array([1,2,3]))).rejects.toThrow();
});
