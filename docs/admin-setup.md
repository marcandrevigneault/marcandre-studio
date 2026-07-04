# Admin Setup Guide

This guide covers the one-time setup required to use the private gallery-builder admin
at `/admin`. The admin lets you create, edit, preview, and publish photo galleries without
touching code or the command line after initial deployment.

---

## Architecture overview

- The public Astro site is static (prerendered).
- `/admin/*` and `/api/*` routes are server-rendered via the `@astrojs/vercel` adapter.
- Auth: a single password (`ADMIN_PASSWORD`) exchanged at `/admin/login` for a signed
  session cookie. Middleware guards every `/admin/*` route (redirects to login) and every
  `/api/*` route except `/api/auth/login` (returns 401). The cookie's `Secure` attribute
  is only set when the request actually arrived over HTTPS, so signing in over
  `http://localhost` in development works the same as it does in production.
- Sessions last 30 days. Middleware re-issues the cookie on any authenticated `/admin` page
  load once less than 15 days remain, so an active user is never logged out mid-session. A
  **sign out** button (⎋) lives in the builder's topbar and clears the cookie via
  `/api/auth/logout`.
- Publishing commits gallery markdown to GitHub via the GitHub API, which triggers a
  Vercel rebuild. The gallery goes live in ~1–2 minutes.
- Photos and audio upload directly from the browser to Cloudinary using server-signed
  requests. Markdown stores the Cloudinary URLs. Audio uses Cloudinary's `video`
  resource type.
- A gallery's photos are a list of **layout blocks**, not a flat image array. Each block
  has a layout (see "Photo layouts" below) and one or more images; the admin always writes
  `blocks:` frontmatter. Galleries published before this redesign were migrated from the
  old `images:` array to `blocks:`; the site still parses the legacy `images:` format as a
  fallback if it's ever encountered, but the admin itself never writes it.

---

## Prerequisites

You need accounts on three services:

| Service    | What it is used for                              |
|------------|--------------------------------------------------|
| GitHub     | Hosts the repo; galleries are committed here     |
| Vercel     | Builds and hosts the site; rebuilds on each push |
| Cloudinary | Stores full-resolution photos and audio          |

---

## Step 1 — GitHub repo

1. Create a new repository on GitHub (or use an existing one).
2. Push the project:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Generate a Personal Access Token (PAT) with `Contents: Read and write` scope at
   <https://github.com/settings/tokens>. Keep the token; you will need it as
   `GITHUB_TOKEN`.

---

## Step 2 — Vercel project

1. Go to <https://vercel.com> and click **Add New Project**.
2. Import the GitHub repository you just pushed.
3. Vercel auto-detects Astro. Leave the default build command (`npm run build`) and
   output directory (`dist`).
4. Deploy once so the project exists; you will add env vars in Step 4.

---

## Step 3 — Cloudinary account

1. Sign up at <https://cloudinary.com> (the free plan is sufficient to start).
2. From the Cloudinary dashboard note your **Cloud name**, **API Key**, and
   **API Secret** — you will need all three.

---

## Step 4 — Environment variables

Set these in two places: your local `.env` file for development, and in the Vercel
project dashboard (**Settings → Environment Variables**) for production.

Copy `.env.example` to `.env` and fill in every value:

```
ADMIN_PASSWORD=          # the password you will type at /admin/login
SESSION_SECRET=          # a long random string (e.g. openssl rand -hex 32)
GITHUB_TOKEN=            # the PAT from Step 1
GITHUB_REPO=owner/repo   # e.g. marcandrevigneault/marcandre-studio
GITHUB_BRANCH=main       # branch to commit galleries to
CLOUDINARY_CLOUD_NAME=   # from your Cloudinary dashboard
CLOUDINARY_API_KEY=      # from your Cloudinary dashboard
CLOUDINARY_API_SECRET=   # from your Cloudinary dashboard
```

Add the same eight variables in Vercel (**Settings → Environment Variables**), then
trigger a redeployment so they take effect.

---

## Step 5 — Reaching the admin

The admin is intentionally unlinked from the public site. To access it:

1. Navigate to `https://your-domain.vercel.app/admin` (or `http://localhost:4321/admin`
   in development — the login works the same locally as in production).
2. You are redirected to `/admin/login`, a styled password screen.
3. Enter the value you set as `ADMIN_PASSWORD` and click **Sign in**. A wrong password
   shows "That password didn't match." without leaving the page. If `ADMIN_PASSWORD` or
   `SESSION_SECRET` is unset on the server, the login attempt fails with a clear 503
   message telling you which variable is missing, instead of a silent or generic error.
4. A signed session cookie is issued; it's valid for 30 days and slides forward
   automatically while you're actively using the admin, so you stay logged in as long as
   you keep coming back. Click the sign-out icon (⎋) in the builder topbar to log out
   explicitly.

---

## The publish → commit → rebuild flow

When you click **Publish** in the gallery editor:

