import { defineMiddleware } from 'astro:middleware';
import { isValidSession } from './lib/auth';

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
  return next();
});
