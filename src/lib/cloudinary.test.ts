import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { signUpload, deliveryUrl, listAudio } from './cloudinary';

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

  it('listAudio returns mapped audio resources', async () => {
    const executeStub = vi.fn().mockResolvedValue({
      resources: [
        { secure_url: 'https://res.cloudinary.com/demo/video/upload/mas/audio/track1.mp3', public_id: 'mas/audio/track1' },
      ],
    });
    const max_resultsStub = vi.fn().mockReturnValue({ execute: executeStub });
    const expressionStub = vi.fn().mockReturnValue({ max_results: max_resultsStub });
    vi.spyOn(cloudinary.search, 'expression').mockImplementation(expressionStub);

    const result = await listAudio();
    expect(result).toEqual([
      { src: 'https://res.cloudinary.com/demo/video/upload/mas/audio/track1.mp3', title: 'track1' },
    ]);
    expect(expressionStub).toHaveBeenCalledWith('folder:mas/audio');
    expect(max_resultsStub).toHaveBeenCalledWith(100);
    expect(executeStub).toHaveBeenCalled();
  });

  it('listAudio returns empty array when resources is absent', async () => {
    const executeStub = vi.fn().mockResolvedValue({});
    const max_resultsStub = vi.fn().mockReturnValue({ execute: executeStub });
    const expressionStub = vi.fn().mockReturnValue({ max_results: max_resultsStub });
    vi.spyOn(cloudinary.search, 'expression').mockImplementation(expressionStub);

    const result = await listAudio();
    expect(result).toEqual([]);
  });
});
