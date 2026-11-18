import { FFmpeg } from '@ffmpeg/ffmpeg';
import { MAX_VIDEO_BYTES } from './packet';

export type CompressionOptions = { start: number; duration: number; width: number; fps: number; audioKbps: number; colorMode?: 'color' | 'grayscale'; colorLevels?: 0 | 2 | 4 | 8; volume?: number; saturation?: number };
export const MAX_INPUT_BYTES = 100 * 1024 * 1024;
export const MAX_DURATION = 10;
type Job = { engine: FFmpeg; cancelled: boolean };
let active: Job | undefined;
const abort = () => new DOMException('Media job cancelled.', 'AbortError');
export function cancelMedia(): void {
  if (active) { active.cancelled = true; active.engine.terminate(); active = undefined; }
}
function validate(options: CompressionOptions): void {
  if (![options.start, options.duration, options.width, options.fps, options.audioKbps].every(Number.isFinite) || options.start < 0 || options.duration <= 0 || options.duration > MAX_DURATION ||
      !Number.isInteger(options.width) || options.width < 16 || options.width > 640 || options.width % 2 !== 0 ||
      options.fps < 1 || options.fps > 30 || options.audioKbps < 0 || options.audioKbps > 128 ||
      (options.colorMode !== undefined && !['color', 'grayscale'].includes(options.colorMode)) ||
      (options.saturation !== undefined && (!Number.isFinite(options.saturation) || options.saturation < 0 || options.saturation > 2)) ||
      (options.colorLevels !== undefined && ![0, 2, 4, 8].includes(options.colorLevels)) ||
      (options.volume !== undefined && (!Number.isFinite(options.volume) || options.volume < 0 || options.volume > 1))) {
    throw new Error('Invalid settings: duration ≤10s, even width 16–640px, fps 1–30, audio 0–128 kbps, nonnegative start.');
  }
}
async function transcode(input: () => Promise<Uint8Array>, args: string[], output: string, onProgress?: (message: string) => void): Promise<Uint8Array> {
  cancelMedia();
  const job: Job = {engine:new FFmpeg(),cancelled:false};
  active = job;
  const check = () => { if (job.cancelled || active !== job) throw abort(); };
  const progress = ({progress}: {progress:number}) => {
    if (!job.cancelled && active === job && Number.isFinite(progress)) onProgress?.(`Encoding… ${Math.max(0,Math.min(99,Math.round(progress*100)))}%`);
  };
  try {
    onProgress?.('Loading local video engine…');
    job.engine.on('progress',progress);
    // Assets copied from the installed single-thread @ffmpeg/core, never a CDN.
    // document.baseURI retains the nested deployment path and Capacitor local scheme.
    const base = new URL('./ffmpeg/', document.baseURI);
    await job.engine.load({coreURL:new URL('ffmpeg-core.js',base).href,wasmURL:new URL('ffmpeg-core.wasm',base).href});
    check();
    const data = await input(); check();
    await job.engine.writeFile('input',data); check();
    onProgress?.('Encoding locally…');
    const code = await job.engine.exec(args,120_000); check();
    if (code !== 0) throw new Error(`Video encoding failed (FFmpeg exit ${code}). Try a shorter or smaller clip.`);
    const result = await job.engine.readFile(output); check();
    if (typeof result === 'string' || result.length === 0 || result.length > MAX_VIDEO_BYTES) throw new Error('Encoded video is empty or exceeds 8 MiB. Try a shorter or smaller clip.');
    return new Uint8Array(result);
  } catch (error) {
    if (job.cancelled) throw abort();
    throw error instanceof Error ? error : new Error(`Video processing failed: ${String(error)}`);
  } finally {
    job.engine.off('progress',progress);
    // A worker per job makes all paths (including nonzero exec, loading failure,
    // and cancellation) discard the virtual FS and WASM heap. No stale output.
    job.engine.terminate();
    if (active === job) active = undefined;
  }
}
export async function compressVideo(file: File, options: CompressionOptions, onProgress?: (message: string) => void): Promise<Uint8Array> {
  validate(options);
  if (file.size < 1 || file.size > MAX_INPUT_BYTES) throw new Error('Choose a nonempty video no larger than 100 MiB.');
  const audio = options.audioKbps === 0 || options.volume === 0 ? ['-an'] : ['-map','0:a:0?','-c:a','libopus','-b:a',`${options.audioKbps}k`,'-ac','1', ...(options.volume === undefined || options.volume === 1 ? [] : ['-af', `volume=${options.volume}`]),
    // Tiny speech clips need fewer Opus packets and a narrow audio bandwidth.
    // This avoids spending most of a single QR on packet overhead.
    ...(options.audioKbps <= 8 ? ['-ar','8000','-application','voip','-frame_duration','60','-vbr','off'] : [])];
  const filters = [`scale=${options.width}:-2`, `fps=${options.fps}`];
  if (options.colorMode === 'grayscale') filters.push('hue=s=0');
  else if (options.saturation !== undefined && options.saturation !== 1) filters.push(`hue=s=${options.saturation}`);
  if (options.colorLevels) {
    const step = 255 / (options.colorLevels - 1);
    const expression = `round(val/${step})*${step}`;
    filters.push(`lutrgb=r='${expression}':g='${expression}':b='${expression}'`);
  }
  return transcode(async () => new Uint8Array(await file.arrayBuffer()), [
    '-ss',String(options.start),'-i','input','-t',String(options.duration),
    '-map','0:v:0','-vf',filters.join(','),
    '-c:v','libvpx','-crf','50','-b:v','0','-deadline','realtime','-cpu-used','8','-threads','1',
    ...audio,'-map_metadata','-1','-f','webm','output.webm',
  ],'output.webm',onProgress);
}
export async function playableVideo(data: Uint8Array): Promise<Blob> {
  if (data.length < 1 || data.length > MAX_VIDEO_BYTES) throw new Error('Video must contain 1 byte to 8 MiB.');
  const snapshot = new Uint8Array(data);
  // Also supersede pending compression when playback needs no conversion.
  cancelMedia();
  if (document.createElement('video').canPlayType('video/webm; codecs="vp8,opus"')) return new Blob([snapshot],{type:'video/webm'});
  const mp4 = await transcode(async () => snapshot, [
    '-i','input','-t','10','-map','0:v:0','-map','0:a:0?',
    '-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','ultrafast','-crf','28',
    '-pix_fmt','yuv420p','-threads','1','-c:a','aac','-b:a','64k','-movflags','+faststart','output.mp4',
  ],'output.mp4');
  return new Blob([new Uint8Array(mp4)],{type:'video/mp4'});
}
