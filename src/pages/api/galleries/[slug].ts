import type { APIRoute } from 'astro';
import { getGallery, deleteGallery } from '../../../lib/github';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? '';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json({ ok: false, error: 'bad slug' }, 400);
  }
  const g = await getGallery(slug);
  return g ? json(g) : json({ error: 'not found' }, 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  const slug = params.slug ?? '';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return json({ ok: false, error: 'bad slug' }, 400);
  }
  await deleteGallery(slug, `studio: delete gallery "${slug}"`);
  return json({ ok: true });
};
