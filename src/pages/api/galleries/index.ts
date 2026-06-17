import type { APIRoute } from 'astro';
import { z } from 'zod';
import { gallerySchema } from '../../../lib/frontmatter';
import { listGalleries, writeGallery } from '../../../lib/github';

export const prerender = false;

const postSchema = gallerySchema.extend({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  body: z.string().default(''),
  title: z.string().min(1),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async () => json(await listGalleries());

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const data = parsed.data as any;
  await writeGallery(data, `studio: save gallery "${data.slug}"`);
  return json({ ok: true, slug: data.slug });
};
