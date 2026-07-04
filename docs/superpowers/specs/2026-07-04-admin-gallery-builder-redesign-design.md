# Admin & Gallery-Builder Redesign — Design

**Date:** 2026-07-04
**Status:** Approved (design), pending implementation plan
**Mockup:** `scratchpad/admin-mockup.html` (interactive: sign-in + builder with all block layouts)

---

## 1. Goal

Make the private admin at `/admin` pleasant to use:

1. **Easy, reliable login** — a styled sign-in that matches the site, stays signed in, and stops
   silently failing in local development.
2. **A beautiful gallery builder** — a single-screen editor with a real live preview, and a
   richer set of photo **layouts** (two-across, two-tall, mosaic, carousel, image + text, four-grid)
   so a gallery reads as a composed piece rather than a flat grid.

The backend (GitHub-commit publishing, signed direct-to-Cloudinary uploads, the stateless signed
session cookie) is sound and is **kept**. This work is concentrated in the data model, the public
renderer, the login experience, and the builder UI.

Non-goals: multi-user accounts, a CMS for articles, image editing/cropping, reworking the public
site's visual identity.

---

## 2. Current state (what we're changing)

- **Login** (`src/pages/admin/login.astro`, `src/lib/auth.ts`): a bare unstyled form; the session
  cookie is always `Secure`, which some browsers refuse to store over `http://localhost`, so login
  "succeeds" then bounces back to the login page in dev with no error. 7-day expiry, no refresh, no
  logout button anywhere. Button says "Enter"; docs say "Sign in".
- **Data model** (`src/lib/gallery-schema.ts`): a gallery holds a flat `images: [{src, alt, caption?,
  span: 'single'|'wide'}]`. Only two arrangements are possible. The schema is **hand-duplicated** in
  `src/content.config.ts`, so the admin and the public build can silently drift.
- **Public render** (`src/components/PhotoGrid.astro`): one responsive auto-fill grid; `span: 'wide'`
  spans the full row. A shared lightbox opens any image.
- **Builder** (`src/components/admin/*`): a React island with essentially **no styling** (raw browser
  inputs). No way to delete an uploaded photo. Confusing cover selection. Publish shows only a bare
  status string and can double-submit. The live preview iframe has no `allow-scripts`, so audio and
  motion never appear. A blank new gallery renders "Invalid Date".

---

## 3. Data model — layout blocks

A gallery's photos become an ordered list of **blocks**. Each block chooses a `layout` and holds the
images (and, for one layout, prose text) that fill it.

### 3.1 New schema (canonical, single source of truth)

`src/lib/gallery-schema.ts` remains the one canonical module. `src/content.config.ts` **imports**
from it instead of re-declaring, ending the drift risk.

```ts
// image within a block
const blockImageSchema = z.object({
  src: z.string(),                 // Cloudinary secure_url
  alt: z.string(),                 // required, accessibility
  caption: z.string().optional(),
});

const blockSchema = z.object({
  layout: z.enum([
    'single',    // 1 image, contained width
    'full',      // 1 image, full-bleed row  (the "big image")
    'two',       // 2 images side by side
    'twotall',   // 2 portrait images side by side
    'mosaic',    // 1 big + 3 small           (4 images)
    'carousel',  // N images, swipe + dots    (>=2 images)
    'image-text',// 1 image + prose beside it
    'quad',      // 2x2 grid                   (4 images)
  ]),
  images: z.array(blockImageSchema).default([]),
  text: z.string().optional(),                       // image-text only
  align: z.enum(['left', 'right']).default('left'),  // image-text: which side the image sits
});
```

The gallery schema gains `blocks` and **keeps `images` as an optional legacy field** so any
un-migrated content still parses during the transition:

```ts
export const gallerySchema = z.object({
  title, place?, date, summary, cover, draft, featured, theme, audio,   // unchanged
  images: z.array(imageSchema).default([]),  // LEGACY — retained for one-time migration
  blocks: z.array(blockSchema).default([]),  // NEW — canonical going forward
});
```

Image counts per layout are enforced by the **builder** (it won't let you leave a `two` block with
one photo); the schema stays permissive so the public renderer is never blocked by a partial block —
it renders whatever images a block actually contains.

### 3.2 Normalization & migration

- `normalizeToBlocks(fields)` — a pure helper: if `blocks` is non-empty, use it; otherwise convert
  legacy `images[]` → blocks (`span: 'wide'` → a `full` block; `span: 'single'` → a `single` block),
  preserving order. Both the public renderer and the preview endpoint call this, so old and new
  content both render.
- **One-time migration**: a small script (or manual edit) rewrites the three existing galleries
  (`kyoto-rain.md`, `salt-and-light.md`, `between-tides.md`) into the `blocks` form and drops their
  legacy `images:` key. `cover` (the hero) is untouched.
- After migration the `images` legacy field remains accepted but unused; it can be removed in a later
  cleanup once we're confident nothing writes it.

