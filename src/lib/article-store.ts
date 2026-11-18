import { Octokit } from '@octokit/rest';
import { requireEnvVar } from './env';
import { ArticleEditError, articleEditPath, parseArticleEdit, serializeArticleEdit, type ArticleEdit, type ArticleLanguage } from './article-editing';

export function makeArticleStore(client: Octokit, repository: { owner: string; repo: string; branch: string }) {
  const { owner, repo, branch } = repository;
  return {
    async read(slug: string, language: ArticleLanguage): Promise<(ArticleEdit & { sha: string }) | null> {
      const path = articleEditPath(slug, language);
      try {
        const { data } = await client.rest.repos.getContent({ owner, repo, path, ref: branch });
        if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) throw new Error('Invalid content response.');
        return { ...parseArticleEdit(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
      } catch (error: any) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    async write(slug: string, language: ArticleLanguage, article: ArticleEdit, sha: string | null): Promise<string> {
      const path = articleEditPath(slug, language);
      const content = Buffer.from(serializeArticleEdit(article), 'utf8').toString('base64');
      try {
        // Use exactly the revision the editor loaded; never fetch a newer SHA to overwrite it.
        const { data } = await client.rest.repos.createOrUpdateFileContents({ owner, repo, branch, path, content, ...(sha ? { sha } : {}), message: `studio: edit ${slug} (${language})` });
        if (!data.content?.sha) throw new Error('Missing saved revision.');
        return data.content.sha;
      } catch (error: any) {
        if (error.status === 409 || error.status === 422) throw new ArticleEditError('This article changed in another tab. Copy your draft, reload the latest version and try again.', 409);
        throw error;
      }
    },
  };
}
export function articleStore() {
  const [owner, repo, extra] = requireEnvVar('GITHUB_REPO').split('/');
  if (!owner || !repo || extra) throw new Error('Invalid repository configuration.');
  return makeArticleStore(new Octokit({ auth: requireEnvVar('GITHUB_TOKEN') }), { owner, repo, branch: process.env.GITHUB_BRANCH || 'main' });
}
