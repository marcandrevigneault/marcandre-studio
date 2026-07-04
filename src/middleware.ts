import { defineMiddleware } from 'astro:middleware';
import { isValidSession, sessionExpiry, createSessionCookie, isSecureRequest } from './lib/auth';

const SESSION_REFRESH_THRESHOLD_SECONDS = 15 * 24 * 60 * 60; // half the 30-day session lifetime

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const cookie = context.request.headers.get('cookie');
  const authed = isValidSession(cookie);

  const isLoginPage = pathname === '/admin/login';
  const isLoginApi = pathname === '/api/auth/login';

  if (pathname.startsWith('/api/') && !isLoginApi && !authed) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  if (pathname.startsWith('/admin') && !isLoginPage && !authed) {
    return context.redirect('/admin/login');
  }

  const response = await next();

  // Sliding session refresh: on an authenticated admin page view, re-issue the
  // cookie once it's past its halfway point so active users never get logged out.
  if (pathname.startsWith('/admin') && !isLoginPage && context.request.method === 'GET') {
    const remaining = sessionExpiry(cookie);
    if (remaining !== null && remaining < SESSION_REFRESH_THRESHOLD_SECONDS) {
      response.headers.append('set-cookie', createSessionCookie(isSecureRequest(context.request)));
    }
  }

  return response;
});
