# Lightroom → NAS → R2 Photo Pipeline — Design

**Date:** 2026-08-25
**Status:** Approved design, pending implementation plan

## Goal

Two connected flows, one worker:

1. **Publish flow:** photos the photographer flags as a **pick** in Lightroom (cloud) are automatically exported (edits applied, full size), pushed to Cloudflare R2, and become selectable in the `/admin` gallery builder. The public site serves them from R2 via Cloudflare's CDN.
2. **Backup flow:** every original in the Lightroom cloud library is downloaded to the NAS (via Lightroom desktop's "store a copy of all originals locally" pointed at the NAS mount), with nightly gap detection against Adobe's API inventory — the "leave Adobe someday" insurance.

The site itself stays on Vercel at its current URL. The Cloudinary integration (never activated; env vars are placeholders) is removed.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Photo storage/serving | Cloudflare R2 + CDN (bucket `photo-gallery`, already created) | Zero egress fees, pennies of storage, scales indefinitely, home network stays closed |
| Publish trigger | Lightroom **pick flag** (`flag=pick` in the API) | Color labels (the original wish) are **not exposed** by Adobe's API — verified against the current spec. Pick flag is first-class and filterable. Fallback: album-based trigger is a one-line worker config change |
| Originals backup path | Lightroom desktop local-store → **directly on the NAS SMB mount** (no Mac staging) | Mac has only ~7 GB free; files stream through the Mac without accumulating. Known caveats accepted (below) |
| Public URL for photos | `photos.<domain>` custom domain on the bucket; **r2.dev dev URL as interim** until a domain is purchased in Cloudflare (~$12/yr, user errand, dashboard-only) | Swap is one config value; nothing else reworks |
| Derivative sizes | Display ~3500 px long edge (q≈85) + thumbnail ~800 px, content-hash filenames | "Looks flawless on any screen" without serving 20 MB originals; immutable caching, no stale replacements |
| Quality bar | Web derivatives only on R2; true originals never leave NAS/Adobe | User chose "flawless on any screen" over "actual original files" |
| Worker home | Docker container on the UGREEN NAS (x86_64 Debian 12, Docker 26.1, `/volume1` 11 TB) | Always on, already runs containers, reachable via `ssh nas` |

## Architecture

```
Lightroom (Mac / phone) — photographer flags picks; no other new habit
   │                                            │
   │ (A) Adobe Lightroom API                    │ (B) Lightroom desktop app,
   │     lr.adobe.io/v2, OAuth                  │     "store all originals locally"
   ▼                                            ▼     → NAS SMB mount
┌────────────────────── NAS worker container (cron) ──────────────────────┐
│ PUBLISH (every ~15 min):                                                │
│   list assets updated_since=<high-water> · filter flag=pick             │
│   POST /exports (fullsize JPEG, edits applied) · poll · download        │
│   archive edited fullsize → /volume1/photos/published/                  │
│   derive display+thumb (libvips) · upload via rclone S3 → R2            │
│   rewrite manifest.json LAST (admin never sees half-synced state)       │
│   unflagged picks → remove derivatives from R2 on next pass             │
│ RECONCILE (nightly):                                                    │
│   API full asset inventory vs files under /volume1/photos/originals/    │
│   write status.json → R2 (worker health, token age, backup gaps)        │
└─────────────────────────────────────────────────────────────────────────┘
   ▼
Cloudflare R2 `photo-gallery` → served at photos.<domain> (interim: r2.dev)
   ▲
Website on Vercel (unchanged home):
   /admin gallery builder reads manifest.json → photo picker →
   publish = commit markdown → Vercel rebuild (existing flow)
   public pages render <img> from R2 (thumb in grids, display in lightbox)
   admin shows warning banner when status.json reports problems
```

## Components

### 1. Adobe integration (inside the NAS worker)

- OAuth 2.0 authorization-code against Adobe IMS; credential is an **OAuth Web App** (client ID/secret) from a user-created project in the Adobe Developer Console ("Lightroom Services" API, free, self-service).
- One-time consent runs in a browser on the Mac; the resulting token JSON is copied to the NAS.
- Access tokens last 24 h; **refresh tokens last 14 days and rotate (~7 days)**. The worker refreshes on every run and **atomically persists the newest refresh token**. If refresh fails, `status.json` flips to an error state immediately (surfaced in the admin) — a >14-day outage requires one browser re-consent.
- Endpoints used: `GET /v2/catalog`, `GET /v2/catalogs/{id}/assets?updated_since&flag=pick` (cursor pagination, limit ≤ 500), `POST /assets/{id}/exports` (long_side=fullsize, JPEG) + poll, plus full enumeration for the nightly inventory.
- No documented rate limits; the worker throttles itself politely and retries on the next cron pass rather than in tight loops.

### 2. Publish pipeline (NAS worker, cron ~15 min)

- State on NAS: high-water `updated_since` timestamp, map of published asset-id → content hashes.
- New/updated pick → export → save edited fullsize JPEG to `/volume1/photos/published/<asset-id>.jpg` (this doubles as the only readable backup of *edits* for picked photos) → generate display + thumb with libvips → `rclone` upload to R2 under content-hash keys with long immutable cache headers.
- Pick removed → delete that asset's objects from R2 (the archive copy on NAS stays).
- `manifest.json` (asset id, capture date, dimensions, thumb/display URLs) is rewritten and uploaded **after** all object uploads succeed.
- Idempotent by design: any crash mid-run self-heals on the next pass; logs to `/volume1/photos/logs/`.

### 3. Backup + reconciliation

- Lightroom desktop preference "Store a copy of all originals at the specified location" → folder on the NAS mount (e.g. `/volume1/photos/originals/` via SMB). Files stream through the Mac; nothing accumulates locally.
- Accepted caveats: progress requires Mac awake + Lightroom open + mount connected; Adobe recommends local disks, so **setup step 1 is verifying Lightroom accepts the network volume** — fallback is a small external SSD as rolling buffer.
- Adobe has a documented bug where the local store silently skips files; therefore the nightly reconcile diffs the API inventory against files on disk and reports missing counts in `status.json`.
- Known gap, accepted: develop **edits** of non-picked photos are not backed up in any readable form (Adobe exposes no way to get them); picked photos' edits survive via the archived fullsize exports. Revisit before actually cancelling Adobe.

### 4. Site/admin changes (Astro repo)

- **Remove:** `src/lib/cloudinary.ts`, `src/components/admin/cloudinary-upload.ts`, `src/pages/api/upload/sign.ts`, their tests, and `CLOUDINARY_*` env vars (Vercel + `src/lib/env.ts`).
- **Add:** `src/lib/photos.ts` — fetches and validates `manifest.json` from R2.
- **Admin:** the upload area becomes a **picker** listing manifest photos (newest first, capture-date grouping); selected photos are arranged into galleries; publishing stays commit-markdown → Vercel rebuild. A banner appears when `status.json` reports worker/token/backup problems.
- **Public pages:** `<img>` with explicit width/height from the manifest (no layout shift); thumbnails in grids, display size in the lightbox.
- New env var: `PHOTOS_BASE_URL` (r2.dev URL now, `https://photos.<domain>` later).

### 5. R2 / Cloudflare

- Bucket `photo-gallery` (exists). Enable r2.dev dev URL for the build phase; attach custom domain when the user buys one (dashboard errand).
- Mint a **bucket-scoped S3 API token** for the worker (never the account OAuth token).
- CORS not needed for plain `<img>`; cache headers set at upload time.

## Error handling summary

| Failure | Behavior |
|---|---|
| Adobe API down / rate limited | Skip run; retry next cron; nothing partial published (manifest last) |
| Refresh token expired (>14 d outage) | `status.json` error → admin banner; user re-consents once in browser |
| NAS mount drops during Lightroom download | Lightroom pauses/retries; reconcile counts catch anything silently skipped |
| Worker crash mid-run | Idempotent re-run next cron from persisted state |
| R2 unreachable | Derivatives kept locally; re-upload next pass |

## Testing

- Worker: unit tests for state/manifest/derivative logic against a mocked Adobe API and a local S3 stub (or `rclone` dry-run); one live smoke test against the real catalog with a single test pick.
- Site: existing test patterns (vitest) for `photos.ts` and picker logic; manual end-to-end — flag a pick in Lightroom, watch it appear in the admin within ~15 min, build a gallery, verify the public page serves from R2.

## Out of scope (YAGNI)

Video; multiple derivative formats (AVIF/WebP variants can come later — JPEG only, like Adobe's export); webhooks (none exist for catalogs — polling with `updated_since` suffices); multi-user; watermarking; reading the undocumented `.lrlibrary` database.

## Top risks (from the research spike, 2026-08)

1. **Adobe program instability** — individual self-service API access works today but Adobe is consolidating branding toward enterprise Firefly Services; could gate with little notice. Mitigation: the backup flow doesn't depend on the API for the files themselves.
2. **Auth fragility** — 14-day rotating refresh tokens; mitigated by daily runs, atomic token persistence, loud status surfacing.
3. **Local-store completeness** — Adobe's documented skipped-files bug; mitigated by the nightly reconcile. The network-volume preference may be refused at setup; fallback is an external SSD buffer.

## User actions required (in order)

1. Adobe Developer Console: create project → add "Lightroom Services" → OAuth Web App credential (guided).
2. Run the one-time OAuth consent in the browser (guided).
3. Lightroom desktop: point "store a copy of all originals" at the NAS folder; leave Lightroom open regularly until the initial download completes.
4. Whenever convenient: buy a domain in Cloudflare (dashboard), tell me its name → I attach `photos.<domain>` and flip `PHOTOS_BASE_URL`.

## Suggested implementation phases

- **Phase 1 — Publish pipeline:** Adobe auth + worker container (export → derive → R2 → manifest), r2.dev enabled. Verifiable end-to-end without touching the site.
- **Phase 2 — Site/admin:** remove Cloudinary, add manifest picker, R2-served galleries.
- **Phase 3 — Backup:** local-store setup, nightly reconcile, status surfacing in admin.

Each phase gets its own implementation plan (`docs/superpowers/plans/`).
