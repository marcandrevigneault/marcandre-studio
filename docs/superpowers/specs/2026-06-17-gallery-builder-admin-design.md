# Gallery Builder Admin — Design Spec

**Date:** 2026-06-17
**Status:** Approved design, ready for implementation planning
**Author:** Marc-André (with Claude)

## 1. Purpose

A private, deployed admin panel that lets the site owner (the only admin) build and
manage photo galleries through a GUI instead of hand-editing markdown. The admin can:

- Drop full-resolution photos and have them stored + delivered optimized.
- Choose each gallery's "world": colors, typography, motion, atmosphere.
- Pick or upload an ambient music track.
- See a **live preview** of the real gallery as they build.
- Create, edit, and delete galleries; toggle draft/featured.

The public site stays static and fast; only the admin runs server-side.

## 2. Context

`marcandre.studio` is a static Astro site. Each gallery is a markdown file in
`src/content/galleries/` whose front-matter declares its theme, audio, and image list
(schema in `src/content.config.ts`). Photos currently live in `public/photos/`. Articles
are a separate markdown collection and are **out of scope** for this work.

The existing gallery schema (preserved unchanged):

```
title, place?, date, summary, cover, draft, featured,
theme { paper?, ink?, muted?, accent?, font, motion, atmosphere },
audio? { src, title, loop },
images[] { src, alt, caption?, span }
```

## 3. Key decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Where it runs | **Deployed** admin behind a login (not local-only) |
| Hosting | **Vercel** |
| Publish model | **Commit markdown to git → Vercel rebuild** (~1–2 min to live) |
| Photo storage | **Cloudinary** (external CDN, on-the-fly transforms) |
| Audio storage | Cloudinary; **pick existing or upload new** (uploads join the library) |
| Capabilities | **Full manage**: create / edit / delete, draft↔publish, featured, reorder photos |
| Preview | **Live preview pane** rendering the real gallery layout |
| Admin UI framework | **React** (isolated to admin; not loaded on public pages) |
| Auth | **Single password** → signed session cookie |

## 4. Architecture

### 4.1 Rendering modes
Add the `@astrojs/vercel` adapter in **hybrid** configuration:

- All existing public pages stay **prerendered** (static) — zero change to visitor
  performance and near-zero client JS.
- New `/admin/*` and `/api/*` routes are **server-rendered** (`export const prerender = false`).

### 4.2 Components / units (each independently understandable + testable)

1. **Auth module** (`src/lib/auth.ts`)
   - `verifyPassword(input)` against `ADMIN_PASSWORD`.
   - `createSession()` / `readSession(cookie)` — signed (HMAC) session cookie, no DB.
   - `requireAuth(context)` guard used by every admin page and API route.

2. **GitHub content store** (`src/lib/github.ts`)
   - Wraps Octokit with `GITHUB_TOKEN`, target `owner/repo`, branch.
   - `listGalleries()` — read `src/content/galleries/*.md`, parse front-matter.
   - `getGallery(slug)` — read + parse one file.
   - `writeGallery(slug, data)` — serialize front-matter + body, create/update file (commit).
   - `deleteGallery(slug)` — remove file (commit).
   - Each write is one commit; the commit triggers Vercel's git rebuild.

3. **Cloudinary module** (`src/lib/cloudinary.ts`)
   - `signUpload(params)` — server signs a direct browser→Cloudinary upload (photos + audio),
     so large files never pass through the serverless function.
   - Helper to build delivery URLs / responsive transforms for stored `public_id`s.
   - `listAudio()` — list tracks in the audio folder for the "pick existing" dropdown.

4. **Front-matter serializer** (`src/lib/frontmatter.ts`)
   - `serialize(galleryData) -> markdown string` (YAML front-matter + optional intro body).
   - `parse(markdown) -> galleryData`. Round-trips cleanly with the existing schema.
   - Validated against the same Zod schema shape used by `content.config.ts`.

5. **Admin React app** (`src/components/admin/`, hydrated island)
   - `Dashboard` — gallery list with badges + New / Edit / Delete.
   - `Builder` — two-pane editor (form + live preview iframe).
   - `PhotoUploader` — drag-drop, progress, reorder (dnd), per-photo alt/caption/span, cover pick.
   - `ThemeControls` — color pickers (paper/ink/muted/accent) + font/motion/atmosphere selects.
   - `MusicPicker` — choose from `listAudio()` or upload new (joins library).
   - `MetaFields` — title, place, date, summary, draft, featured.

6. **Admin pages** (`src/pages/admin/`, server-rendered)
   - `login.astro`, `index.astro` (dashboard), `new.astro`, `[slug]/edit.astro`, `preview.astro`.