1. The browser POSTs to `/api/galleries` (or `/api/galleries/[slug]` for an edit).
2. The **Publish** button (topbar and the Publish card) reads "Publishing…" while the
   request is in flight.
3. The API server commits (or updates) a markdown file under
   `src/content/galleries/` to the configured GitHub branch via the GitHub API.
4. On success the status reads "Published — building… live in ~1 min." GitHub notifies
   Vercel, which queues a new production build.
5. The build completes in ~1–2 minutes; the gallery is then live on the site.

Photos and audio are already on Cloudinary before the publish step — they are uploaded
directly from the browser as you add them in the editor. Only the markdown file (with
Cloudinary URLs) is committed to GitHub at publish time.

The **Draft** and **Featured** toggles live in the Publish card, next to the Publish
button — flip Draft on to hide a gallery from the public photography listing without
deleting it, and publish again to apply the change.

---

## Photo layouts

Photos aren't a flat list — each gallery is built from **layout blocks**. Uploading a
batch of photos through the dropzone creates one block per photo (each starting as a
`Single` block); you then pick a layout for each block from the icon rail at the top of
the block, and drag blocks (via the ⋮⋮ grip) to reorder them.

The nine available layouts are:

| Layout | What it shows |
|---|---|
| Single | One photo |
| Full width | One photo, full bleed |
| Two across | Two photos side by side |
| Two tall | Two tall photos side by side |
| Mosaic | One big photo plus three small ones |
| Carousel | A swipeable strip of photos with dot indicators |
| Image left · text right | One photo with a text block beside it |
| Text left · image right | A text block with one photo beside it |
| Four grid | Four photos in a 2×2 grid |

Within a block you can set each image's alt text and caption, remove an image, and (for
`Image left/right` layouts) edit the prose text in a textarea. A carousel block has its
own filmstrip below the preview tile for adding or removing the images grouped into that
carousel. The ★ button on a block sets the gallery cover to that block's first image
(disabled until the block has at least one image).

---

## Verifying it works

The steps below are a manual end-to-end checklist. They require the live services to be
fully configured (all eight env vars set, Cloudinary account active, GitHub token with
write access, Vercel connected to the repo).

**1. Login**
- Open `/admin` over `http://localhost:4321` (dev) — confirm the login screen loads and
  signing in with the correct password works with no silent failure.
- Enter the wrong password — confirm you see "That password didn't match." and are not
  logged in.
- Enter the correct `ADMIN_PASSWORD` — confirm you are redirected to the gallery list.

**2. Create a gallery exercising several layouts**
- Click **New gallery** and fill in a title.
- Choose colors (paper, ink, muted, accent) and pick a font, motion, and atmosphere.
- Drop in at least five photos; confirm each lands as its own `Single` block.
- For a few blocks, use the layout rail to switch to **Two across**, **Mosaic**, and
  **Image left · text right** (add a line of text in its textarea); confirm the tiles
  rearrange to match.
- Switch one block to **Carousel**, then use its filmstrip **+** to add two or three more
  photos into that same carousel block.
- Drag-reorder the blocks (via the ⋮⋮ grip); confirm the order is preserved.
- Delete a photo from a block (✕ on a tile) and confirm it's removed without affecting
  other blocks.
- Set the cover via the ★ button on a block; confirm it applies that block's first image
  as the gallery cover.
- Pick or upload an ambient music track.
- Open the **Live preview** pane — confirm it renders the full gallery with your chosen
  theme and blocks in order, that the ambient audio player works, that motion/entrance
  effects animate, and that the carousel block's dots and swipe navigation work.
- Leave the date field blank and confirm the preview shows "Draft — no date yet" instead
  of erroring.

**3. Publish and verify the live site**
- Click **Publish** — confirm the button reads "Publishing…" while the request is in
  flight, then "Published — building…" on success.
- Open the GitHub repo and confirm a new commit appears in `src/content/galleries/`,
  written with `blocks:` frontmatter (not the legacy `images:` array).
- Wait ~1–2 minutes, then open the public photography page and confirm the gallery
  appears and looks correct, including the carousel and image-text blocks.

**4. Edit the gallery**
- Return to `/admin`, open the gallery, change the accent color and a photo caption.
- Click **Publish** (save).
- After the rebuild, confirm the change is visible on the live site.

**5. Draft toggle**
- In the Publish card, enable the **Draft** toggle and publish.
- After the rebuild, confirm the gallery is hidden from the public photography listing.
- Re-enable the gallery (turn draft off) and publish to restore it.

**6. Logout**
- Click the sign-out icon (⎋) in the topbar.
- Confirm you're redirected to `/admin/login` and that reopening `/admin` redirects you
  back to login rather than the gallery list.

**7. Delete the gallery**
- In the gallery list, delete the gallery.
- Confirm the UI shows a success message.
- Open the GitHub repo and confirm a commit removing the markdown file appears.
- After the rebuild, confirm the gallery is gone from the public site.
