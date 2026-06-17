import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GalleryLayout from '../../layouts/GalleryLayout.astro';
import { gallerySchema } from '../../lib/frontmatter';
import globalCss from '../../styles/global.css?raw';

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
  const slots = { default: String(parsed.data.body ?? '') };

  const container = await AstroContainer.create();
  const html = await container.renderToString(GalleryLayout, { props, slots });

  // Astro's Container API renderToString returns a full <html> document (because
  // GalleryLayout wraps BaseLayout which renders the full HTML shell), but it does
  // NOT inline the bundled global.css — the stylesheet import in BaseLayout becomes
  // a <link> to a build-time asset that doesn't exist in the preview context.
  // We inject global.css as an inline <style> so the preview is fully styled with
  // all design tokens, font moods, atmosphere rules, and per-gallery CSS variables.
  const styled = html.includes('</head>')
    ? html.replace('</head>', `<style>${globalCss}</style></head>`)
    : `<style>${globalCss}</style>` + html;

  return new Response(styled, { status: 200, headers: { 'content-type': 'text/html' } });
};