7. **API routes** (`src/pages/api/`, server-only)
   - `POST /api/auth/login` — password → session cookie.
   - `POST /api/auth/logout`.
   - `POST /api/upload/sign` — signed Cloudinary upload params.
   - `GET /api/galleries` — list.
   - `GET /api/galleries/[slug]` — read one.
   - `POST /api/galleries` — create/update (writes markdown via GitHub).
   - `DELETE /api/galleries/[slug]` — delete.
   - `POST /api/preview` — render draft gallery data through the real layout (for the live pane).

### 4.3 Live preview
The preview pane is an `<iframe>` pointing at `/admin/preview`. As the form state changes
(debounced), the builder posts the draft gallery JSON to `POST /api/preview`, which renders
the gallery using the **actual** `GalleryLayout` + `PhotoGrid` components against the draft
data. This guarantees the preview matches production exactly (colors, font, motion,
atmosphere, photo spans, audio control).

## 5. Data flow

**Publish:**
```
drop full-res photo
  → POST /api/upload/sign  → browser uploads directly to Cloudinary
  → Cloudinary public_id/URL returns to form state
  → live preview updates (debounced → /api/preview)
  → click Publish
  → serialize front-matter (frontmatter.ts)
  → POST /api/galleries → GitHub commit (github.ts)
  → Vercel detects commit → rebuild (~1–2 min)
  → gallery live on marcandre.studio
```

**Edit / delete** follow the same path (read file → edit in builder → commit; or delete →
commit). **Save draft** writes the file with `draft: true` (visible in `npm run dev`,
hidden from production build).

## 6. Auth

- `/admin/*` and all `/api/*` routes call `requireAuth`. Unauthenticated requests to
  `/admin/*` redirect to `/admin/login`; API routes return `401`.
- Login: password compared to `ADMIN_PASSWORD` (constant-time). On success, set an
  HTTP-only, signed, `SameSite=Strict` session cookie (HMAC over an expiry timestamp using
  `SESSION_SECRET`). No database needed.
- The admin is unlinked from the public site (reachable only by typing the URL) **and**
  password-protected.

## 7. Error handling

- **Upload failures** (Cloudinary): per-file error state in the uploader; the photo isn't
  added to the gallery until its upload succeeds. Retry per file.
- **GitHub write failures**: surfaced as a toast with the API error; the in-progress form
  state is preserved so nothing is lost. Conflict (file changed upstream) → reload + warn.
- **Auth expiry**: API `401` → client redirects to login, preserving unsaved draft in
  local component state where possible.
- **Validation**: front-matter is validated before commit; invalid galleries are blocked
  with field-level messages (e.g. missing alt text, no cover selected).
- **Rebuild latency**: after publish, show a "Published — live in ~1–2 min" confirmation so
  the delay is expected, not confusing.

## 8. Testing

- **Unit:** `frontmatter.ts` round-trip (parse∘serialize == identity on sample galleries,
  including the two existing ones), `auth.ts` cookie sign/verify + expiry, Cloudinary
  signature generation.
- **Integration:** API routes with a mocked GitHub (Octokit) + mocked Cloudinary — create,
  edit, delete, list; auth guard returns 401 when unauthenticated.
- **Manual / e2e checklist:** log in; build a gallery end-to-end (upload photos, set theme,
  pick music, live preview matches); publish → confirm commit + rebuild → live; edit; delete.

## 9. Setup prerequisites (one-time)

This model needs the repo on GitHub and connected to Vercel. The current folder is **not a
git repo yet**, so first-run setup:

1. `git init`, commit, push to a new **GitHub repo**.
2. Connect the repo to **Vercel**; add `@astrojs/vercel` adapter.
3. Create a **Cloudinary** account.
4. Set env vars locally (`.env`) **and** in Vercel:
   - `ADMIN_PASSWORD`, `SESSION_SECRET`
   - `GITHUB_TOKEN`, `GITHUB_REPO` (owner/repo), `GITHUB_BRANCH`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## 10. Out of scope (YAGNI)

- Multi-user accounts / roles (single admin only).
- Editing science articles through the GUI (markdown stays hand-edited).
- Instant publish without rebuild (rejected in favor of the git model).
- On-the-fly migration of existing `public/photos/` images to Cloudinary (existing galleries
  keep their current paths; new uploads go to Cloudinary). Can be revisited later.

## 11. Suggested implementation phases

1. **Foundation:** Vercel adapter (hybrid), env config, auth module + login page + guard.
2. **Content store:** `frontmatter.ts` (+ tests), `github.ts`, galleries API (read/list).
3. **Builder skeleton:** dashboard + builder shell (meta + theme fields), write/commit path.
4. **Media:** Cloudinary signing + `PhotoUploader` (drag-drop, reorder, per-photo fields) +
   `MusicPicker`.
5. **Live preview:** `/api/preview` + iframe pane wired to form state.
6. **Polish:** delete, draft/featured toggles, error/toast handling, e2e pass.
