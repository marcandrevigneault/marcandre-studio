import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/github', () => ({
  listGalleries: vi.fn().mockResolvedValue([]),
  writeGallery: vi.fn().mockResolvedValue(undefined),
  getGallery: vi.fn(),
  deleteGallery: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from '../../../pages/api/galleries/index';
import { writeGallery } from '../../../lib/github';

const VALID = {
  slug: 'alps', title: 'Alps', date: '2026-06-01', summary: 's', cover: 'c',
  draft: false, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  images: [{ src: 'x', alt: 'a', span: 'single' }], body: '',
};

function req(body: any) {
  return new Request('http://localhost/api/galleries', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('galleries API', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('GET returns the list', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST writes a valid gallery', async () => {
    const res = await POST({ request: req(VALID) } as any);
    expect(res.status).toBe(200);
    expect(writeGallery).toHaveBeenCalledOnce();
  });

  it('POST rejects invalid gallery (missing title) with 400', async () => {
    const res = await POST({ request: req({ ...VALID, title: '' }) } as any);
    expect(res.status).toBe(400);
  });
});
