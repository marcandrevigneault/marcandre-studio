import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnvVar } from './env';

export const SESSION_COOKIE_NAME = 'mas_session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function cookie(name: string, token: string, maxAge: number, isSecure: boolean): string {
  const parts = [`${name}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAge}`];
  if (isSecure) parts.splice(1, 0, 'Secure');
  return parts.join('; ');
}

export function verifyPassword(input: string): boolean {
  return safeEqual(input, requireEnvVar('ADMIN_PASSWORD'));
}

export function createSessionCookie(isSecure: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(exp);
  const token = `${payload}.${sign(payload, requireEnvVar('SESSION_SECRET'))}`;
  return cookie(SESSION_COOKIE_NAME, token, MAX_AGE_SECONDS, isSecure);
}

export function clearSessionCookie(isSecure: boolean): string {
  return cookie(SESSION_COOKIE_NAME, '', 0, isSecure);
}

export function isValidSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(SESSION_COOKIE_NAME.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, requireEnvVar('SESSION_SECRET')))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}

/** Remaining lifetime, in seconds, of a valid session — or null if invalid. */
export function sessionExpiry(cookieHeader: string | null): number | null {
  if (!isValidSession(cookieHeader)) return null;
  const match = cookieHeader!.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!;
  const payload = match.slice(SESSION_COOKIE_NAME.length + 1).split('.')[0];
  return Number(payload) - Math.floor(Date.now() / 1000);
}

/** True when the request arrived over HTTPS (behind Vercel's proxy or direct). */
export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return true;
  return request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}
