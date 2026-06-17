import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeStore } from './github';

beforeEach(() => {
  vi.stubEnv('GITHUB_REPO', 'me/site');
  vi.stubEnv('GITHUB_BRANCH', 'main');
  vi.stubEnv('GITHUB_TOKEN', 't');
  vi.stubEnv('ADMIN_PASSWORD', 'p'); vi.stubEnv('SESSION_SECRET', 's');
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'c'); vi.stubEnv('CLOUDINARY_API_KEY', 'k');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'x');
});

function mockOctokit(overrides = {}) {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
        deleteFile: vi.fn().mockResolvedValue({}),
      },
    },
    ...overrides,
  } as any;
}

const MD = `---\ntitle: T\ndate: 2026-01-01\nsummary: s\ncover: c\n---\nbody`;

describe('github store', () => {
  it('getGallery returns parsed data or null on 404', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({
      data: { content: Buffer.from(MD).toString('base64'), encoding: 'base64', sha: 'abc' },
    });
    const store = makeStore(ok);
    const g = await store.getGallery('x');
    expect(g?.title).toBe('T');

    ok.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    expect(await store.getGallery('missing')).toBeNull();
  });

  it('writeGallery creates/updates with sha when file exists', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'existing-sha' } });
    const store = makeStore(ok);
    await store.writeGallery(
      { slug: 'x', title: 'T', date: new Date('2026-01-01'), summary: 's',
        cover: 'c', draft: false, featured: false,
        theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
        images: [], body: 'body' } as any,
      'msg',
    );
    const call = ok.rest.repos.createOrUpdateFileContents.mock.calls[0][0];
    expect(call.path).toBe('src/content/galleries/x.md');
    expect(call.sha).toBe('existing-sha');
    expect(Buffer.from(call.content, 'base64').toString()).toContain('title: T');
  });

  it('deleteGallery passes the current sha', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'sha9' } });
    const store = makeStore(ok);
    await store.deleteGallery('x', 'msg');
    expect(ok.rest.repos.deleteFile.mock.calls[0][0].sha).toBe('sha9');
  });

  it('writeGallery creates without sha when file does not exist', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    const store = makeStore(ok);
    await store.writeGallery(
      { slug: 'x', title: 'T', date: new Date('2026-01-01'), summary: 's',
        cover: 'c', draft: false, featured: false,
        theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
        images: [], body: 'body' } as any,
      'msg',
    );
    const call = ok.rest.repos.createOrUpdateFileContents.mock.calls[0][0];
    expect(call.path).toBe('src/content/galleries/x.md');
    expect('sha' in call).toBe(false);
    expect(Buffer.from(call.content, 'base64').toString()).toContain('title: T');
  });
});
