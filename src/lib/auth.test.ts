import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyPassword, createSessionCookie, clearSessionCookie,
  isValidSession, SESSION_COOKIE_NAME,
} from './auth';

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', 'hunter2');
  vi.stubEnv('SESSION_SECRET', 'topsecret');
  // other env vars not needed by auth paths under test
  vi.stubEnv('GITHUB_TOKEN', 'x'); vi.stubEnv('GITHUB_REPO', 'a/b');
  vi.stubEnv('GITHUB_BRANCH', 'main'); vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'c');
  vi.stubEnv('CLOUDINARY_API_KEY', 'k'); vi.stubEnv('CLOUDINARY_API_SECRET', 's');
});

describe('auth', () => {
  it('verifies correct password and rejects wrong', () => {
    expect(verifyPassword('hunter2')).toBe(true);
    expect(verifyPassword('nope')).toBe(false);
  });

  it('round-trips a valid session cookie', () => {
    const setCookie = createSessionCookie();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    const value = setCookie.split(';')[0]; // "mas_session=<token>"
    expect(isValidSession(value)).toBe(true);
  });

  it('rejects tampered or missing session', () => {
    expect(isValidSession(null)).toBe(false);
    expect(isValidSession(`${SESSION_COOKIE_NAME}=garbage.sig`)).toBe(false);
    // malformed token with no signature part
    expect(isValidSession(`${SESSION_COOKIE_NAME}=nosighere`)).toBe(false);
  });

  it('rejects an expired session cookie', () => {
    const value = createSessionCookie().split(';')[0];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days later
      expect(isValidSession(value)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clearSessionCookie expires the cookie', () => {
    expect(clearSessionCookie()).toMatch(/Max-Age=0|Expires=/);
  });
});
