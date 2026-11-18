import { createHmac } from 'node:crypto';
import { isValidSession, sessionRevision } from './auth';
export type Credential = { hash: string; revision: string };
export const adminConfigured = () => !!(process.env.STUDIO_ADMIN_URL && process.env.STUDIO_ADMIN_KEY);
export async function adminService<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  if (!adminConfigured()) throw new Error('Admin service not configured');
  const response = await fetch(`${process.env.STUDIO_ADMIN_URL}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { authorization: `Bearer ${process.env.STUDIO_ADMIN_KEY}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Object.assign(new Error('Admin service unavailable'), { status: response.status });
  return response.json() as Promise<T>;
}
export const credentials = () => adminService<Credential>('/credentials');
export async function currentSession(cookie: string | null): Promise<boolean> {
  if (!isValidSession(cookie)) return false;
  if (!adminConfigured()) return true;
  return sessionRevision(cookie) === (await credentials()).revision;
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
export async function allowPasswordAttempt(request: Request): Promise<boolean> {
  if (!adminConfigured()) return true;
  // Vercel sets this header; no raw network address leaves the server.
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0] ?? 'local';
  const key = createHmac('sha256', process.env.STUDIO_ADMIN_KEY!).update(ip).digest('hex');
  return (await adminService<{ allowed: boolean }>('/attempt', { key })).allowed;
}
