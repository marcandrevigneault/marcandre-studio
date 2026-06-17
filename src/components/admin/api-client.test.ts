import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGalleries, saveGallery, renderPreview } from './api-client';

beforeEach(() => { vi.restoreAllMocks(); });

describe('api-client', () => {
  it('fetchGalleries GETs /api/galleries', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ slug: 'a' }]), { status: 200 }));
    const out = await fetchGalleries();
    expect(spy).toHaveBeenCalledWith('/api/galleries', expect.objectContaining({ method: 'GET' }));
    expect(out[0].slug).toBe('a');
  });

  it('saveGallery POSTs the gallery and throws on non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    await expect(saveGallery({ slug: 'x' } as any)).rejects.toThrow();
  });

  it('renderPreview throws on non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Error', { status: 500 }));
    await expect(renderPreview({ slug: 'x' } as any)).rejects.toThrow();
  });
});
