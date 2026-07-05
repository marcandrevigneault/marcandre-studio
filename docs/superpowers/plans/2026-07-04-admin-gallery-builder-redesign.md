# Admin & Gallery-Builder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/admin` login and gallery builder into a seamless, beautiful editor backed by a richer layout-block gallery model, without touching the sound backend.

**Architecture:** Keep the existing backend (GitHub-commit publishing, signed Cloudinary uploads, stateless HMAC session cookie). Change four things: (1) the gallery data model becomes an ordered list of typed **layout blocks**, defined once and shared by admin + public build; (2) a new public renderer draws those layouts; (3) login gets a conditional-`Secure` cookie, a 30-day sliding session, logout, and a styled screen; (4) the builder UI is rebuilt as a single-screen editor with a script-enabled live preview, matching the approved mockup.

**Tech Stack:** Astro 6 (server routes via `@astrojs/vercel`), React 19 islands, Zod, `@dnd-kit`, `react-colorful`, `@octokit/rest`, `cloudinary`, `gray-matter` + `js-yaml`, Vitest.

## Global Constraints

- **Design source of truth:** `docs/superpowers/specs/2026-07-04-admin-mockup-reference.html` — the approved mockup. Port its `<style>` block and markup for all admin UI. Its design tokens mirror `src/styles/global.css` (paper `#fbfaf7`, ink `#1a1916`, muted `#6f6b63`, line `#e7e3da`, accent `#9a6b4f`, 3px radius; warm dark theme).
- **Single canonical schema:** the gallery Zod schema lives only in `src/lib/gallery-schema.ts`. `src/content.config.ts` imports it — never re-declares it.
- **The nine layouts:** `single`, `full`, `two`, `twotall`, `mosaic`, `carousel`, `image-text` (with `align: left|right`), `quad`. "Image-left"/"Image-right" in the UI are one `image-text` layout with `align`.
- **Keep unchanged:** `src/lib/github.ts`, `src/lib/cloudinary.ts`, `/api/upload/sign`, `/api/audio`, the audio schema, `src/components/admin/MusicPicker.tsx` behavior (restyle only).
- **Cookie attributes:** always `HttpOnly; SameSite=Strict; Path=/`. `Secure` is conditional (omit over plain-HTTP localhost). Session max-age: **30 days** (`2592000`).
- **Tests:** Vitest, `src/**/*.test.ts`, `node` environment. Run with `npm test`.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Branch:** work on `redesign/admin-gallery-builder` (already checked out).

---

## File Structure

**Created:**
- `src/lib/blocks.ts` — `normalizeToBlocks()` + block types re-export (pure, testable).
- `src/lib/blocks.test.ts` — its tests.
- `src/components/GalleryBlocks.astro` — public renderer for the nine layouts + lightbox + carousel JS.
- `src/components/admin/admin.css` — the admin stylesheet (ported from the mockup).
- `src/components/admin/BlocksEditor.tsx` — the blocks editor (replaces `PhotoUploader.tsx`).
- `src/components/admin/LayoutPicker.tsx` — the 9-icon layout rail.
- `tools/migrate-galleries.mjs` — one-time legacy→blocks migration for the 3 existing galleries.

**Modified:**
- `src/lib/gallery-schema.ts` — add `blockImageSchema`, `blockSchema`, `blocks` on gallery; keep legacy `images`.
- `src/lib/frontmatter.ts` — `serializeGallery` omits empty/legacy arrays.
- `src/lib/frontmatter.test.ts` — cover blocks round-trip.
- `src/lib/auth.ts` — conditional `Secure`, 30-day max-age, `sessionIsFresh`/re-issue helper.
- `src/lib/auth.test.ts` — updated signatures + 30-day expiry.
- `src/content.config.ts` — import the shared gallery schema.
- `src/middleware.ts` — sliding session refresh on `/admin/*` GETs.
- `src/pages/api/auth/login.ts` — pass `isSecure` from request.
- `src/pages/api/galleries/[slug].ts` — validate `slug` regex on GET/DELETE.
- `src/pages/api/preview.ts` — render via `GalleryBlocks`, tolerate blank date.
- `src/pages/admin/login.astro` — rebuilt styled sign-in.
- `src/layouts/GalleryLayout.astro` — use `GalleryBlocks` instead of `PhotoGrid`.
- `src/components/admin/types.ts` — `Gallery.blocks` replaces `images`; block types.
- `src/components/admin/Builder.tsx`, `Dashboard.tsx`, `MetaFields.tsx`, `ThemeControls.tsx`, `MusicPicker.tsx`, `LivePreview.tsx`, `api-client.ts` — restyle + wire blocks + robustness.
- `src/pages/admin/index.astro`, `new.astro`, `[slug]/edit.astro` — import `admin.css`; add logout.
- `docs/admin-setup.md` — updated E2E checklist.
- `src/content/galleries/*.md` — migrated to `blocks`.

**Deleted:**
- `src/components/PhotoGrid.astro` — replaced by `GalleryBlocks.astro` (after `GalleryLayout` is switched).
- `src/components/admin/PhotoUploader.tsx` — replaced by `BlocksEditor.tsx`.

---

# Phase 1 — Schema, normalization, serialization, migration

### Task 1: Block schema

**Files:**
- Modify: `src/lib/gallery-schema.ts`
- Test: `src/lib/gallery-schema.test.ts` (create)

**Interfaces:**
- Produces: `blockImageSchema`, `blockSchema`, updated `gallerySchema` (adds `blocks: Block[]`, keeps `images`), and types `Block`, `BlockImage`, `BlockLayout`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/gallery-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { blockSchema, gallerySchema } from './gallery-schema';

