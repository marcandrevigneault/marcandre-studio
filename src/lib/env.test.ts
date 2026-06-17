import { describe, it, expect, afterEach, vi } from 'vitest';
import { getEnv } from './env';

const FULL = {
  ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'sec',
  GITHUB_TOKEN: 'tok', GITHUB_REPO: 'me/repo', GITHUB_BRANCH: 'main',
  CLOUDINARY_CLOUD_NAME: 'cn', CLOUDINARY_API_KEY: 'ak', CLOUDINARY_API_SECRET: 'as',
};

afterEach(() => vi.unstubAllEnvs());

describe('getEnv', () => {
  it('returns typed config when all vars present', () => {
    for (const [k, v] of Object.entries(FULL)) vi.stubEnv(k, v);
    const env = getEnv();
    expect(env.githubRepo).toBe('me/repo');
    expect(env.cloudinaryApiSecret).toBe('as');
  });

  it('throws listing every missing key', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    expect(() => getEnv()).toThrow(/GITHUB_TOKEN/);
  });
});
