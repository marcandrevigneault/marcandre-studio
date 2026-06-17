import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './login';

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', 'hunter2');
  vi.stubEnv('SESSION_SECRET', 'secret');
});

function req(body: any) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('sets a cookie on correct password', async () => {
    const res = await POST({ request: req({ password: 'hunter2' }) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('mas_session=');
  });

  it('rejects wrong password with 401 and no cookie', async () => {
    const res = await POST({ request: req({ password: 'nope' }) } as any);
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
