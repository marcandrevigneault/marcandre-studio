import { describe, it, expect, vi } from 'vitest';
import { hashPassword, matchesPassword, validNewPassword } from './admin-security';
import { createSessionCookie, isValidSession, sessionRevision } from './auth';
describe('admin password storage', () => {
  it('salts passwords and checks the full secret', async () => {
    const a = await hashPassword('new-password-1234');
    const b = await hashPassword('new-password-1234');
    expect(a).not.toBe(b); expect(a).not.toContain('new-password');
    expect(await matchesPassword('new-password-1234', a)).toBe(true);
    expect(await matchesPassword('new-password-1235', a)).toBe(false);
    expect(await matchesPassword('new-password-1234', 'malformed')).toBe(false);
  });
  it('requires a usable bounded password without silently trimming', () => {
    expect(validNewPassword('short')).toBe(false);
    expect(validNewPassword(' '.repeat(16))).toBe(false);
    expect(validNewPassword('x'.repeat(257))).toBe(false);
    expect(validNewPassword('long-enough-password')).toBe(true);
  });
  it('signs the password revision into each session', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const cookie = createSessionCookie(true, 'version-one').split(';')[0];
    expect(isValidSession(cookie)).toBe(true);
    expect(sessionRevision(cookie)).toBe('version-one');
    expect(isValidSession(cookie.replace('version-one', 'version-two'))).toBe(false);
  });
});
