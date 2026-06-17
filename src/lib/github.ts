import { Octokit } from '@octokit/rest';
import { getEnv } from './env';
import { parseGallery, serializeGallery, type GalleryData } from './frontmatter';

const DIR = 'src/content/galleries';

function repoParts() {
  const [owner, repo] = getEnv().githubRepo.split('/');
  return { owner, repo, branch: getEnv().githubBranch };
}

export function makeStore(octokit: Octokit) {
  const path = (slug: string) => `${DIR}/${slug}.md`;

  async function getSha(p: string): Promise<string | null> {
    const { owner, repo, branch } = repoParts();
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path: p, ref: branch });
      const data = res.data as { sha?: string };
      return data.sha ?? null;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  const getGallery = async (slug: string): Promise<GalleryData | null> => {
    const { owner, repo, branch } = repoParts();
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path: path(slug), ref: branch });
      const data = res.data as { content: string; encoding: string };
      const md = Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf8');
      return parseGallery(slug, md);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  };

  return {
    async listGalleries(): Promise<GalleryData[]> {
      const { owner, repo, branch } = repoParts();
      let entries: any[] = [];
      try {
        const res = await octokit.rest.repos.getContent({ owner, repo, path: DIR, ref: branch });
        entries = Array.isArray(res.data) ? res.data : [];
      } catch (e: any) {
        if (e.status === 404) return [];
        throw e;
      }
      const mdFiles = entries.filter((f) => f.type === 'file' && f.name.endsWith('.md'));
      const out: GalleryData[] = [];
      for (const f of mdFiles) {
        const g = await getGallery(f.name.replace(/\.md$/, ''));
        if (g) out.push(g);
      }
      return out;
    },

    getGallery,

    async writeGallery(data: GalleryData, message: string): Promise<void> {
      const { owner, repo, branch } = repoParts();
      const sha = await getSha(path(data.slug));
      await octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path: path(data.slug), branch, message,
        content: Buffer.from(serializeGallery(data), 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      });
    },

    async deleteGallery(slug: string, message: string): Promise<void> {
      const { owner, repo, branch } = repoParts();
      const sha = await getSha(path(slug));
      if (!sha) return;
      await octokit.rest.repos.deleteFile({ owner, repo, path: path(slug), branch, message, sha });
    },
  };
}

function defaultStore() {
  return makeStore(new Octokit({ auth: getEnv().githubToken }));
}

export const listGalleries = () => defaultStore().listGalleries();
export const getGallery = (slug: string) => defaultStore().getGallery(slug);
export const writeGallery = (d: GalleryData, m: string) => defaultStore().writeGallery(d, m);
export const deleteGallery = (s: string, m: string) => defaultStore().deleteGallery(s, m);
