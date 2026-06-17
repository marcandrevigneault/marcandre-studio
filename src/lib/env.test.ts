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
    expect(env.adminPassword).toBe('pw');
    expect(env.sessionSecret).toBe('sec');
    expect(env.githubToken).toBe('tok');
    expect(env.githubRepo).toBe('me/repo');
    expect(env.githubBranch).toBe('main');
    expect(env.cloudinaryCloudName).toBe('cn');
    expect(env.cloudinaryApiKey).toBe('ak');
    expect(env.cloudinaryApiSecret).toBe('as');
  });

  it('throws a single error listing every missing key', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    const err = (() => { try { getEnv(); return null; } catch (e) { return e as Error; } })();
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toMatch(/SESSION_SECRET/);
    expect(err!.message).toMatch(/GITHUB_TOKEN/);
    expect(err!.message).toMatch(/CLOUDINARY_API_SECRET/);
  });
});
