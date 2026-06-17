import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signUpload, deliveryUrl } from './cloudinary';

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'demo');
  vi.stubEnv('CLOUDINARY_API_KEY', '123');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'shh');
  vi.stubEnv('ADMIN_PASSWORD', 'p'); vi.stubEnv('SESSION_SECRET', 's');
  vi.stubEnv('GITHUB_TOKEN', 't'); vi.stubEnv('GITHUB_REPO', 'a/b');
  vi.stubEnv('GITHUB_BRANCH', 'main');
});

describe('cloudinary', () => {
  it('signUpload returns a deterministic signature for fixed inputs', () => {
    const a = signUpload({ folder: 'mas/photos', resourceType: 'image' });
    expect(a.apiKey).toBe('123');
    expect(a.cloudName).toBe('demo');
    expect(a.folder).toBe('mas/photos');
    expect(typeof a.signature).toBe('string');
    expect(a.signature.length).toBeGreaterThan(10);
  });

  it('deliveryUrl builds a transform URL', () => {
    expect(deliveryUrl('mas/photos/x', 'w_1600,f_auto,q_auto'))
      .toBe('https://res.cloudinary.com/demo/image/upload/w_1600,f_auto,q_auto/mas/photos/x');
  });
});
