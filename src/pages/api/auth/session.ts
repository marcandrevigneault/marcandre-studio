import type { APIRoute } from 'astro';
import { isValidSession } from '../../../lib/auth';
export const prerender = false;
export const GET: APIRoute = ({ request }) => new Response(JSON.stringify({ authenticated: isValidSession(request.headers.get('cookie')) }), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
