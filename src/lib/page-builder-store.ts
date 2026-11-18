import { Octokit } from '@octokit/rest';
import { requireEnvVar } from './env';
import { defaultPage } from './page-builder-defaults';
import { isPageId, pageDocumentSchema, type PageDocument, type PageId } from './page-builder-schema';

export class PageBuilderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const validPageSha = (value: unknown): value is string | null => value === null || (typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value));
export const validDraftRevision = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function pagePath(id: PageId) {
  if (!isPageId(id)) throw new PageBuilderError('Unknown page.', 404);
  return `src/content/pages/${id}.json`;
}
export function makePageBuilderStore(client: Octokit, repository: { owner: string; repo: string; branch: string }) {
  const { owner, repo, branch } = repository;
  return {
    async read(id: PageId): Promise<{ published: PageDocument; sha: string | null }> {
      const path = pagePath(id);
      let data;
      try { ({ data } = await client.rest.repos.getContent({ owner, repo, path, ref: branch })); }
      catch (error: any) {
        if (error.status === 404) return { published: defaultPage(id), sha: null };
        throw error;
      }
      if (Array.isArray(data) || data.type !== 'file' || !('content' in data) || !validPageSha(data.sha) || data.sha === null) throw new Error('Invalid published page.');
      return { published: pageDocumentSchema.parse(JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))), sha: data.sha };
    },
    async write(id: PageId, document: PageDocument, sha: string | null): Promise<string> {
      const path = pagePath(id);
      if (!validPageSha(sha)) throw new PageBuilderError('Invalid published revision.');
      const parsed = pageDocumentSchema.safeParse(document);
      if (!parsed.success) throw new PageBuilderError('Invalid page document.');
      const content = Buffer.from(JSON.stringify(parsed.data, null, 2) + '\n', 'utf8').toString('base64');
      try {
        const { data } = await client.rest.repos.createOrUpdateFileContents({ owner, repo, branch, path, content, ...(sha === null ? {} : { sha }), message: `studio: edit ${id} page` });
        if (!data.content?.sha) throw new Error('Missing saved revision.');
        return data.content.sha;
      } catch (error: any) {
        if (error.status === 409 || error.status === 422) throw new PageBuilderError('Page changed. Reopen the editor before publishing.', 409);
        throw error;
      }
    },
  };
}
export function pageBuilderStore() {
  const [owner, repo, extra] = requireEnvVar('GITHUB_REPO').split('/');
  if (!owner || !repo || extra) throw new Error('Invalid repository configuration.');
  return makePageBuilderStore(new Octokit({ auth: requireEnvVar('GITHUB_TOKEN') }), { owner, repo, branch: process.env.GITHUB_BRANCH || 'main' });
}
