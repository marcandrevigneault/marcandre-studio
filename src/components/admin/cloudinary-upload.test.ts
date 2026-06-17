import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadToCloudinary } from './cloudinary-upload';

beforeEach(() => vi.restoreAllMocks());

describe('uploadToCloudinary', () => {
  it('signs then uploads and returns url + publicId', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        timestamp: 1, signature: 'sig', apiKey: 'ak', cloudName: 'demo',
        folder: 'mas/photos', resourceType: 'image',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/mas/photos/x.jpg',
        public_id: 'mas/photos/x',
      }), { status: 200 }));

    const file = new File(['data'], 'x.jpg', { type: 'image/jpeg' });
    const out = await uploadToCloudinary(file, 'mas/photos', 'image');

    expect(out.publicId).toBe('mas/photos/x');
    expect(out.url).toContain('res.cloudinary.com');
    // Second call hits Cloudinary's upload endpoint.
    expect(fetchSpy.mock.calls[1][0]).toContain('api.cloudinary.com/v1_1/demo/image/upload');
  });
});
