import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../pages/api/articles/[slug]';
import { createSessionCookie } from './auth';
const store = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('./article-store', () => ({ articleStore: () => store }));
const value = { title: 'Mon titre', subtitle: '', summary: 'Résumé', body: 'Du **texte**', sha: null, action: 'publish' };
let cookie = '';
beforeEach(() => { vi.stubEnv('SESSION_SECRET', 'test-only-secret'); cookie = createSessionCookie(false).split(';')[0]; store.read.mockReset().mockResolvedValue(null); store.write.mockReset().mockResolvedValue('a'.repeat(40)); });
afterEach(() => vi.unstubAllEnvs());
function request(method: string, body?: unknown, headers: Record<string, string> = {}, slug = 'why-golden-hour') {
  return { params: { slug }, request: new Request(`http://localhost/api/articles/${slug}?lang=fr`, { method, headers: { cookie, origin: 'http://localhost', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) } as any;
}
describe('owner-only article API', () => {
  it('denies anonymous reads and writes', async () => {
    expect((await GET(request('GET', undefined, { cookie: '' }))).status).toBe(401);
    expect((await POST(request('POST', value, { cookie: '' }))).status).toBe(401);
    expect(store.write).not.toHaveBeenCalled();
  });
  it('denies cross-origin writes and unknown slugs', async () => {
    expect((await POST(request('POST', value, { origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(request('POST', value, {}, 'not-an-article'))).status).toBe(404);
    expect(store.write).not.toHaveBeenCalled();
  });
  it('loads original French content when no saved override exists', async () => {
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toContain('dorée'); expect(data.body).toContain('Rayleigh'); expect(data.sha).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('previews safely without writing anything', async () => {
    const response = await POST(request('POST', { ...value, action: 'preview', body: '**gras**<script>alert(1)</script>' }));
    expect(response.status).toBe(200);
    expect((await response.json()).html).not.toContain('<script'); expect(store.write).not.toHaveBeenCalled();
  });
  it('persists the selected language and exact revision then returns sanitized preview', async () => {
    const sha = 'b'.repeat(40);
    const response = await POST(request('POST', { ...value, sha }));
    expect(response.status).toBe(200);
    expect(store.write).toHaveBeenCalledWith('why-golden-hour', 'fr', { title: 'Mon titre', subtitle: '', summary: 'Résumé', body: 'Du **texte**' }, sha);
    expect(await response.json()).toMatchObject({ saved: true, sha: 'a'.repeat(40), html: '<p>Du <strong>texte</strong></p>' });
  });
  it('rejects incomplete save requests rather than creating an unversioned overwrite', async () => {
    expect((await POST(request('POST', { ...value, sha: undefined }))).status).toBe(400);
    expect(store.write).not.toHaveBeenCalled();
  });
});
it('allows the Video QR introduction and sample descriptions to be edited like articles', async () => {
  for (const slug of ['page-video-qr-intro', 'page-video-qr-sample-01', 'page-video-qr-sample-02', 'page-video-qr-sample-03', 'page-video-qr-generator']) {
    const response = await GET(request('GET', undefined, {}, slug));
    expect(response.status).toBe(200);
    expect((await response.json()).title.length).toBeGreaterThan(0);
  }
});
