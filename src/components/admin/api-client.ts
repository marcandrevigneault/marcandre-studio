import type { Gallery } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function text(res: Response): Promise<string> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.text();
}

export const fetchGalleries = () =>
  fetch('/api/galleries', { method: 'GET' }).then((r) => json<Gallery[]>(r));

export const fetchGallery = (slug: string) =>
  fetch(`/api/galleries/${slug}`, { method: 'GET' }).then((r) => json<Gallery>(r));

export const saveGallery = (g: Gallery) =>
  fetch('/api/galleries', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(g),
  }).then((r) => json<{ ok: boolean; slug: string }>(r));

export const deleteGallery = (slug: string) =>
  fetch(`/api/galleries/${slug}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r));

export const signUpload = (folder: 'mas/photos' | 'mas/audio', resourceType: 'image' | 'video') =>
  fetch('/api/upload/sign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder, resourceType }),
  }).then((r) => json<{ timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string; resourceType: string }>(r));

export const renderPreview = (g: Gallery) =>
  fetch('/api/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(g),
  }).then((r) => text(r));
