import { describe, it, expect } from 'vitest';
import { makeArticleStore } from './article-store';
import { serializeArticleEdit } from './article-editing';
const edit = { title: 'A title', subtitle: '', summary: 'Summary', body: '**Text**' };
function fixture(initial: { sha: string; text: string } | null) {
  let file = initial;
  const client = { rest: { repos: {
    getContent: async ({ path }: any) => {
      if (path !== 'src/content/edits/why-golden-hour.fr.md') throw new Error('Unexpected path');
      if (!file) throw Object.assign(new Error('Missing'), { status: 404 });
      return { data: { type: 'file', sha: file.sha, encoding: 'base64', content: Buffer.from(file.text).toString('base64') } };
    },
    createOrUpdateFileContents: async ({ sha, content, path, branch }: any) => {
      if (branch !== 'main' || path !== 'src/content/edits/why-golden-hour.fr.md') throw new Error('Wrong destination');
      if ((file?.sha ?? undefined) !== sha) throw Object.assign(new Error('Conflict'), { status: 409 });
      file = { sha: 'new-sha', text: Buffer.from(content, 'base64').toString() };
      return { data: { content: { sha: 'new-sha' } } };
    },
  } } };
  return makeArticleStore(client as any, { owner: 'owner', repo: 'studio', branch: 'main' });
}
describe('article publishing', () => {
  it('creates a language override and returns the persisted content on reload', async () => {
    const store = fixture(null);
    expect(await store.read('why-golden-hour', 'fr')).toBeNull();
    expect(await store.write('why-golden-hour', 'fr', edit, null)).toBe('new-sha');
    expect(await store.read('why-golden-hour', 'fr')).toEqual({ ...edit, sha: 'new-sha' });
  });
  it('rejects a stale or missing revision instead of overwriting newer work', async () => {
    const store = fixture({ sha: 'current-sha', text: serializeArticleEdit(edit) });
    await expect(store.write('why-golden-hour', 'fr', { ...edit, body: 'Stale edit' }, 'old-sha')).rejects.toMatchObject({ status: 409 });
    await expect(store.write('why-golden-hour', 'fr', edit, null)).rejects.toMatchObject({ status: 409 });
    expect((await store.read('why-golden-hour', 'fr'))?.body).toBe('**Text**');
    await expect(store.write('why-golden-hour', 'fr', edit, 'current-sha')).resolves.toBe('new-sha');
  });
});