### 3.3 Cover

`cover` stays a top-level hero-image path (the header background), unchanged. In the builder, the ★
control sets `cover` to that image's `src`; a new gallery defaults `cover` to the first image added.

---

## 4. Public rendering

Replace `PhotoGrid.astro` with **`GalleryBlocks.astro`** (invoked from `GalleryLayout.astro`), which
maps each block to a layout and reuses the existing lightbox. Every image in every layout remains
clickable to open full-size.

Layout → markup:

| Layout       | Arrangement                                                        |
|--------------|--------------------------------------------------------------------|
| `single`     | contained image, caption below                                     |
| `full`       | full-row image (`grid-column: 1 / -1`)                             |
| `two`        | 2-col grid                                                         |
| `twotall`    | 2-col grid, portrait aspect                                        |
| `mosaic`     | `grid-template-columns: 1.7fr 1fr`, big image spans 3 rows + 3 small |
| `carousel`   | horizontal scroll-snap track + dot indicators + prev/next          |
| `image-text` | 2-col: image one side, prose the other (`align` picks the side); stacks on mobile |
| `quad`       | 2x2 grid                                                           |

- All layouts inherit the gallery's theme tokens, `data-reveal` motion, and atmosphere overlays,
  exactly as today.
- **Carousel** is progressive enhancement: without JS it is a horizontally scrollable strip; with JS,
  dots + prev/next drive scroll-snap and an IntersectionObserver highlights the active dot. Respects
  `prefers-reduced-motion` (no auto-advance; instant scroll).
- Captions render per image (`figcaption`) where the layout has room; the lightbox caption uses the
  image's `caption ?? alt`, as now.

---

## 5. Login

Keep the single shared password (`ADMIN_PASSWORD`) and the stateless HMAC-signed cookie. Fix the
experience:

1. **Conditional `Secure`** — `createSessionCookie(isSecure)` / `clearSessionCookie(isSecure)` omit
   the `Secure` attribute over plain-HTTP localhost and set it on HTTPS. The login endpoint and
   middleware derive `isSecure` from the request (URL protocol / `x-forwarded-proto`). This removes
   the silent dev-login failure.
2. **30-day session with sliding refresh** — bump `MAX_AGE` to 30 days. Middleware re-issues a fresh
   cookie on authenticated `/admin/*` page loads so an active user is never logged out mid-session.
3. **Logout** — a logout control in the builder/admin top bar POSTs to the existing
   `/api/auth/logout`, clears the cookie, and returns to `/admin/login`.
4. **Rebuilt login screen** — matches the mockup: paper card, serif "Studio." wordmark, one password
   field, a real submit **loading state**, a clear inline error on wrong password, and a caught
   network-error message. Button label: **"Sign in"**. Helper text: "Stays signed in for 30 days on
   this device."
5. **Friendly missing-env guard** — if `ADMIN_PASSWORD`/`SESSION_SECRET` are unset, surface a clear
   message instead of a raw 500 from middleware.

Cookie remains `HttpOnly; SameSite=Strict; Path=/`. `SameSite=Strict` continues to cover CSRF for
same-origin mutations.

---

## 6. Builder UI

A single screen: a top bar over a two-pane body — a calm sectioned editor on the left, a sticky
**live preview** on the right that renders the gallery in *its own theme* (see mockup). Below 900px
the preview collapses behind a toggle.

**Top bar:** "Studio." wordmark · breadcrumb (`Galleries / <title>`) · autosave state · logout ·
**Publish** button.

**Sections (top to bottom):**

1. **Details** — title (auto-slugifies; slug shown as a chip, locked on edit), place, date, summary.
2. **The look** — four palette swatches (`react-colorful`) for paper/ink/muted/accent; segmented
   controls for font / motion / atmosphere.
3. **Photos** — the **blocks editor** (see 6.1).
4. **Sound** — the existing music picker (library `<select>` + upload), restyled, with a play/preview
   control.
5. **Publish** — draft / featured toggles; a primary Publish button with the "live in ~1 min" note.

### 6.1 Blocks editor (replaces `PhotoUploader`)

- A dropzone uploads photos (direct-to-Cloudinary, unchanged signing path). New uploads land in a
  block.
- Blocks are a **dnd-kit** sortable list. Each block has:
  - a **layout picker** in its header — a rail of nine little diagram icons (Single, Full, Two across,
    Two tall, Mosaic, Carousel, Image-left, Image-right, Four grid); clicking one changes the block's
    layout. "Image-left" and "Image-right" are the same `image-text` layout with `align` set to
    `left`/`right` — two icons, one layout type.
  - its image slot(s) as thumbnails, each with **alt** and optional **caption** fields, and a
    **remove** control (fixes the missing-delete bug).
  - a **★ cover** toggle (sets the gallery `cover`).
  - a **remove block** control.
  - **image-text** blocks show a prose `textarea` beside the image and an align (left/right) toggle.
  - **carousel** blocks show a **filmstrip** below the frame to add/reorder/remove the grouped images,
    plus the dot indicator.
