import type { APIRoute } from 'astro';
import { verifyPassword, createSessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!verifyPassword(String(password ?? ''))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': createSessionCookie() },
  });
};
