import type { APIRoute } from 'astro';
import { isValidSession } from '../../../lib/auth';
import { originalArticle } from '../../../lib/article-content';
import { articleStore } from '../../../lib/article-store';
import { ArticleEditError, renderArticleMarkdown, validateArticleEdit, type ArticleLanguage } from '../../../lib/article-editing';

export const prerender = false;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
function access(request: Request, slug: string | undefined) {
  if (!isValidSession(request.headers.get('cookie'))) throw new ArticleEditError('Please sign in to edit.', 401);
  const language = new URL(request.url).searchParams.get('lang') as ArticleLanguage;
  if (!slug || !['fr', 'en'].includes(language)) throw new ArticleEditError('Unknown article or language.', 404);
  const original = originalArticle(slug, language);
  if (!original) throw new ArticleEditError('Unknown article.', 404);
  return { slug, language, original };
}
function failure(error: unknown) {
  if (error instanceof ArticleEditError) return json({ error: error.message }, error.status);
  console.error('Article editor request failed:', error instanceof Error ? error.name : 'Unknown error');
  return json({ error: 'Publishing service unavailable. Your draft has not been discarded. Please try again.' }, 503);
}
export const GET: APIRoute = async ({ request, params }) => {
  try {
    const { slug, language, original } = access(request, params.slug);
    const saved = await articleStore().read(slug, language);
    return json(saved ?? { ...original, sha: null });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async ({ request, params }) => {
  try {
    const { slug, language } = access(request, params.slug);
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new ArticleEditError('Invalid request origin.', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ArticleEditError('Expected JSON.', 415);
    if (Number(request.headers.get('content-length')) > 700000) throw new ArticleEditError('Article is too large.', 413);
    const raw = await request.text();
    if (raw.length > 700000) throw new ArticleEditError('Article is too large.', 413);
    let payload: any;
    try { payload = JSON.parse(raw); } catch { throw new ArticleEditError('Invalid JSON.'); }
    const article = validateArticleEdit(payload);
    const html = await renderArticleMarkdown(article.body);
    if (payload.action === 'preview') return json({ html });
    if (payload.action !== 'publish' || !(payload.sha === null || (typeof payload.sha === 'string' && /^[a-f0-9]{40,64}$/.test(payload.sha)))) throw new ArticleEditError('Invalid save revision.');
    const sha = await articleStore().write(slug, language, article, payload.sha);
    return json({ sha, html, saved: true });
  } catch (error) { return failure(error); }
};
