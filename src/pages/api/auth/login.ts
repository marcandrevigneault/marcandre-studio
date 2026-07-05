import type { APIRoute } from 'astro';
import { verifyPassword, createSessionCookie, isSecureRequest } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  for (const key of ['ADMIN_PASSWORD', 'SESSION_SECRET']) {
    if (!process.env[key]) {
      return new Response(
        JSON.stringify({ ok: false, error: `Server not configured: ${key} is unset.` }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
    }
  }

  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!verifyPassword(String(password ?? ''))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': createSessionCookie(isSecureRequest(request)) },
  });
};
