import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GalleryLayout from '../../layouts/GalleryLayout.astro';
import { gallerySchema } from '../../lib/frontmatter';
import globalCss from '../../styles/global.css?raw';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.json().catch(() => null);

  // gallerySchema requires a valid `date` (z.coerce.date()). Verified with the
  // project's zod (v4.4.3): coercing '' or undefined produces an Invalid Date,
  // and zod's date check REJECTS that (throws), it does not pass it through —
  // so a brand-new gallery in the Builder (no date picked yet) would 400 the
  // whole preview request. Tolerate that: parse with a placeholder date so the
  // rest of the payload still validates, then — if the posted date was blank —
  // swap in an actual Invalid Date afterwards (bypassing schema re-validation)
  // so GalleryLayout's blank-date guard sees `!isNaN(date.getTime())` fail and
  // renders its "Draft — no date yet" placeholder, same as if we'd let an
  // invalid date flow all the way through.
  const rawDate = rawBody && typeof rawBody === 'object' ? (rawBody as { date?: unknown }).date : undefined;
  const dateBlank = !rawDate || isNaN(new Date(rawDate as string).getTime());
  const bodyForParse =
    rawBody && typeof rawBody === 'object'
      ? { ...rawBody, date: dateBlank ? new Date().toISOString() : rawDate }
      : rawBody;

  const parsed = gallerySchema.safeParse(bodyForParse);
  if (!parsed.success) return new Response('invalid', { status: 400 });
  if (dateBlank) parsed.data.date = new Date(NaN);

  // GalleryLayout expects `gallery: CollectionEntry<'galleries'>` and reads
  // `const { data } = gallery` — so we wrap as { gallery: { data: parsed.data } }.
  // GalleryLayout already calls `normalizeToBlocks(data)` internally (it renders
  // `<GalleryBlocks>` from `normalizeToBlocks(data)`, falling back to legacy
  // `images[]` when `blocks` is empty), so parsed.data.blocks flowing straight
  // through gallerySchema is all this endpoint needs to do for blocks to render.
  const props = { gallery: { data: parsed.data } };
  // The intro body is not part of gallerySchema (it strips unknown keys), so read it
  // from the raw request object — the builder sends the full gallery incl. `body`.
  const body = typeof rawBody?.body === 'string' ? rawBody.body : '';
  const slots = { default: body };

  // Forward the incoming request so Astro.url/Astro.request resolve inside the
  // container (without it, Astro.url is unset entirely). NOTE: this does NOT fully
  // fix rendering — see the known-limitation note in the task report: this installed
  // astro version's AstroContainer.create() ignores a passed `astroConfig.site`
  // (verified by reading node_modules/astro/dist/container/index.js — `static create`
  // never destructures `astroConfig` off `containerOptions`), so `Astro.site` stays
  // undefined and BaseLayout's `new URL(Astro.url.pathname, Astro.site)` throws.
  // That bug lives in BaseLayout.astro/astro's container API, both out of scope for
  // this task (see report).
  const container = await AstroContainer.create();
  const html = await container.renderToString(GalleryLayout, { props, slots, request });

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
