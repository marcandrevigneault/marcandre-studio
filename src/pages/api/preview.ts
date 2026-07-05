import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GalleryLayout from '../../layouts/GalleryLayout.astro';
import { gallerySchema } from '../../lib/frontmatter';
import globalCss from '../../styles/global.css?raw';
import galleryCss from '../../styles/gallery.css?raw';

// Preview-only chrome removal: the iframe should show the gallery itself,
// not the site nav/footer around it (they'd also be unstyled here, since
// their component-scoped styles don't survive the container render).
// Also force reveal-animated elements visible: motion.js is a bundled asset
// whose <script src> doesn't resolve inside the container-rendered document,
// so without this the hero/blocks would sit at opacity 0 forever.
const previewCss = [
  '.site-nav, .site-footer { display: none; }',
  '[data-reveal] { opacity: 1 !important; transform: none !important; }',
].join('\n');

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
  // container (without it, Astro.url is unset entirely). Note: this installed astro
  // version's AstroContainer.create() ignores a passed `astroConfig.site` (verified by
  // reading node_modules/astro/dist/container/index.js — `static create` never
  // destructures `astroConfig` off `containerOptions`), so `Astro.site` stays undefined
  // here. BaseLayout.astro now guards its canonical-URL computation for that case
  // (see task-17-report.md, "Fix 17b"), so this no longer crashes the preview render.
  const container = await AstroContainer.create();
  const html = await container.renderToString(GalleryLayout, { props, slots, request });

  // Astro's Container API renderToString returns a full <html> document (because
  // GalleryLayout wraps BaseLayout which renders the full HTML shell), but it does
  // NOT inline any bundled stylesheet — imports become <link>s to build-time assets
  // that don't exist in the preview context. Inline everything the gallery needs:
  // global tokens + the gallery layout/blocks styles + preview chrome removal.
  const inline = `<style>${globalCss}\n${galleryCss}\n${previewCss}</style>`;
  const styled = html.includes('</head>')
    ? html.replace('</head>', `${inline}</head>`)
    : inline + html;

  return new Response(styled, { status: 200, headers: { 'content-type': 'text/html' } });
};
