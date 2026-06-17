import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';

export const SESSION_COOKIE_NAME = 'mas_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyPassword(input: string): boolean {
  return safeEqual(input, getEnv().adminPassword);
}

export function createSessionCookie(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(exp);
  const token = `${payload}.${sign(payload, getEnv().sessionSecret)}`;
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isValidSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(SESSION_COOKIE_NAME.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, getEnv().sessionSecret))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}