describe('blockSchema', () => {
  it('parses a full-width image block', () => {
    const b = blockSchema.parse({
      layout: 'full',
      images: [{ src: 'u', alt: 'a' }],
    });
    expect(b.layout).toBe('full');
    expect(b.align).toBe('left'); // default
    expect(b.images[0].alt).toBe('a');
  });

  it('parses an image-text block with align', () => {
    const b = blockSchema.parse({
      layout: 'image-text', align: 'right',
      images: [{ src: 'u', alt: 'a' }], text: 'prose',
    });
    expect(b.align).toBe('right');
    expect(b.text).toBe('prose');
  });

  it('rejects an unknown layout', () => {
    expect(() => blockSchema.parse({ layout: 'nope', images: [] })).toThrow();
  });

  it('gallery accepts a blocks array and defaults it to empty', () => {
    const g = gallerySchema.parse({
      title: 't', date: '2026-01-01', summary: 's', cover: 'c',
    });
    expect(g.blocks).toEqual([]);
    expect(g.images).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/gallery-schema.test.ts`
Expected: FAIL — `blockSchema` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/gallery-schema.ts`, add above `gallerySchema`:

```ts
export const blockImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

export const blockLayouts = [
  'single', 'full', 'two', 'twotall', 'mosaic', 'carousel', 'image-text', 'quad',
] as const;

export const blockSchema = z.object({
  layout: z.enum(blockLayouts),
  images: z.array(blockImageSchema).default([]),
  text: z.string().optional(),
  align: z.enum(['left', 'right']).default('left'),
});

export type BlockLayout = (typeof blockLayouts)[number];
export type BlockImage = z.infer<typeof blockImageSchema>;
export type Block = z.infer<typeof blockSchema>;
```

Then add `blocks` to `gallerySchema` (keep `images`):

```ts
  images: z.array(imageSchema).default([]),   // LEGACY — retained for migration
  blocks: z.array(blockSchema).default([]),   // NEW — canonical
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/gallery-schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-schema.ts src/lib/gallery-schema.test.ts
git commit -m "feat: add layout-block schema to gallery model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: normalizeToBlocks

**Files:**
- Create: `src/lib/blocks.ts`
- Test: `src/lib/blocks.test.ts`

**Interfaces:**
- Consumes: `Block`, `BlockImage` from `gallery-schema.ts`.
- Produces: `normalizeToBlocks(g: { blocks?: Block[]; images?: LegacyImage[] }): Block[]`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/blocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeToBlocks } from './blocks';

describe('normalizeToBlocks', () => {
  it('returns blocks unchanged when present', () => {
    const blocks = [{ layout: 'two' as const, images: [], align: 'left' as const }];
    expect(normalizeToBlocks({ blocks, images: [] })).toBe(blocks);
  });

  it('converts legacy wide image to a full block', () => {
    const out = normalizeToBlocks({
      blocks: [],
      images: [{ src: 'u', alt: 'a', caption: 'c', span: 'wide' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].layout).toBe('full');
    expect(out[0].images[0]).toEqual({ src: 'u', alt: 'a', caption: 'c' });
  });

  it('converts legacy single image to a single block', () => {
    const out = normalizeToBlocks({ images: [{ src: 'u', alt: 'a', span: 'single' }] });
    expect(out[0].layout).toBe('single');
  });

  it('returns [] when neither present', () => {
    expect(normalizeToBlocks({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/blocks.test.ts`
Expected: FAIL — cannot find `./blocks`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/blocks.ts`:

```ts
import type { Block } from './gallery-schema';

type LegacyImage = { src: string; alt: string; caption?: string; span?: 'single' | 'wide' };

/**
 * Canonical block list for a gallery. New content uses `blocks`; older content
 * only has legacy `images[]`, which we map to single/full blocks so both render.
 */
export function normalizeToBlocks(g: { blocks?: Block[]; images?: LegacyImage[] }): Block[] {
  if (g.blocks && g.blocks.length > 0) return g.blocks;
  return (g.images ?? []).map((img) => ({
    layout: img.span === 'wide' ? 'full' : 'single',
    images: [{ src: img.src, alt: img.alt, ...(img.caption ? { caption: img.caption } : {}) }],
    align: 'left',
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/blocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks.ts src/lib/blocks.test.ts
git commit -m "feat: normalizeToBlocks maps legacy images to blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Serialize blocks, drop empty/legacy arrays

**Files:**
- Modify: `src/lib/frontmatter.ts`
- Test: `src/lib/frontmatter.test.ts:1-60` (add a case)

**Interfaces:**
- Consumes: `serializeGallery`, `parseGallery` (existing).
- Produces: serialized markdown that contains `blocks:` and no empty `images:`/`blocks:` keys.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/frontmatter.test.ts` inside the `describe`:

```ts
  it('round-trips a gallery with blocks and omits empty legacy images', () => {
    const g = parseGallery('t', `---
title: T
date: 2026-01-01
summary: s
cover: c
blocks:
  - layout: two
    align: left
    images:
      - src: a
        alt: A
      - src: b
        alt: B
---
`);
    const md = serializeGallery(g);
    expect(md).toContain('blocks:');
    expect(md).not.toMatch(/^images:/m);
    const g2 = parseGallery('t', md);
    expect(g2.blocks).toHaveLength(1);
    expect(g2.blocks[0].images).toHaveLength(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/frontmatter.test.ts`
Expected: FAIL — serialized output still contains `images: []`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/frontmatter.ts`, change `serializeGallery` to strip empty arrays and never emit legacy `images` when `blocks` exist:

```ts
export function serializeGallery(data: GalleryData): string {
  const { slug, body, ...fields } = data;
  const front: Record<string, unknown> = {
    ...fields,
    date: fields.date instanceof Date
      ? fields.date.toISOString().slice(0, 10)
      : fields.date,
  };
  // Blocks are canonical; don't write the legacy images array.
  if (Array.isArray(front.blocks) && front.blocks.length > 0) delete front.images;
  // Drop empty arrays so files stay clean.
  for (const key of ['images', 'blocks'] as const) {
    if (Array.isArray(front[key]) && (front[key] as unknown[]).length === 0) delete front[key];
  }
  const frontYaml = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${frontYaml}\n---\n${body}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/frontmatter.test.ts`
Expected: PASS (existing 3 + new 1).

- [ ] **Step 5: Commit**

```bash
git add src/lib/frontmatter.ts src/lib/frontmatter.test.ts
git commit -m "feat: serialize blocks and omit empty legacy image arrays

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Share the schema with the content config

**Files:**
- Modify: `src/content.config.ts:9-55`

**Interfaces:**
- Consumes: `gallerySchema` from `src/lib/gallery-schema.ts`.

- [ ] **Step 1: Replace the duplicated galleries schema**

In `src/content.config.ts`, remove the local `theme`, `audio`, `image`, and inline gallery schema **for galleries only**, and import the shared one. Keep the `articles` collection as-is.

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { gallerySchema } from './lib/gallery-schema';

const galleries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/galleries' }),
  schema: gallerySchema,
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string(),
    topics: z.array(z.string()).default([]),
    cover: z.string().optional(),
    readingTime: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { galleries, articles };
```

- [ ] **Step 2: Verify the site still builds against existing content**

Run: `npm run build`
Expected: build succeeds; the three existing galleries (still using legacy `images:`) parse because `gallerySchema` retains the `images` field.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "refactor: content config imports the canonical gallery schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migrate the three existing galleries to blocks

**Files:**
- Create: `tools/migrate-galleries.mjs`
- Modify: `src/content/galleries/kyoto-rain.md`, `salt-and-light.md`, `between-tides.md` (via the script)

**Interfaces:**
- Consumes: `parseGallery`, `serializeGallery`, `normalizeToBlocks`.

- [ ] **Step 1: Write the migration script**

Create `tools/migrate-galleries.mjs`:

```js
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGallery, serializeGallery } from '../src/lib/frontmatter.ts';
import { normalizeToBlocks } from '../src/lib/blocks.ts';

const dir = 'src/content/galleries';
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const slug = file.replace(/\.md$/, '');
  const g = parseGallery(slug, readFileSync(join(dir, file), 'utf8'));
  const migrated = { ...g, blocks: normalizeToBlocks(g), images: [] };
  writeFileSync(join(dir, file), serializeGallery(migrated));
  console.log(`migrated ${file}: ${migrated.blocks.length} blocks`);
}
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx tools/migrate-galleries.mjs` (or `node --import tsx tools/migrate-galleries.mjs` — `tsx` is available via npx).
Expected: prints one line per gallery with a block count > 0.

- [ ] **Step 3: Verify the site builds and galleries render**

Run: `npm run build`
Expected: build succeeds. Inspect one migrated file (e.g. `git diff src/content/galleries/between-tides.md`) — confirm `images:` is gone and `blocks:` lists `full`/`single` blocks with the same photos and captions.

- [ ] **Step 4: Commit**

```bash
git add tools/migrate-galleries.mjs src/content/galleries/*.md
git commit -m "chore: migrate existing galleries to layout blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 2 — Public renderer

### Task 6: GalleryBlocks renderer (non-carousel layouts)

**Files:**
- Create: `src/components/GalleryBlocks.astro`
- Modify: `src/layouts/GalleryLayout.astro:2-3,47-48`

**Interfaces:**
- Consumes: `normalizeToBlocks`, `Block` from `src/lib/*`. Renders inside `GalleryLayout`.
- Produces: `<GalleryBlocks blocks={Block[]} />` markup + the shared lightbox (ported from `PhotoGrid.astro`).

- [ ] **Step 1: Create the renderer**

Create `src/components/GalleryBlocks.astro`. Port the lightbox `<dialog>` + its `<script>` verbatim from `src/components/PhotoGrid.astro:25-32,116-136`. Add block rendering:

```astro
---
import type { Block } from '../lib/gallery-schema';
interface Props { blocks: Block[]; }
const { blocks } = Astro.props;
---
<div class="blocks">
  {blocks.map((b, i) => (
    <section class:list={['block', `l-${b.layout}`, { rtl: b.layout === 'image-text' && b.align === 'right' }]} data-reveal={String(i % 6)}>
      {b.layout === 'image-text' && b.text && (
        <div class="prose"><p>{b.text}</p></div>
      )}
      {b.images.map((img) => (
        <figure class="cell">
          <button class="open" data-full={img.src} data-cap={img.caption ?? img.alt} aria-label={`View ${img.alt}`}>
            <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
          </button>
          {img.caption && <figcaption>{img.caption}</figcaption>}
        </figure>
      ))}
    </section>
  ))}
</div>

<!-- Lightbox (ported from PhotoGrid.astro) -->
<dialog class="lightbox" data-lightbox>
  <button class="close" aria-label="Close" data-close>&times;</button>
  <figure><img alt="" data-lightbox-img /><figcaption data-lightbox-cap></figcaption></figure>
</dialog>

<style>
  .blocks { display: flex; flex-direction: column; gap: clamp(1.5rem, 5vw, 3.5rem); }
  .block { display: grid; gap: var(--gap); }
  .cell { margin: 0; }
  .open { display:block; width:100%; padding:0; border:0; background: color-mix(in oklab, var(--ink) 6%, transparent); cursor: zoom-in; overflow: hidden; border-radius: var(--radius); }
  .open img { width:100%; transition: transform .9s var(--ease); }
  .open:hover img { transform: scale(1.03); }
  figcaption { margin-top: .55rem; font-family: var(--font-sans); font-size: .78rem; color: var(--muted); }

  /* layouts */
  .l-single { grid-template-columns: minmax(0, var(--measure)); justify-content: center; }
  .l-full { grid-template-columns: 1fr; }
  .l-two, .l-twotall { grid-template-columns: 1fr 1fr; }
  .l-quad { grid-template-columns: 1fr 1fr; }
  .l-mosaic { grid-template-columns: 1.7fr 1fr; grid-auto-rows: 1fr; }
  .l-mosaic .cell:first-child { grid-row: 1 / span 3; }
  .l-image-text { grid-template-columns: 1fr 1fr; align-items: center; }
  .l-image-text.rtl { direction: rtl; }
  .l-image-text .prose { direction: ltr; font-family: var(--font-display); font-size: clamp(1.05rem, 1rem + .4vw, 1.35rem); line-height: 1.5; }
  @media (max-width: 700px) {
    .l-two, .l-twotall, .l-quad, .l-mosaic, .l-image-text { grid-template-columns: 1fr; }
    .l-mosaic .cell:first-child { grid-row: auto; }
  }

  /* lightbox — ported from PhotoGrid.astro */
  .lightbox { border:0; padding:0; background:transparent; max-width:100vw; max-height:100vh; width:100%; height:100%; margin:0; overflow:hidden; }
  .lightbox::backdrop { background: color-mix(in oklab, #000 88%, transparent); backdrop-filter: blur(6px); }
  .lightbox figure { margin:0; height:100%; display:grid; place-content:center; gap:.75rem; padding: clamp(1rem,5vw,3rem); }
  .lightbox img { max-width:min(92vw,1400px); max-height:82vh; width:auto; border-radius: var(--radius); }
  .lightbox figcaption { text-align:center; color: rgba(255,255,255,.8); font-family: var(--font-sans); font-size:.85rem; }
  .close { position:fixed; top:1rem; right:1.25rem; width:44px; height:44px; border-radius:999px; border:1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.3); color:#fff; font-size:1.6rem; line-height:1; cursor:pointer; }
</style>

<script>
  const dialog = document.querySelector('[data-lightbox]') as HTMLDialogElement | null;
  if (dialog) {
    const img = dialog.querySelector('[data-lightbox-img]') as HTMLImageElement;
    const cap = dialog.querySelector('[data-lightbox-cap]') as HTMLElement;
    document.querySelectorAll('.open').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        img.src = el.dataset.full || '';
        img.alt = el.dataset.cap || '';
        cap.textContent = el.dataset.cap || '';
        dialog.showModal();
      });
    });
    const close = () => dialog.close();
    dialog.querySelector('[data-close]')?.addEventListener('click', close);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  }
</script>
```

- [ ] **Step 2: Wire it into GalleryLayout**

In `src/layouts/GalleryLayout.astro`, replace the `PhotoGrid` import and usage:

```astro
import GalleryBlocks from '../components/GalleryBlocks.astro';
import { normalizeToBlocks } from '../lib/blocks';
```

Replace line 48 (`{data.images.length > 0 && <PhotoGrid images={data.images} />}`) with:

```astro
{(() => { const blocks = normalizeToBlocks(data); return blocks.length > 0 && <GalleryBlocks blocks={blocks} />; })()}
```

- [ ] **Step 3: Build and eyeball the migrated galleries**

Run: `npm run build && npm run preview`
Expected: open `/photography/between-tides` — photos render in their `full`/`single` blocks, captions show, the lightbox opens on click. No layout regressions vs. before migration.

- [ ] **Step 4: Commit**

```bash
git add src/components/GalleryBlocks.astro src/layouts/GalleryLayout.astro
git commit -m "feat: GalleryBlocks renderer for layout blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Carousel layout (progressive enhancement)

**Files:**
- Modify: `src/components/GalleryBlocks.astro`

**Interfaces:**
- Produces: `.l-carousel` markup (scroll-snap track + dots + prev/next) and its script.

- [ ] **Step 1: Add carousel markup**

In `GalleryBlocks.astro`, special-case `carousel` in the block map (replace the generic image loop for that layout):

```astro
{b.layout === 'carousel' ? (
  <div class="carousel" data-carousel>
    <div class="track">
      {b.images.map((img) => (
        <figure class="slide">
          <button class="open" data-full={img.src} data-cap={img.caption ?? img.alt} aria-label={`View ${img.alt}`}>
            <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
          </button>
        </figure>
      ))}
    </div>
    <button class="c-prev" data-prev aria-label="Previous">‹</button>
    <button class="c-next" data-next aria-label="Next">›</button>
    <div class="dots" data-dots>
      {b.images.map((_, di) => (<button class="dot" data-goto={String(di)} aria-label={`Slide ${di + 1}`}></button>))}
    </div>
  </div>
) : (
  b.images.map((img) => ( /* the existing .cell figure loop from Task 6 */ ))
)}
```

- [ ] **Step 2: Add carousel CSS** (append to the `<style>`):

```css
  .carousel { position: relative; }
  .carousel .track { display: flex; gap: var(--gap); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .carousel .track::-webkit-scrollbar { display: none; }
  .carousel .slide { flex: 0 0 100%; margin: 0; scroll-snap-align: center; }
  .carousel .c-prev, .carousel .c-next { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 999px; border: 1px solid color-mix(in oklab, var(--ink) 20%, transparent); background: color-mix(in oklab, var(--paper) 70%, transparent); color: var(--ink); cursor: pointer; font-size: 1.4rem; line-height: 1; }
  .carousel .c-prev { left: .75rem; } .carousel .c-next { right: .75rem; }
  .carousel .dots { display: flex; gap: .4rem; justify-content: center; margin-top: .75rem; }
  .carousel .dot { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 999px; background: color-mix(in oklab, var(--ink) 25%, transparent); cursor: pointer; transition: width .2s var(--ease), background .2s var(--ease); }
  .carousel .dot.on { width: 18px; background: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .carousel .track { scroll-behavior: auto; } }
```

- [ ] **Step 3: Add carousel script** (append inside the existing `<script>`):

```ts
  document.querySelectorAll('[data-carousel]').forEach((root) => {
    const track = root.querySelector('.track') as HTMLElement;
    const slides = Array.from(root.querySelectorAll('.slide')) as HTMLElement[];
    const dots = Array.from(root.querySelectorAll('.dot')) as HTMLElement[];
    if (dots[0]) dots[0].classList.add('on');
    const to = (i: number) => slides[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    root.querySelector('[data-prev]')?.addEventListener('click', () => to(Math.max(0, active() - 1)));
    root.querySelector('[data-next]')?.addEventListener('click', () => to(Math.min(slides.length - 1, active() + 1)));
    dots.forEach((d) => d.addEventListener('click', () => to(Number(d.dataset.goto))));
    function active() { return Math.round(track.scrollLeft / track.clientWidth); }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const i = slides.indexOf(e.target as HTMLElement);
          dots.forEach((d, di) => d.classList.toggle('on', di === i));
        }
      });
    }, { root: track, threshold: 0.6 });
    slides.forEach((s) => io.observe(s));
  });
```

- [ ] **Step 4: Verify manually**

Add a temporary `carousel` block to `between-tides.md` (3+ images), run `npm run build && npm run preview`, open the gallery: swipe/scroll works, dots track the active slide, prev/next move one slide, images still open in the lightbox. Then revert the temp edit.

- [ ] **Step 5: Commit**

```bash
git add src/components/GalleryBlocks.astro
git commit -m "feat: carousel layout with dots and prev/next

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Remove the old PhotoGrid

**Files:**
- Delete: `src/components/PhotoGrid.astro`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "PhotoGrid" src/`
Expected: no results.

- [ ] **Step 2: Delete and build**

```bash
git rm src/components/PhotoGrid.astro
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove PhotoGrid, superseded by GalleryBlocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 3 — Login

### Task 9: Conditional Secure cookie + 30-day session

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth.test.ts`

**Interfaces:**
- Produces: `createSessionCookie(isSecure: boolean): string`, `clearSessionCookie(isSecure: boolean): string`, `MAX_AGE_SECONDS = 2592000`, and `sessionExpiry(cookieHeader): number | null` (used by middleware for sliding refresh). `verifyPassword`, `isValidSession`, `SESSION_COOKIE_NAME` unchanged.

- [ ] **Step 1: Update the tests**

In `src/lib/auth.test.ts`: change the round-trip test to `createSessionCookie(true)`; add a localhost case; change the expiry test to 31 days; update `clearSessionCookie` call.

```ts
  it('sets Secure only when asked', () => {
    expect(createSessionCookie(true)).toContain('Secure');
    expect(createSessionCookie(false)).not.toContain('Secure');
  });

  it('round-trips a valid session cookie', () => {
    const setCookie = createSessionCookie(true);
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    const value = setCookie.split(';')[0];
    expect(isValidSession(value)).toBe(true);
  });

  it('rejects an expired session cookie', () => {
    const value = createSessionCookie(true).split(';')[0];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000); // 31 days later
      expect(isValidSession(value)).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('clearSessionCookie expires the cookie', () => {
    expect(clearSessionCookie(true)).toMatch(/Max-Age=0|Expires=/);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — `createSessionCookie` takes no args / always sets Secure.

- [ ] **Step 3: Implement**

In `src/lib/auth.ts`: bump max-age, thread `isSecure`, add `sessionExpiry`.

```ts
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function cookie(name: string, token: string, maxAge: number, isSecure: boolean): string {
  const parts = [`${name}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAge}`];
  if (isSecure) parts.splice(1, 0, 'Secure');
  return parts.join('; ');
}

export function createSessionCookie(isSecure: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(exp);
  const token = `${payload}.${sign(payload, requireEnvVar('SESSION_SECRET'))}`;
  return cookie(SESSION_COOKIE_NAME, token, MAX_AGE_SECONDS, isSecure);
}

export function clearSessionCookie(isSecure: boolean): string {
  return cookie(SESSION_COOKIE_NAME, '', 0, isSecure);
}

/** Remaining lifetime, in seconds, of a valid session — or null if invalid. */
export function sessionExpiry(cookieHeader: string | null): number | null {
  if (!isValidSession(cookieHeader)) return null;
  const match = cookieHeader!.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!;
  const payload = match.slice(SESSION_COOKIE_NAME.length + 1).split('.')[0];
  return Number(payload) - Math.floor(Date.now() / 1000);
}
```

Keep `isValidSession` as-is.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: conditional Secure cookie, 30-day session, sessionExpiry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Login endpoint passes isSecure; middleware sliding refresh

**Files:**
- Modify: `src/pages/api/auth/login.ts`
- Modify: `src/pages/api/auth/logout.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `createSessionCookie(isSecure)`, `clearSessionCookie(isSecure)`, `sessionExpiry`, `isValidSession`.
- Produces: a shared `isSecureRequest(request): boolean` helper (add to `src/lib/auth.ts`).

- [ ] **Step 1: Add `isSecureRequest` to `src/lib/auth.ts`**

```ts
/** True when the request arrived over HTTPS (behind Vercel's proxy or direct). */
export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return true;
  return request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
}
```

- [ ] **Step 2: Use it in login/logout**

In `src/pages/api/auth/login.ts`, replace the `createSessionCookie()` call with `createSessionCookie(isSecureRequest(request))` (import `isSecureRequest`). In `src/pages/api/auth/logout.ts`, replace `clearSessionCookie()` with `clearSessionCookie(isSecureRequest(request))`.

Also add a friendly missing-env guard at the top of the login handler so an unconfigured deploy returns a clear message instead of a raw 500:

```ts
for (const key of ['ADMIN_PASSWORD', 'SESSION_SECRET']) {
  if (!process.env[key]) {
    return new Response(JSON.stringify({ ok: false, error: `Server not configured: ${key} is unset.` }), { status: 503 });
  }
}
```

(`src/lib/env.ts` reads from `process.env`; this mirrors `requireEnvVar`.)

- [ ] **Step 3: Add sliding refresh to middleware**

In `src/middleware.ts`, after the auth checks pass for an `/admin/*` GET, re-issue the cookie when it's past halfway (< 15 days left):

```ts
import { isValidSession, sessionExpiry, createSessionCookie, isSecureRequest } from './lib/auth';
// ... existing guard logic ...
const response = await next();
if (pathname.startsWith('/admin') && pathname !== '/admin/login' && request.method === 'GET') {
  const remaining = sessionExpiry(request.headers.get('cookie'));
  if (remaining !== null && remaining < 15 * 24 * 60 * 60) {
    response.headers.append('set-cookie', createSessionCookie(isSecureRequest(request)));
  }
}
return response;
```

(Adapt to the middleware's existing structure — it currently returns redirects/401s early; add the refresh only on the success path.)

- [ ] **Step 4: Manual verification (dev, HTTP localhost)**

Run: `npm run dev`; open `http://localhost:4321/admin`; sign in. Expected: you reach the dashboard and **stay** there (cookie stored because `Secure` is omitted over HTTP). Reload — still signed in.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/pages/api/auth/login.ts src/pages/api/auth/logout.ts src/middleware.ts
git commit -m "feat: secure-aware cookies + sliding session refresh

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Rebuilt styled login screen

**Files:**
- Modify: `src/pages/admin/login.astro`

**Interfaces:**
- Consumes: `POST /api/auth/login` (unchanged contract).

- [ ] **Step 1: Rebuild the page**

Replace `src/pages/admin/login.astro`'s `<main>` and `<script>` with the mockup's login markup and styles (from `docs/superpowers/specs/2026-07-04-admin-mockup-reference.html`, the `#view-login` section and its `.login-*`, `.wordmark`, `.field`, `.input`, `.btn` rules). Keep the top server guard (`if (isValidSession(...)) return Astro.redirect('/admin')`). The script must:
  - `preventDefault`, read the password, disable the button + show "Signing in…" while the request is in flight;
  - on `res.ok` → `location.href = '/admin'`;
  - on non-ok → show the inline error "That password didn't match." and re-enable;
  - wrap the `fetch` in try/catch → show "Couldn't reach the server — try again." on network error.

Button text: **"Sign in"**. Helper: "Stays signed in for 30 days on this device."

- [ ] **Step 2: Manual verification**

Run: `npm run dev`; open `/admin/login`. Wrong password → inline error, no navigation, button re-enabled. Correct password → redirected to `/admin`. Screen matches the mockup (paper card, serif wordmark, focus ring).

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/login.astro
git commit -m "feat: styled sign-in with loading and error states

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Tighten slug validation on GET/DELETE

**Files:**
- Modify: `src/pages/api/galleries/[slug].ts`

- [ ] **Step 1: Add validation**

At the top of both the `GET` and `DELETE` handlers, reject bad slugs before hitting GitHub:

```ts
const slug = params.slug ?? '';
if (!/^[a-z0-9-]+$/.test(slug)) {
  return new Response(JSON.stringify({ ok: false, error: 'bad slug' }), { status: 400 });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/galleries/[slug].ts
git commit -m "fix: validate slug on gallery GET/DELETE

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 4 — Builder UI

### Task 13: Admin stylesheet + client block types

**Files:**
- Create: `src/components/admin/admin.css`
- Modify: `src/components/admin/types.ts`
- Modify: `src/pages/admin/index.astro`, `new.astro`, `[slug]/edit.astro` (import the stylesheet)

**Interfaces:**
- Produces: `admin.css` (all admin component styles) and client types `Block`, `BlockImage`, updated `Gallery` (`blocks: Block[]` replaces `images`), and `newBlock(layout)` / updated `emptyGallery()`.

- [ ] **Step 1: Create the stylesheet**

Create `src/components/admin/admin.css` by porting the entire `<style>` block from `docs/superpowers/specs/2026-07-04-admin-mockup-reference.html` **except** the `.switcher`, `.view`, and `#view-login`/login-only rules (those are the mockup's demo chrome and the separate login page). Keep: tokens (`:root`, dark theme, `data-theme`), `.topbar`, `.builder`, `.editor`, `.card`, `.row`, `.title-input`, `.slug`, `.swatches`, `.segbar`/`.control-row`, `.dropzone`, `.blocks`/`.block`/`.layoutrail`/`.tiles`/`.side-text`/`.filmstrip`/`.dots`, `.track`/`.play`/`.wave`, toggles/`.switch`, `.publishbar`, `.preview-pane`/`.frame`/`.gallery-preview` and the preview block layouts.

- [ ] **Step 2: Update client types**

Rewrite `src/components/admin/types.ts` so blocks replace images:

```ts
export type Font = 'serif' | 'sans' | 'mono';
export type Motion = 'none' | 'calm' | 'drift' | 'reveal';
export type Atmosphere = 'none' | 'grain' | 'vignette';
export type BlockLayout = 'single' | 'full' | 'two' | 'twotall' | 'mosaic' | 'carousel' | 'image-text' | 'quad';

export interface Theme { paper?: string; ink?: string; muted?: string; accent?: string; font: Font; motion: Motion; atmosphere: Atmosphere; }
export interface BlockImage { id: string; src: string; alt: string; caption?: string; }
export interface Block { id: string; layout: BlockLayout; images: BlockImage[]; text?: string; align: 'left' | 'right'; }
export interface Audio { src: string; title: string; loop: boolean; }

export interface Gallery {
  slug: string; title: string; place?: string; date: string; summary: string; cover: string;
  draft: boolean; featured: boolean; theme: Theme; audio?: Audio; blocks: Block[]; body: string;
}

let idc = 0;
export const newId = () => `b${Date.now().toString(36)}-${idc++}`;
export const newBlock = (layout: BlockLayout): Block => ({ id: newId(), layout, images: [], align: 'left' });

export const emptyGallery = (): Gallery => ({
  slug: '', title: '', date: new Date().toISOString().slice(0, 10),
  summary: '', cover: '', draft: true, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  blocks: [], body: '',
});
```

Note: `id` on blocks/images is client-only (stable dnd keys). Strip `id`s before saving (Task 16).

- [ ] **Step 3: Import the stylesheet in the three admin pages**

In `src/pages/admin/index.astro`, `new.astro`, and `[slug]/edit.astro`, add `import '../../components/admin/admin.css';` (adjust depth for `[slug]/edit.astro`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds (types may be referenced by not-yet-updated components — if the build flags `images` usage, that's fixed in Tasks 15–16; if blocking, proceed to those before building).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin.css src/components/admin/types.ts src/pages/admin/index.astro src/pages/admin/new.astro "src/pages/admin/[slug]/edit.astro"
git commit -m "feat: admin stylesheet + block-based client types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: LayoutPicker component

**Files:**
- Create: `src/components/admin/LayoutPicker.tsx`

**Interfaces:**
- Consumes: `BlockLayout` from `types.ts`.
- Produces: `<LayoutPicker value={BlockLayout} align={'left'|'right'} onChange={(layout, align?) => void} />`. The rail shows nine icons; "Image-left"/"Image-right" both emit `layout: 'image-text'` with the matching `align`.

- [ ] **Step 1: Implement**

Create `src/components/admin/LayoutPicker.tsx`. Use the nine SVG glyphs from the mockup reference's `GLYPH` object (in its `<script>`). Structure:

```tsx
import type { BlockLayout } from './types';

type Choice = { key: string; layout: BlockLayout; align?: 'left' | 'right'; label: string; glyph: string };
const CHOICES: Choice[] = [
  { key: 'single', layout: 'single', label: 'Single', glyph: '<rect x="7" y="3" width="10" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'full', layout: 'full', label: 'Full width', glyph: '<rect x="2" y="3" width="20" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'two', layout: 'two', label: 'Two across', glyph: '<rect x="2" y="3" width="9" height="10" rx="1" fill-opacity=".6"/><rect x="13" y="3" width="9" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'twotall', layout: 'twotall', label: 'Two tall', glyph: '<rect x="4" y="1.5" width="6" height="13" rx="1" fill-opacity=".6"/><rect x="14" y="1.5" width="6" height="13" rx="1" fill-opacity=".6"/>' },
  { key: 'mosaic', layout: 'mosaic', label: 'One big + three small', glyph: '<rect x="2" y="3" width="11" height="10" rx="1" fill-opacity=".6"/><rect x="15" y="3" width="7" height="2.6" rx=".7" fill-opacity=".6"/><rect x="15" y="6.7" width="7" height="2.6" rx=".7" fill-opacity=".6"/><rect x="15" y="10.4" width="7" height="2.6" rx=".7" fill-opacity=".6"/>' },
  { key: 'carousel', layout: 'carousel', label: 'Carousel', glyph: '<rect x="4" y="2" width="16" height="8" rx="1" fill-opacity=".6"/><circle cx="9" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>' },
  { key: 'text-left', layout: 'image-text', align: 'left', label: 'Image left · text right', glyph: '<rect x="2" y="3" width="9" height="10" rx="1" fill-opacity=".6"/><line x1="14" y1="5" x2="22" y2="5"/><line x1="14" y1="8" x2="22" y2="8"/><line x1="14" y1="11" x2="19" y2="11"/>' },
  { key: 'text-right', layout: 'image-text', align: 'right', label: 'Text left · image right', glyph: '<line x1="2" y1="5" x2="10" y2="5"/><line x1="2" y1="8" x2="10" y2="8"/><line x1="2" y1="11" x2="7" y2="11"/><rect x="13" y="3" width="9" height="10" rx="1" fill-opacity=".6"/>' },
  { key: 'quad', layout: 'quad', label: 'Four grid', glyph: '<rect x="2" y="2.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="13" y="2.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="2" y="8.5" width="9" height="5" rx="1" fill-opacity=".6"/><rect x="13" y="8.5" width="9" height="5" rx="1" fill-opacity=".6"/>' },
];

interface Props { value: BlockLayout; align: 'left' | 'right'; onChange: (layout: BlockLayout, align?: 'left' | 'right') => void; }

export default function LayoutPicker({ value, align, onChange }: Props) {
  const isActive = (c: Choice) => c.layout === value && (c.align === undefined || c.align === align);
  return (
    <div className="layoutrail">
      {CHOICES.map((c) => (
        <button key={c.key} type="button" title={c.label} aria-selected={isActive(c)}
          onClick={() => onChange(c.layout, c.align)}
          dangerouslySetInnerHTML={{ __html: `<svg width="24" height="16" viewBox="0 0 24 16">${c.glyph}</svg>` }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiles (component not yet used).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/LayoutPicker.tsx
git commit -m "feat: LayoutPicker rail (nine layouts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: BlocksEditor component

**Files:**
- Create: `src/components/admin/BlocksEditor.tsx`
- Delete: `src/components/admin/PhotoUploader.tsx`

**Interfaces:**
- Consumes: `Block`, `BlockImage`, `newBlock`, `newId`, `LayoutPicker`, `uploadToCloudinary` (from `cloudinary-upload.ts`, unchanged).
- Produces: `<BlocksEditor blocks={Block[]} cover={string} onChange={(blocks) => void} onCoverChange={(src) => void} />`.

- [ ] **Step 1: Implement**

Create `src/components/admin/BlocksEditor.tsx` porting the mockup's Photos section (`.blocks`/`.block`/`.tiles`/`.filmstrip`). Requirements — port markup/classes from the mockup reference and wire behavior:
  - **Dropzone**: file input → `uploadToCloudinary(file, 'mas/photos', 'image')` for each; append a new `single` block per uploaded image (or into a "current" block — keep it simple: one `single` block per upload; the user then picks a layout and drags images together). Show a per-file uploading state and per-file error (reuse the existing PhotoUploader error handling shape).
  - **Sortable blocks** via `@dnd-kit` (as PhotoUploader did for photos, but at the block level; keys = `block.id`).
  - **Per block**: `<LayoutPicker value={b.layout} align={b.align} onChange={...} />`; the tiles render from `b.images` using the mockup's `l-*` tile classes; each image has alt + caption inputs and a remove (✕) button; a ★ cover toggle sets cover to that image's `src`.
  - **image-text** blocks: render the `side-text` textarea bound to `b.text`.
  - **carousel** blocks: render the filmstrip (thumbnails of `b.images`) with add/remove; dots are decorative here.
  - **Add-a-block** button appends `newBlock('single')`.
  - All mutations rebuild `blocks` immutably and call `onChange`.
  - The cover image's block shows the `cover` class + filled ★.

- [ ] **Step 2: Remove PhotoUploader**

```bash
git rm src/components/admin/PhotoUploader.tsx
grep -rn "PhotoUploader" src/   # expect no results
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds once `Builder.tsx` (Task 16) references `BlocksEditor` instead of `PhotoUploader`. If the build fails only on `Builder.tsx`, proceed to Task 16 and build there.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/BlocksEditor.tsx
git commit -m "feat: BlocksEditor replaces PhotoUploader (layouts, delete, cover)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Restyle Builder, sub-editors, and save mapping

**Files:**
- Modify: `src/components/admin/Builder.tsx`, `MetaFields.tsx`, `ThemeControls.tsx`, `MusicPicker.tsx`, `Dashboard.tsx`
- Modify: `src/components/admin/api-client.ts`

**Interfaces:**
- Consumes: `BlocksEditor`, `Gallery` (with `blocks`), `saveGallery`.
- Produces: a `Gallery` → API payload mapping that strips client-only `id`s from blocks/images.

- [ ] **Step 1: Rebuild Builder layout**

Rewrite `src/components/admin/Builder.tsx` to the mockup's builder: `.topbar` (wordmark, breadcrumb, save state, **logout** button that POSTs `/api/auth/logout` then `location.href='/admin/login'`, Publish button) + `.builder` two-pane grid (editor left, `LivePreview` right). Sections in order: `MetaFields`, `ThemeControls`, `BlocksEditor`, `MusicPicker`, publish bar. Publish button: disable + spinner while saving; clear success ("Published — building…") / error text; no double-submit (guard on an `isSaving` state).

- [ ] **Step 2: Map to payload on save (strip ids)**

In `Builder.tsx`'s save handler, convert client blocks to the wire shape:

```ts
const payload = {
  ...gallery,
  blocks: gallery.blocks.map((b) => ({
    layout: b.layout, align: b.align, ...(b.text ? { text: b.text } : {}),
    images: b.images.map((im) => ({ src: im.src, alt: im.alt, ...(im.caption ? { caption: im.caption } : {}) })),
  })),
};
// send `payload` (no client ids) to saveGallery
```

And when loading an existing gallery for edit, add client `id`s (in `[slug]/edit.astro`'s initial mapping or a helper): assign `newId()` to each block and image.

- [ ] **Step 3: Restyle sub-editors**

Update `MetaFields.tsx` (title-input, slug chip, place/date/summary, draft/featured), `ThemeControls.tsx` (`.swatches` + `react-colorful` popovers + `.segbar` segmented controls for font/motion/atmosphere), `MusicPicker.tsx` (restyle to `.track`/`.play`/`.wave`; behavior unchanged), and `Dashboard.tsx` (styled gallery list) using the mockup's classes. No behavior change beyond styling and the blocks wiring.

- [ ] **Step 4: 401 handling in api-client**

In `src/components/admin/api-client.ts`, when a response is `401`, redirect to login instead of throwing:

```ts
if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('session expired'); }
```

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build && npm run dev`. Open `/admin/new`: the builder matches the mockup; add photos, switch a block's layout, delete a photo, set a cover, toggle draft. (Publishing requires live GitHub/Cloudinary env — verify the UI states without necessarily committing.)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/
git commit -m "feat: rebuild builder UI to the approved mockup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Script-enabled live preview + blank-date tolerance

**Files:**
- Modify: `src/components/admin/LivePreview.tsx`
- Modify: `src/pages/api/preview.ts`
- Modify: `src/layouts/GalleryLayout.astro` (blank-date guard)

**Interfaces:**
- Consumes: `/api/preview` (POST gallery JSON → HTML).

- [ ] **Step 1: Allow scripts in the preview iframe**

In `src/components/admin/LivePreview.tsx`, change the iframe sandbox to `sandbox="allow-scripts"` (drop `allow-same-origin`) so audio, motion, and the carousel run. Surface fetch failures as a small "preview unavailable" note instead of swallowing them.

- [ ] **Step 2: Render blocks + tolerate blank date**

In `src/pages/api/preview.ts`, build the render input via `normalizeToBlocks` so preview uses `GalleryBlocks` (through `GalleryLayout`). In `src/layouts/GalleryLayout.astro`, guard the date so an unset/blank date renders a placeholder rather than "Invalid Date":

```astro
const validDate = data.date instanceof Date && !isNaN(data.date.getTime());
const dateText = validDate ? data.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Draft — no date yet';
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`; open `/admin/new`; add a couple of photos and pick layouts (incl. a carousel). The live preview renders the layouts, the audio control appears, motion runs, and the carousel dots work. A brand-new gallery with no date shows "Draft — no date yet", not "Invalid Date".

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/LivePreview.tsx src/pages/api/preview.ts src/layouts/GalleryLayout.astro
git commit -m "feat: script-enabled live preview + blank-date tolerance

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase 5 — Docs & full verification

### Task 18: Update the admin setup guide

**Files:**
- Modify: `docs/admin-setup.md`

- [ ] **Step 1: Refresh the checklist**

Update `docs/admin-setup.md`: dev login now works over `http://localhost` with no silent failure; there is a logout button; the builder uses layout blocks (list the nine layouts); the "Create a gallery" and "Verify" steps mention picking a layout per block, deleting photos, carousel dots, and the script-enabled preview (audio + motion visible).

- [ ] **Step 2: Commit**

```bash
git add docs/admin-setup.md
git commit -m "docs: update admin guide for blocks, logout, fixed dev login

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Full test + build gate

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests pass (schema, blocks, frontmatter, auth, and existing helpers).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds; the three migrated galleries render.

- [ ] **Step 3: Manual E2E** against `docs/admin-setup.md` (login over localhost, create with several layouts, delete a photo, set cover, live preview with audio/motion/carousel, draft toggle). Note anything that needs live GitHub/Cloudinary env.

- [ ] **Step 4: Final commit (if anything changed)**

```bash
git add -A
git commit -m "chore: verification pass for admin redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Mockup is law for UI.** When a task says "port from the mockup," open `docs/superpowers/specs/2026-07-04-admin-mockup-reference.html`, copy the relevant `<style>` rules and markup structure, and adapt to React/Astro. Don't invent new styling.
- **Backend stays put.** Don't modify `github.ts`, `cloudinary.ts`, `/api/upload/sign`, `/api/audio`, or the audio schema.
- **Client `id`s never reach disk.** Blocks/images carry `id` only in the React app for stable keys; strip them in the save payload (Task 16) and add them when loading for edit.
- **Zod instance caveat (Task 4):** if `npm run build` complains about the schema type passed to `defineCollection`, ensure `gallery-schema.ts` imports from `zod` (not `astro:content`) and that only one `zod` is installed (`npm ls zod`). Runtime validation is identical.
