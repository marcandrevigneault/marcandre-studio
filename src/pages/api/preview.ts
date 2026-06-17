import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GalleryLayout from '../../layouts/GalleryLayout.astro';
import { gallerySchema } from '../../lib/frontmatter';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.json().catch(() => null);
  const parsed = gallerySchema.safeParse(rawBody);
  if (!parsed.success) return new Response('invalid', { status: 400 });

  // GalleryLayout expects `gallery: CollectionEntry<'galleries'>` and reads
  // `const { data } = gallery` — so we wrap as { gallery: { data: parsed.data } }.
  // parsed.data.date is a real Date (z.coerce.date() converts the incoming string),
  // satisfying data.date.toLocaleDateString() in the layout.
  const props = { gallery: { data: parsed.data } };
  const slots = { default: String(rawBody.body ?? '') };

  const container = await AstroContainer.create();
  const html = await container.renderToString(GalleryLayout, { props, slots });

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
};
