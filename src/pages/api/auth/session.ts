import type { APIRoute } from 'astro';
import { currentSession } from '../../../lib/admin-service';
export const prerender = false;
export const GET: APIRoute = async ({ request }) => new Response(JSON.stringify({ authenticated: await currentSession(request.headers.get('cookie')) }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
