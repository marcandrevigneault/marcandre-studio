import { HEADER_BYTES, MAX_PACKET_BYTES } from './packet';
export const VIDEO_BUDGET = MAX_PACKET_BYTES - HEADER_BYTES;
export type FilmSettings = { duration: number; width: number; fps: number; audioKbps: number };
// WebM overhead and content complexity vary. This is a responsive estimate only;
// the generator must measure the encoded bytes before offering a QR.
export function estimateBytes(s: FilmSettings): number {
  return Math.ceil(650 + s.duration * (s.audioKbps * 125 + s.width * s.width * .065 * s.fps));
}
function reduce(s: FilmSettings, key: keyof FilmSettings): FilmSettings | null {
  const next = { ...s };
  if (key === 'width' && s.width > 16) next.width = Math.max(16, s.width - 4);
  else if (key === 'fps' && s.fps > 1) next.fps--;
  else if (key === 'duration' && s.duration > .5) next.duration = Math.max(.5, s.duration - .5);
  else if (key === 'audioKbps' && s.audioKbps > 0) next.audioKbps = Math.max(0, s.audioKbps - 2);
  else return null;
  return next;
}
export function fitEstimate(settings: FilmSettings, changed: keyof FilmSettings): FilmSettings {
  let result = { ...settings };
  const keys: (keyof FilmSettings)[] = ['width', 'fps', 'duration', 'audioKbps'];
  const order = [...keys.filter(key => key !== changed), changed];
  for (const key of order) {
    while (estimateBytes(result) > VIDEO_BUDGET * .9) {
      const smaller = reduce(result, key);
      if (!smaller) break;
      result = smaller;
    }
  }
  return result;
}
export function nextSmaller(s: FilmSettings): FilmSettings | null {
  // Coarse steps keep measured fitting bounded while retaining requested audio
  // until image detail, frame rate, and duration have reached their minima.
  if (s.width > 16) return { ...s, width: Math.max(16, Math.floor(s.width * .7 / 2) * 2) };
  if (s.fps > 1) return { ...s, fps: Math.max(1, Math.floor(s.fps / 2)) };
  if (s.duration > .5) return { ...s, duration: Math.max(.5, Math.floor(s.duration * .65 * 2) / 2) };
  return reduce(s, 'audioKbps');
}
