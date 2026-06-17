import type { APIRoute } from 'astro';
import { getGallery, deleteGallery } from '../../../lib/github';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async ({ params }) => {
  const g = await getGallery(params.slug!);
  return g ? json(g) : json({ error: 'not found' }, 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  await deleteGallery(params.slug!, `studio: delete gallery "${params.slug}"`);
  return json({ ok: true });
};
