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
  `/api/*` route except `/api/auth/login` (returns 401).
- Publishing commits gallery markdown to GitHub via the GitHub API, which triggers a
  Vercel rebuild. The gallery goes live in ~1–2 minutes.
- Photos and audio upload directly from the browser to Cloudinary using server-signed
  requests. Markdown stores the Cloudinary URLs. Audio uses Cloudinary's `video`
  resource type.

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
   in development).
2. You are redirected to `/admin/login`.
3. Enter the value you set as `ADMIN_PASSWORD` and click **Sign in**.
4. A signed session cookie is issued; you stay logged in until the cookie expires or
   you clear it.

---

## The publish → commit → rebuild flow

When you click **Publish** in the gallery editor:

1. The browser POSTs to `/api/galleries` (or `/api/galleries/[slug]` for an edit).
2. The API server commits (or updates) a markdown file under
   `src/content/galleries/` to the configured GitHub branch via the GitHub API.
3. GitHub notifies Vercel, which queues a new production build.
4. The build completes in ~1–2 minutes; the gallery is then live on the site.

Photos and audio are already on Cloudinary before the publish step — they are uploaded
directly from the browser as you add them in the editor. Only the markdown file (with
Cloudinary URLs) is committed to GitHub at publish time.

---

## Verifying it works

The steps below are a manual end-to-end checklist. They require the live services to be
fully configured (all eight env vars set, Cloudinary account active, GitHub token with
write access, Vercel connected to the repo).

**1. Login**
- Open `/admin`.
- Enter the wrong password — confirm you see an error and are not logged in.
- Enter the correct `ADMIN_PASSWORD` — confirm you are redirected to the gallery list.

**2. Create a gallery**
- Click **New gallery** and fill in a title.
- Choose colors (paper, ink, muted, accent) and pick a font, motion, and atmosphere.
- Upload at least three photos; confirm each shows a preview thumbnail.
- Reorder the photos by drag-and-drop; confirm the order is preserved.
- Set a cover image.
- Pick or upload an ambient music track.
- Open the **Live preview** pane — confirm it renders the full gallery with your
  chosen theme, photos in order, and that the audio player appears.

**3. Publish and verify the live site**
- Click **Publish**.
- Confirm the UI shows a success message noting the ~1–2 min rebuild latency.
- Open the GitHub repo and confirm a new commit appears in `src/content/galleries/`.
- Wait ~1–2 minutes, then open the public photography page and confirm the gallery
  appears and looks correct.

**4. Edit the gallery**
- Return to `/admin`, open the gallery, change the accent color and a photo caption.
- Click **Publish** (save).
- After the rebuild, confirm the change is visible on the live site.

**5. Draft toggle**
- In the editor, enable the **Draft** toggle and publish.
- After the rebuild, confirm the gallery is hidden from the public photography listing.
- Re-enable the gallery (turn draft off) and publish to restore it.

**6. Delete the gallery**
- In the gallery list, delete the gallery.
- Confirm the UI shows a success message.
- Open the GitHub repo and confirm a commit removing the markdown file appears.
- After the rebuild, confirm the gallery is gone from the public site.
