import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { adminService, currentSession, sameOrigin } from '../../../lib/admin-service';
import { isPageId, pageDocumentSchema, type PageDocument, type PageId } from '../../../lib/page-builder-schema';
import { PageBuilderError, pageBuilderStore, validDraftRevision, validPageSha } from '../../../lib/page-builder-store';

export const prerender = false;
type Draft = { document: PageDocument; baseSha: string | null; revision: string };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
async function access(request: Request, page: unknown): Promise<PageId> {
  if (!await currentSession(request.headers.get('cookie'))) throw new PageBuilderError('Please sign in to edit.', 401);
  if (!isPageId(page)) throw new PageBuilderError('Unknown page.', 404);
  return page;
}
async function readDraft(page: PageId): Promise<Draft | null> {
  const { draft } = await adminService<{ draft: Draft | null }>(`/page-drafts/${page}`);
  if (draft === null) return null;
  if (!draft || !validPageSha(draft.baseSha) || !validDraftRevision(draft.revision)) throw new Error('Invalid stored draft.');
  return { document: pageDocumentSchema.parse(draft.document), baseSha: draft.baseSha, revision: draft.revision };
}
function failure(error: any) {
  if (error instanceof PageBuilderError) return json({ error: error.message }, error.status);
  if (error?.status === 409 || error?.status === 422) return json({ error: 'Page or draft changed. Reopen the editor.' }, 409);
  return json({ error: 'Page storage unavailable. Your draft has not been discarded.' }, 503);
}
export const GET: APIRoute = async ({ request, params }) => {
  try {
    const page = await access(request, params.page);
    const [published, draft] = await Promise.all([pageBuilderStore().read(page), readDraft(page)]);
    return json({ ...published, draft });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async ({ request, params }) => {
  try {
    const page = await access(request, params.page);
    if (!sameOrigin(request)) throw new PageBuilderError('Invalid request origin.', 403);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new PageBuilderError('Expected JSON.', 415);
    if (Number(request.headers.get('content-length')) > 250000) throw new PageBuilderError('Page is too large.', 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 250000) throw new PageBuilderError('Page is too large.', 413);
    let payload: any;
    try { payload = JSON.parse(raw); } catch { throw new PageBuilderError('Invalid JSON.'); }
    if (!payload || !['draft', 'discard', 'publish'].includes(payload.action) || !(payload.draftRevision === null || validDraftRevision(payload.draftRevision))) throw new PageBuilderError('Invalid action or draft revision.');
    const path = `/page-drafts/${page}`;
    if (payload.action === 'discard') {
      if (payload.draftRevision === null) throw new PageBuilderError('A draft revision is required.');
      await adminService(path, { expectedRevision: payload.draftRevision }, 'DELETE');
      return json({ ok: true });
    }
    if (!validPageSha(payload.sha)) throw new PageBuilderError('Invalid published revision.');
    const parsed = pageDocumentSchema.safeParse(payload.document);
    if (!parsed.success) throw new PageBuilderError('Invalid page document.');
    const document = parsed.data;
    const revision = randomUUID();
    if (payload.action === 'draft') {
      await adminService(path, { document, baseSha: payload.sha, expectedRevision: payload.draftRevision, revision }, 'PUT');
      return json({ draftRevision: revision });
    }
    const draft = await readDraft(page);
    if (!draft || draft.revision !== payload.draftRevision || draft.baseSha !== payload.sha || !isDeepStrictEqual(draft.document, document)) throw new PageBuilderError('Save this draft and reopen any conflicting changes before publishing.', 409);
    const sha = await pageBuilderStore().write(page, document, payload.sha);
    try {
      await adminService(path, { document, baseSha: sha, expectedRevision: payload.draftRevision, revision }, 'PUT');
    } catch {
      // GitHub has committed: a failed CAS or unavailable D1 must not report publication failure.
      return json({ sha, draftRevision: payload.draftRevision, draftConflict: true });
    }
    return json({ sha, draftRevision: revision });
  } catch (error) { return failure(error); }
};