- Changing a layout that needs more images than present prompts the user to add photos to that block;
  extra images beyond a fixed-count layout (e.g. `quad`) are kept but only the first N render (the
  editor shows this state clearly — no silent drops).
- Keys/dnd ids use a **stable per-block/per-image id** (not the Cloudinary `src`), fixing the
  duplicate-key/broken-reorder bug when the same file is uploaded twice.

### 6.2 Live preview

- The preview iframe uses `sandbox="allow-scripts"` so audio, scroll-motion, and the carousel run —
  the current preview blocks all scripts. Content is same-origin-trusted HTML we generate and the
  endpoint is auth-gated.
- The preview endpoint (`/api/preview`) calls `normalizeToBlocks` and renders via `GalleryBlocks`, and
  tolerates an **empty/blank date** (renders "Draft — no date yet" instead of "Invalid Date").
- Debounced render stays, but preview fetch failures surface a small "preview unavailable" note rather
  than being swallowed.

### 6.3 Publish & session robustness

- Publish button disables + shows a spinner while saving; on success a clear "Published — building…"
  state; on error a readable message. No double-submit.
- `api-client` treats a `401` as an expired session and redirects to `/admin/login` rather than
  throwing a raw error.

---

## 7. Backend (kept, lightly hardened)

- **Persistence** (`src/lib/github.ts`, `serializeGallery`): unchanged commit-based flow. Serialization
  now emits `blocks:` (and no `images:` for new/edited galleries). Date normalization to `YYYY-MM-DD`
  is retained.
- **Uploads** (`/api/upload/sign`, `src/lib/cloudinary.ts`): unchanged.
- **Tighten slug validation**: `GET`/`DELETE /api/galleries/[slug]` validate `slug` against
  `/^[a-z0-9-]+$/` (the `POST` path already does).
- **Optional (low priority):** `listGalleries` currently does N+1 GitHub calls; fine at 3 galleries,
  noted for later.

---

## 8. Components & boundaries

| Unit | Responsibility |
|------|----------------|
| `src/lib/gallery-schema.ts` | **Single** canonical Zod schema (theme, audio, block, gallery) + `normalizeToBlocks`. Imported by admin, API, preview, and `content.config.ts`. |
| `src/content.config.ts` | Imports the shared schema; no duplicate declaration. |
| `src/components/GalleryBlocks.astro` | Public renderer: blocks → layouts + lightbox + carousel JS. Replaces `PhotoGrid.astro`. |
| `src/lib/auth.ts` | Cookie sign/verify with **conditional `Secure`**, 30-day max-age, sliding-refresh helper. |
| `src/pages/admin/login.astro` | Rebuilt styled sign-in with loading/error states. |
| `src/components/admin/BlocksEditor.tsx` | New. Sortable blocks, per-block layout picker, per-image alt/caption/remove, cover, carousel filmstrip. Replaces `PhotoUploader.tsx`. |
| `src/components/admin/{MetaFields,ThemeControls,MusicPicker,Builder,Dashboard}.tsx` | Restyled to the mockup; unchanged responsibilities. |
| `src/components/admin/admin.css` (or scoped modules) | New admin stylesheet — the mockup's design tokens/components. `global.css` (public tokens) is untouched. |
| `src/pages/api/preview.ts` | Renders via `GalleryBlocks`, tolerates blank date. |

---

## 9. Testing

- **Unit:** `normalizeToBlocks` (legacy `images` → blocks; passthrough when `blocks` present);
  serialize→parse round-trip of a gallery with each block layout; conditional-`Secure` cookie logic;
  slug validation. Keep existing `slugify`/`api-client`/`cloudinary-upload` tests.
- **Manual E2E checklist** in `docs/admin-setup.md`, updated for: dev login over localhost (no silent
  failure), logout, each of the nine block layouts, carousel dots, photo delete, cover selection, the
  script-enabled live preview (audio + motion + carousel visible), publish states, draft toggle.
- Migration verified by building the site after rewriting the three galleries.

---

## 10. Suggested phasing (for the implementation plan)

1. **Schema + backend:** shared schema, `normalizeToBlocks`, serialization of `blocks`, slug
   hardening, unit tests. Migrate the three galleries.
2. **Public render:** `GalleryBlocks.astro` with all nine layouts + carousel; wire into
   `GalleryLayout`; verify the migrated galleries build and look right.
3. **Login:** conditional `Secure`, 30-day sliding session, logout, rebuilt login screen, env guard.
4. **Builder UI:** admin stylesheet + restyled sections; `BlocksEditor`; script-enabled preview;
   publish/401 robustness. Match the mockup.
5. **Docs:** refresh `docs/admin-setup.md`.

Each phase is independently verifiable (build passes / tests pass / screen matches mockup) before the
next.
