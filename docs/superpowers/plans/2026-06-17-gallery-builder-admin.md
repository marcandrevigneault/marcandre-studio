# Gallery Builder Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private, password-protected admin at `/admin` for building/managing photo galleries (photos → Cloudinary, markdown → git commit → Vercel rebuild), with a live preview rendered by the real gallery layout.

**Architecture:** Public pages stay statically prerendered; `/admin/*` and `/api/*` run server-side via the Vercel adapter (hybrid). Gallery markdown is read/written through the GitHub API; full-res photos and audio upload directly from the browser to Cloudinary via server-signed requests. A React island provides the dashboard + two-pane builder; the live preview iframe re-renders the actual `GalleryLayout`/`PhotoGrid` from draft data.

**Tech Stack:** Astro 6, `@astrojs/vercel`, `@astrojs/react` + React 18, `@octokit/rest`, `cloudinary` (Node SDK), `gray-matter` + `js-yaml`, `zod` (already present), `@dnd-kit/core` + `@dnd-kit/sortable`, `react-colorful`, `vitest` for tests.

## Global Constraints

- Astro version floor: `astro@^6.4.8` (already installed). Do not downgrade.
- Public pages MUST remain prerendered (static). Only `/admin/*` and `/api/*` set `export const prerender = false`.
- Existing gallery schema in `src/content.config.ts` is the source of truth — do NOT change its shape. The serializer round-trips it.
- Never load admin React code on public pages.
- All `/admin/*` pages and `/api/*` routes (except `/api/auth/login`) MUST pass the auth guard.
- Env vars (local `.env` + Vercel): `ADMIN_PASSWORD`, `SESSION_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPO` (owner/repo), `GITHUB_BRANCH`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Secrets are read server-side only; never expose `*_SECRET`/`*_TOKEN`/`ADMIN_PASSWORD` to client code.
- Commit after every task. Follow TDD: failing test → minimal code → passing test → commit.

---

## File Structure

**New library modules (`src/lib/`):**
- `src/lib/env.ts` — typed, validated access to server env vars.
- `src/lib/auth.ts` — password check + signed session cookie + `requireAuth` guard.
- `src/lib/frontmatter.ts` — parse/serialize gallery markdown ↔ data object.
- `src/lib/gallery-schema.ts` — shared Zod schema for a gallery's data (reused by API + serializer).
- `src/lib/github.ts` — list/get/write/delete gallery markdown via Octokit.
- `src/lib/cloudinary.ts` — sign uploads, list audio, build delivery URLs.

**API routes (`src/pages/api/`, all `prerender = false`):**
- `auth/login.ts`, `auth/logout.ts`
- `upload/sign.ts`
- `galleries/index.ts` (GET list, POST create/update)
- `galleries/[slug].ts` (GET one, DELETE)
- `preview.ts`

**Admin pages (`src/pages/admin/`, all `prerender = false`):**
- `login.astro`, `index.astro`, `new.astro`, `[slug]/edit.astro`, `preview.astro`

**Admin React island (`src/components/admin/`):**
- `AdminApp.tsx` (root, routes between dashboard/builder via props), `Dashboard.tsx`, `Builder.tsx`, `PhotoUploader.tsx`, `ThemeControls.tsx`, `MusicPicker.tsx`, `MetaFields.tsx`, `LivePreview.tsx`, `api-client.ts` (browser fetch helpers), `types.ts` (shared TS types).

**Config:**
- `astro.config.mjs` — add adapter + react integration.
- `vitest.config.ts`, `.env.example`, `package.json` (deps + test script).

---

## Task 1: Project config — adapter, React, test harness, env module

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): Env` returning `{ adminPassword, sessionSecret, githubToken, githubRepo, githubBranch, cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret }`; throws `Error` listing any missing keys. `Env` type exported.

- [ ] **Step 1: Install dependencies**

```bash
npm install @astrojs/vercel @astrojs/react react react-dom @octokit/rest cloudinary gray-matter js-yaml @dnd-kit/core @dnd-kit/sortable react-colorful
npm install -D vitest @types/react @types/react-dom @types/js-yaml
```

- [ ] **Step 2: Add test script to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write the failing test for env**

Create `src/lib/env.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getEnv } from './env';

const FULL = {
  ADMIN_PASSWORD: 'pw', SESSION_SECRET: 'sec',
  GITHUB_TOKEN: 'tok', GITHUB_REPO: 'me/repo', GITHUB_BRANCH: 'main',
  CLOUDINARY_CLOUD_NAME: 'cn', CLOUDINARY_API_KEY: 'ak', CLOUDINARY_API_SECRET: 'as',
};

afterEach(() => vi.unstubAllEnvs());

describe('getEnv', () => {
  it('returns typed config when all vars present', () => {
    for (const [k, v] of Object.entries(FULL)) vi.stubEnv(k, v);
    const env = getEnv();
    expect(env.githubRepo).toBe('me/repo');
    expect(env.cloudinaryApiSecret).toBe('as');
  });

  it('throws listing every missing key', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    expect(() => getEnv()).toThrow(/GITHUB_TOKEN/);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/lib/env.test.ts`
Expected: FAIL — cannot find module `./env`.

- [ ] **Step 6: Implement src/lib/env.ts**

```ts
export interface Env {
  adminPassword: string;
  sessionSecret: string;
  githubToken: string;
  githubRepo: string;
  githubBranch: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

const KEYS: Record<keyof Env, string> = {
  adminPassword: 'ADMIN_PASSWORD',
  sessionSecret: 'SESSION_SECRET',
  githubToken: 'GITHUB_TOKEN',
  githubRepo: 'GITHUB_REPO',
  githubBranch: 'GITHUB_BRANCH',
  cloudinaryCloudName: 'CLOUDINARY_CLOUD_NAME',
  cloudinaryApiKey: 'CLOUDINARY_API_KEY',
  cloudinaryApiSecret: 'CLOUDINARY_API_SECRET',
};

export function getEnv(): Env {
  const out = {} as Env;
  const missing: string[] = [];
  for (const [field, envName] of Object.entries(KEYS) as [keyof Env, string][]) {
    const val = process.env[envName];
    if (!val) missing.push(envName);
    else out[field] = val;
  }
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  return out;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- src/lib/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Configure Astro adapter + React (hybrid rendering)**

Replace `astro.config.mjs` integrations/adapter section so it reads:

```js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://marcandre.studio',
  output: 'static',
  adapter: vercel(),
  integrations: [mdx(), sitemap(), react()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: 'css-variables' },
  },
});
```

Note: `output: 'static'` + an adapter gives per-route opt-in to server rendering via `export const prerender = false`. Public pages stay static automatically.

- [ ] **Step 9: Create .env.example and update .gitignore**

Create `.env.example`:

```
ADMIN_PASSWORD=
SESSION_SECRET=
GITHUB_TOKEN=
GITHUB_REPO=owner/repo
GITHUB_BRANCH=main
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Ensure `.gitignore` contains `.env` (add the line if absent; `.env.example` stays tracked).

- [ ] **Step 10: Verify build still works**

Run: `npm run build`
Expected: build succeeds; existing pages prerender unchanged.

- [ ] **Step 11: Commit**

```bash
git add astro.config.mjs package.json package-lock.json vitest.config.ts .env.example .gitignore src/lib/env.ts src/lib/env.test.ts
git commit -m "feat: add vercel adapter, react, vitest, env config"
```

---

## Task 2: Auth module (password + signed session cookie + guard)

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `getEnv()` from Task 1.
- Produces:
  - `verifyPassword(input: string): boolean` — constant-time compare to `ADMIN_PASSWORD`.
  - `createSessionCookie(): string` — `Set-Cookie` value (HttpOnly, Secure, SameSite=Strict, Path=/, signed, 7-day expiry).
  - `clearSessionCookie(): string` — expired cookie to log out.
  - `isValidSession(cookieHeader: string | null): boolean` — verify HMAC + non-expired.
  - `SESSION_COOKIE_NAME = 'mas_session'` constant.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyPassword, createSessionCookie, clearSessionCookie,
  isValidSession, SESSION_COOKIE_NAME,
} from './auth';

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', 'hunter2');
  vi.stubEnv('SESSION_SECRET', 'topsecret');
  // other env vars not needed by auth paths under test
  vi.stubEnv('GITHUB_TOKEN', 'x'); vi.stubEnv('GITHUB_REPO', 'a/b');
  vi.stubEnv('GITHUB_BRANCH', 'main'); vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'c');
  vi.stubEnv('CLOUDINARY_API_KEY', 'k'); vi.stubEnv('CLOUDINARY_API_SECRET', 's');
});

describe('auth', () => {
  it('verifies correct password and rejects wrong', () => {
    expect(verifyPassword('hunter2')).toBe(true);
    expect(verifyPassword('nope')).toBe(false);
  });

  it('round-trips a valid session cookie', () => {
    const setCookie = createSessionCookie();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    const value = setCookie.split(';')[0]; // "mas_session=<token>"
    expect(isValidSession(value)).toBe(true);
  });

  it('rejects tampered or missing session', () => {
    expect(isValidSession(null)).toBe(false);
    expect(isValidSession(`${SESSION_COOKIE_NAME}=garbage.sig`)).toBe(false);
  });

  it('clearSessionCookie expires the cookie', () => {
    expect(clearSessionCookie()).toMatch(/Max-Age=0|Expires=/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — cannot find module `./auth`.

- [ ] **Step 3: Implement src/lib/auth.ts**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from './env';

export const SESSION_COOKIE_NAME = 'mas_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyPassword(input: string): boolean {
  return safeEqual(input, getEnv().adminPassword);
}

export function createSessionCookie(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = String(exp);
  const token = `${payload}.${sign(payload, getEnv().sessionSecret)}`;
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ].join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isValidSession(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(SESSION_COOKIE_NAME.length + 1);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, getEnv().sessionSecret))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add auth module with signed session cookies"
```

---

## Task 3: Gallery schema + front-matter serializer

**Files:**
- Create: `src/lib/gallery-schema.ts`
- Create: `src/lib/frontmatter.ts`
- Test: `src/lib/frontmatter.test.ts`

**Interfaces:**
- Produces:
  - `gallerySchema` (Zod) and `type GalleryData` mirroring `content.config.ts` fields plus `body: string` (the intro markdown) and `slug: string`.
  - `parseGallery(slug: string, markdown: string): GalleryData`.
  - `serializeGallery(data: GalleryData): string` — YAML front-matter + body. `parse∘serialize` is identity on field values.

- [ ] **Step 1: Write the failing test**

Create `src/lib/frontmatter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGallery, serializeGallery, gallerySchema } from './frontmatter';

const SAMPLE = `---
title: A Morning in the Alps
place: Chamonix, France
date: 2026-06-01
summary: One sentence that sets the mood.
cover: https://res.cloudinary.com/x/image/upload/alps_cover.jpg
draft: false
featured: true
theme:
  paper: "#0e1320"
  ink: "#eef2f8"
  font: serif
  motion: drift
  atmosphere: vignette
audio:
  src: https://res.cloudinary.com/x/video/upload/wind.mp3
  title: Wind on the glacier
  loop: true
images:
  - src: https://res.cloudinary.com/x/image/upload/01.jpg
    alt: A ridge at dawn
    caption: First light
    span: wide
---
<p class="intro">An optional opener.</p>`;

describe('frontmatter', () => {
  it('parses a gallery into typed data', () => {
    const g = parseGallery('alps', SAMPLE);
    expect(g.slug).toBe('alps');
    expect(g.title).toBe('A Morning in the Alps');
    expect(g.featured).toBe(true);
    expect(g.theme.motion).toBe('drift');
    expect(g.audio?.title).toBe('Wind on the glacier');
    expect(g.images).toHaveLength(1);
    expect(g.images[0].span).toBe('wide');
    expect(g.body.trim()).toBe('<p class="intro">An optional opener.</p>');
  });

  it('round-trips (parse -> serialize -> parse) preserving values', () => {
    const g1 = parseGallery('alps', SAMPLE);
    const md = serializeGallery(g1);
    const g2 = parseGallery('alps', md);
    expect(g2).toEqual(g1);
  });

  it('validates against the schema (rejects missing alt)', () => {
    const bad = { images: [{ src: 'x', span: 'single' }] };
    expect(() => gallerySchema.parse({
      title: 't', date: '2026-01-01', summary: 's', cover: 'c', ...bad,
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/frontmatter.test.ts`
Expected: FAIL — cannot find module `./frontmatter`.

- [ ] **Step 3: Implement src/lib/gallery-schema.ts**

```ts
import { z } from 'zod';

export const themeSchema = z.object({
  paper: z.string().optional(),
  ink: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  font: z.enum(['serif', 'sans', 'mono']).default('serif'),
  motion: z.enum(['none', 'calm', 'drift', 'reveal']).default('calm'),
  atmosphere: z.enum(['none', 'grain', 'vignette']).default('none'),
}).default({});

export const audioSchema = z.object({
  src: z.string(),
  title: z.string(),
  loop: z.boolean().default(true),
}).optional();

export const imageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
  span: z.enum(['single', 'wide']).default('single'),
});

export const gallerySchema = z.object({
  title: z.string().min(1),
  place: z.string().optional(),
  date: z.coerce.date(),
  summary: z.string().min(1),
  cover: z.string().min(1),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  theme: themeSchema,
  audio: audioSchema,
  images: z.array(imageSchema).default([]),
});

export type GalleryFields = z.infer<typeof gallerySchema>;
```

- [ ] **Step 4: Implement src/lib/frontmatter.ts**

```ts
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { gallerySchema, type GalleryFields } from './gallery-schema';

export { gallerySchema };
export type GalleryData = GalleryFields & { slug: string; body: string };

export function parseGallery(slug: string, markdown: string): GalleryData {
  const { data, content } = matter(markdown);
  const fields = gallerySchema.parse(data);
  return { ...fields, slug, body: content.trim() };
}

export function serializeGallery(data: GalleryData): string {
  const { slug, body, ...fields } = data;
  // Normalize date to YYYY-MM-DD so round-trips are stable.
  const front = {
    ...fields,
    date: fields.date instanceof Date
      ? fields.date.toISOString().slice(0, 10)
      : fields.date,
  };
  const frontYaml = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${frontYaml}\n---\n${body}\n`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/frontmatter.test.ts`
Expected: PASS (3 tests). If round-trip fails on `date`, confirm `parseGallery` re-coerces the `YYYY-MM-DD` string back to a `Date` (it does via `z.coerce.date()`), so `g2.date` equals `g1.date`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gallery-schema.ts src/lib/frontmatter.ts src/lib/frontmatter.test.ts
git commit -m "feat: add gallery schema and front-matter serializer"
```

---

## Task 4: GitHub content store

**Files:**
- Create: `src/lib/github.ts`
- Test: `src/lib/github.test.ts`

**Interfaces:**
- Consumes: `getEnv()`, `parseGallery`/`serializeGallery`, `GalleryData`.
- Produces (all async):
  - `listGalleries(): Promise<GalleryData[]>`
  - `getGallery(slug: string): Promise<GalleryData | null>`
  - `writeGallery(data: GalleryData, message: string): Promise<void>` — create or update `src/content/galleries/<slug>.md` (one commit).
  - `deleteGallery(slug: string, message: string): Promise<void>`
  - A factory `makeStore(octokit)` so tests inject a mock; the exported functions use a real Octokit built from env.

- [ ] **Step 1: Write the failing test**

Create `src/lib/github.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeStore } from './github';

beforeEach(() => {
  vi.stubEnv('GITHUB_REPO', 'me/site');
  vi.stubEnv('GITHUB_BRANCH', 'main');
  vi.stubEnv('GITHUB_TOKEN', 't');
  vi.stubEnv('ADMIN_PASSWORD', 'p'); vi.stubEnv('SESSION_SECRET', 's');
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'c'); vi.stubEnv('CLOUDINARY_API_KEY', 'k');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'x');
});

function mockOctokit(overrides = {}) {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
        deleteFile: vi.fn().mockResolvedValue({}),
      },
    },
    ...overrides,
  } as any;
}

const MD = `---\ntitle: T\ndate: 2026-01-01\nsummary: s\ncover: c\n---\nbody`;

describe('github store', () => {
  it('getGallery returns parsed data or null on 404', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({
      data: { content: Buffer.from(MD).toString('base64'), encoding: 'base64', sha: 'abc' },
    });
    const store = makeStore(ok);
    const g = await store.getGallery('x');
    expect(g?.title).toBe('T');

    ok.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    expect(await store.getGallery('missing')).toBeNull();
  });

  it('writeGallery creates/updates with sha when file exists', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'existing-sha' } });
    const store = makeStore(ok);
    await store.writeGallery(
      { slug: 'x', title: 'T', date: new Date('2026-01-01'), summary: 's',
        cover: 'c', draft: false, featured: false,
        theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
        images: [], body: 'body' } as any,
      'msg',
    );
    const call = ok.rest.repos.createOrUpdateFileContents.mock.calls[0][0];
    expect(call.path).toBe('src/content/galleries/x.md');
    expect(call.sha).toBe('existing-sha');
    expect(Buffer.from(call.content, 'base64').toString()).toContain('title: T');
  });

  it('deleteGallery passes the current sha', async () => {
    const ok = mockOctokit();
    ok.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'sha9' } });
    const store = makeStore(ok);
    await store.deleteGallery('x', 'msg');
    expect(ok.rest.repos.deleteFile.mock.calls[0][0].sha).toBe('sha9');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/github.test.ts`
Expected: FAIL — cannot find module `./github`.

- [ ] **Step 3: Implement src/lib/github.ts**

```ts
import { Octokit } from '@octokit/rest';
import { getEnv } from './env';
import { parseGallery, serializeGallery, type GalleryData } from './frontmatter';

const DIR = 'src/content/galleries';

function repoParts() {
  const [owner, repo] = getEnv().githubRepo.split('/');
  return { owner, repo, branch: getEnv().githubBranch };
}

export function makeStore(octokit: Octokit) {
  const path = (slug: string) => `${DIR}/${slug}.md`;

  async function getSha(p: string): Promise<string | null> {
    const { owner, repo, branch } = repoParts();
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path: p, ref: branch });
      const data = res.data as { sha?: string };
      return data.sha ?? null;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  return {
    async listGalleries(): Promise<GalleryData[]> {
      const { owner, repo, branch } = repoParts();
      let entries: any[] = [];
      try {
        const res = await octokit.rest.repos.getContent({ owner, repo, path: DIR, ref: branch });
        entries = Array.isArray(res.data) ? res.data : [];
      } catch (e: any) {
        if (e.status === 404) return [];
        throw e;
      }
      const mdFiles = entries.filter((f) => f.type === 'file' && f.name.endsWith('.md'));
      const out: GalleryData[] = [];
      for (const f of mdFiles) {
        const g = await this.getGallery(f.name.replace(/\.md$/, ''));
        if (g) out.push(g);
      }
      return out;
    },

    async getGallery(slug: string): Promise<GalleryData | null> {
      const { owner, repo, branch } = repoParts();
      try {
        const res = await octokit.rest.repos.getContent({ owner, repo, path: path(slug), ref: branch });
        const data = res.data as { content: string; encoding: string };
        const md = Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf8');
        return parseGallery(slug, md);
      } catch (e: any) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    async writeGallery(data: GalleryData, message: string): Promise<void> {
      const { owner, repo, branch } = repoParts();
      const sha = await getSha(path(data.slug));
      await octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path: path(data.slug), branch, message,
        content: Buffer.from(serializeGallery(data), 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      });
    },

    async deleteGallery(slug: string, message: string): Promise<void> {
      const { owner, repo, branch } = repoParts();
      const sha = await getSha(path(slug));
      if (!sha) return;
      await octokit.rest.repos.deleteFile({ owner, repo, path: path(slug), branch, message, sha });
    },
  };
}

function defaultStore() {
  return makeStore(new Octokit({ auth: getEnv().githubToken }));
}

export const listGalleries = () => defaultStore().listGalleries();
export const getGallery = (slug: string) => defaultStore().getGallery(slug);
export const writeGallery = (d: GalleryData, m: string) => defaultStore().writeGallery(d, m);
export const deleteGallery = (s: string, m: string) => defaultStore().deleteGallery(s, m);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/github.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/github.test.ts
git commit -m "feat: add github content store for galleries"
```

---

## Task 5: Cloudinary module

**Files:**
- Create: `src/lib/cloudinary.ts`
- Test: `src/lib/cloudinary.test.ts`

**Interfaces:**
- Consumes: `getEnv()`.
- Produces:
  - `signUpload(params: { folder: string; resourceType: 'image' | 'video' }): { timestamp, signature, apiKey, cloudName, folder, resourceType }` — server-computed signature for a direct browser upload.
  - `listAudio(): Promise<{ src: string; title: string }[]>` — audio files in the `mas/audio` folder.
  - `deliveryUrl(publicId: string, transform?: string): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cloudinary.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signUpload, deliveryUrl } from './cloudinary';

beforeEach(() => {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'demo');
  vi.stubEnv('CLOUDINARY_API_KEY', '123');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'shh');
  vi.stubEnv('ADMIN_PASSWORD', 'p'); vi.stubEnv('SESSION_SECRET', 's');
  vi.stubEnv('GITHUB_TOKEN', 't'); vi.stubEnv('GITHUB_REPO', 'a/b');
  vi.stubEnv('GITHUB_BRANCH', 'main');
});

describe('cloudinary', () => {
  it('signUpload returns a deterministic signature for fixed inputs', () => {
    const a = signUpload({ folder: 'mas/photos', resourceType: 'image' });
    expect(a.apiKey).toBe('123');
    expect(a.cloudName).toBe('demo');
    expect(a.folder).toBe('mas/photos');
    expect(typeof a.signature).toBe('string');
    expect(a.signature.length).toBeGreaterThan(10);
  });

  it('deliveryUrl builds a transform URL', () => {
    expect(deliveryUrl('mas/photos/x', 'w_1600,f_auto,q_auto'))
      .toBe('https://res.cloudinary.com/demo/image/upload/w_1600,f_auto,q_auto/mas/photos/x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/cloudinary.test.ts`
Expected: FAIL — cannot find module `./cloudinary`.

- [ ] **Step 3: Implement src/lib/cloudinary.ts**

```ts
import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'node:crypto';
import { getEnv } from './env';

function configure() {
  const env = getEnv();
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  return env;
}

export function signUpload(params: { folder: string; resourceType: 'image' | 'video' }) {
  const env = configure();
  // Fixed timestamp granularity keeps the test deterministic within a second; in
  // production Date.now() drives it. Sign the params Cloudinary requires.
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${params.folder}&timestamp=${timestamp}`;
  const signature = createHash('sha1')
    .update(toSign + env.cloudinaryApiSecret)
    .digest('hex');
  return {
    timestamp,
    signature,
    apiKey: env.cloudinaryApiKey,
    cloudName: env.cloudinaryCloudName,
    folder: params.folder,
    resourceType: params.resourceType,
  };
}

export async function listAudio(): Promise<{ src: string; title: string }[]> {
  configure();
  const res = await cloudinary.search
    .expression('folder:mas/audio')
    .max_results(100)
    .execute();
  return (res.resources ?? []).map((r: any) => ({
    src: r.secure_url as string,
    title: (r.public_id as string).split('/').pop() ?? r.public_id,
  }));
}

export function deliveryUrl(publicId: string, transform?: string): string {
  const env = configure();
  const t = transform ? `${transform}/` : '';
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/${t}${publicId}`;
}
```

Note on the deterministic test: the signature test asserts shape, not an exact hash, so `Date.now()` is fine. Only `deliveryUrl` is asserted exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/cloudinary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cloudinary.ts src/lib/cloudinary.test.ts
git commit -m "feat: add cloudinary signing and audio listing"
```

---

## Task 6: Auth API routes + login page + guard wiring

**Files:**
- Create: `src/pages/api/auth/login.ts`
- Create: `src/pages/api/auth/logout.ts`
- Create: `src/pages/admin/login.astro`
- Create: `src/middleware.ts`
- Test: `src/pages/api/auth/login.test.ts`

**Interfaces:**
- Consumes: `verifyPassword`, `createSessionCookie`, `clearSessionCookie`, `isValidSession`.
- Produces: a session cookie on login; middleware that protects `/admin/*` (redirect to login) and `/api/*` except `/api/auth/login` (401 JSON).

- [ ] **Step 1: Write the failing test for the login handler**

Create `src/pages/api/auth/login.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './login';

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', 'hunter2');
  vi.stubEnv('SESSION_SECRET', 'secret');
});

function req(body: any) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('sets a cookie on correct password', async () => {
    const res = await POST({ request: req({ password: 'hunter2' }) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('mas_session=');
  });

  it('rejects wrong password with 401 and no cookie', async () => {
    const res = await POST({ request: req({ password: 'nope' }) } as any);
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/api/auth/login.test.ts`
Expected: FAIL — cannot find module `./login`.

- [ ] **Step 3: Implement src/pages/api/auth/login.ts**

```ts
import type { APIRoute } from 'astro';
import { verifyPassword, createSessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!verifyPassword(String(password ?? ''))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': createSessionCookie() },
  });
};
```

- [ ] **Step 4: Implement src/pages/api/auth/logout.ts**

```ts
import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': clearSessionCookie() },
  });
```

- [ ] **Step 5: Implement src/middleware.ts (guard)**

```ts
import { defineMiddleware } from 'astro:middleware';
import { isValidSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const cookie = context.request.headers.get('cookie');
  const authed = isValidSession(cookie);

  const isLoginPage = pathname === '/admin/login';
  const isLoginApi = pathname === '/api/auth/login';

  if (pathname.startsWith('/api/') && !isLoginApi && !authed) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  }
  if (pathname.startsWith('/admin') && !isLoginPage && !authed) {
    return context.redirect('/admin/login');
  }
  return next();
});
```

- [ ] **Step 6: Implement src/pages/admin/login.astro**

```astro
---
export const prerender = false;
import BaseLayout from '../../layouts/BaseLayout.astro';
import { isValidSession } from '../../lib/auth';
if (isValidSession(Astro.request.headers.get('cookie'))) return Astro.redirect('/admin');
---
<BaseLayout title="Admin login">
  <main style="max-width:22rem;margin:4rem auto;">
    <h1>Studio</h1>
    <form id="login">
      <input type="password" name="password" placeholder="Password" autofocus required
             style="width:100%;padding:.6rem;margin:.5rem 0;" />
      <button type="submit" style="width:100%;padding:.6rem;">Enter</button>
      <p id="err" style="color:#c00;display:none;">Wrong password.</p>
    </form>
  </main>
  <script>
    const form = document.getElementById('login');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = form.password.value;
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) location.href = '/admin';
      else document.getElementById('err').style.display = 'block';
    });
  </script>
</BaseLayout>
```

If `BaseLayout` requires props beyond `title`, pass the minimal required ones; check `src/layouts/BaseLayout.astro` for its prop interface before writing this file.

- [ ] **Step 7: Run the handler test to verify it passes**

Run: `npm test -- src/pages/api/auth/login.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Manual smoke test**

Run: `npm run dev`, set a local `.env` with all vars. Visit `http://localhost:4321/admin` → redirected to `/admin/login`. Wrong password → error. Correct password → redirect to `/admin` (404 for now — dashboard comes in Task 8). Confirm the cookie is set in devtools.

- [ ] **Step 9: Commit**

```bash
git add src/pages/api/auth src/pages/admin/login.astro src/middleware.ts
git commit -m "feat: add auth routes, login page, and route guard"
```

---

## Task 7: Galleries + preview + upload API routes

**Files:**
- Create: `src/pages/api/galleries/index.ts`
- Create: `src/pages/api/galleries/[slug].ts`
- Create: `src/pages/api/upload/sign.ts`
- Create: `src/pages/api/preview.ts`
- Test: `src/pages/api/galleries/galleries.test.ts`

**Interfaces:**
- Consumes: `listGalleries`, `getGallery`, `writeGallery`, `deleteGallery`, `gallerySchema`, `signUpload`, `serializeGallery`.
- Produces:
  - `GET /api/galleries` → `GalleryData[]`.
  - `POST /api/galleries` (body = gallery data incl. `slug`) → validates with `gallerySchema`, writes via GitHub, returns `{ ok, slug }`.
  - `GET /api/galleries/:slug` → one gallery or 404.
  - `DELETE /api/galleries/:slug` → deletes via GitHub.
  - `POST /api/upload/sign` (body `{ folder, resourceType }`) → `signUpload(...)`.
  - `POST /api/preview` (body = gallery data) → HTML string rendering the gallery (used by the preview iframe).

- [ ] **Step 1: Write the failing test (POST validation + write)**

Create `src/pages/api/galleries/galleries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/github', () => ({
  listGalleries: vi.fn().mockResolvedValue([]),
  writeGallery: vi.fn().mockResolvedValue(undefined),
  getGallery: vi.fn(),
  deleteGallery: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from './index';
import { writeGallery } from '../../../lib/github';

const VALID = {
  slug: 'alps', title: 'Alps', date: '2026-06-01', summary: 's', cover: 'c',
  draft: false, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  images: [{ src: 'x', alt: 'a', span: 'single' }], body: '',
};

function req(body: any) {
  return new Request('http://localhost/api/galleries', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('galleries API', () => {
  it('GET returns the list', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST writes a valid gallery', async () => {
    const res = await POST({ request: req(VALID) } as any);
    expect(res.status).toBe(200);
    expect(writeGallery).toHaveBeenCalledOnce();
  });

  it('POST rejects invalid gallery (missing title) with 400', async () => {
    const res = await POST({ request: req({ ...VALID, title: '' }) } as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/api/galleries/galleries.test.ts`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement src/pages/api/galleries/index.ts**

```ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { gallerySchema } from '../../../lib/frontmatter';
import { listGalleries, writeGallery } from '../../../lib/github';

export const prerender = false;

const postSchema = gallerySchema.extend({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  body: z.string().default(''),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async () => json(await listGalleries());

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const data = parsed.data as any;
  await writeGallery(data, `studio: save gallery "${data.slug}"`);
  return json({ ok: true, slug: data.slug });
};
```

- [ ] **Step 4: Implement src/pages/api/galleries/[slug].ts**

```ts
import type { APIRoute } from 'astro';
import { getGallery, deleteGallery } from '../../../lib/github';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async ({ params }) => {
  const g = await getGallery(params.slug!);
  return g ? json(g) : json({ error: 'not found' }, 404);
};

export const DELETE: APIRoute = async ({ params }) => {
  await deleteGallery(params.slug!, `studio: delete gallery "${params.slug}"`);
  return json({ ok: true });
};
```

- [ ] **Step 5: Implement src/pages/api/upload/sign.ts**

```ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { signUpload } from '../../../lib/cloudinary';

export const prerender = false;

const schema = z.object({
  folder: z.enum(['mas/photos', 'mas/audio']),
  resourceType: z.enum(['image', 'video']),
});

export const POST: APIRoute = async ({ request }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'bad params' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(signUpload(parsed.data)), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
};
```

- [ ] **Step 6: Implement src/pages/api/preview.ts**

This renders the real gallery layout from draft data. It uses Astro's Container API to render `GalleryLayout` server-side.

```ts
import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import GalleryLayout from '../../layouts/GalleryLayout.astro';
import { gallerySchema } from '../../lib/frontmatter';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.json().catch(() => null);
  const parsed = gallerySchema.safeParse(raw);
  if (!parsed.success) return new Response('invalid', { status: 400 });

  const container = await AstroContainer.create();
  // GalleryLayout expects the gallery's front-matter as props + the rendered body
  // as a slot. Pass draft fields as props; body is supplied as the default slot.
  const html = await container.renderToString(GalleryLayout, {
    props: { gallery: parsed.data },
    slots: { default: (raw.body as string) ?? '' },
  });
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
};
```

Before writing this, open `src/layouts/GalleryLayout.astro` and `src/pages/photography/[...slug].astro` to confirm the exact prop name the layout expects (e.g. `gallery`, `entry`, or spread front-matter). Match it here. If the layout reads `Astro.props.entry.data`, wrap as `{ entry: { data: parsed.data } }`.

- [ ] **Step 7: Run the galleries test to verify it passes**

Run: `npm test -- src/pages/api/galleries/galleries.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/pages/api/galleries src/pages/api/upload src/pages/api/preview.ts
git commit -m "feat: add galleries, upload-sign, and preview API routes"
```

---

## Task 8: Admin shell — types, api-client, dashboard page

**Files:**
- Create: `src/components/admin/types.ts`
- Create: `src/components/admin/api-client.ts`
- Create: `src/components/admin/Dashboard.tsx`
- Create: `src/components/admin/AdminApp.tsx`
- Create: `src/pages/admin/index.astro`
- Test: `src/components/admin/api-client.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: TS mirror of `GalleryData` for the browser (`Gallery`, `Theme`, `GalleryImage`, `Audio`).
  - `api-client.ts`: `fetchGalleries()`, `fetchGallery(slug)`, `saveGallery(g)`, `deleteGallery(slug)`, `signUpload(folder, resourceType)`, `renderPreview(g)`.
  - `Dashboard.tsx`: lists galleries, links to `/admin/new` and `/admin/<slug>/edit`, delete button.
  - `AdminApp.tsx`: thin wrapper choosing Dashboard vs Builder by a `view` prop.

- [ ] **Step 1: Write the failing test for api-client**

Create `src/components/admin/api-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGalleries, saveGallery } from './api-client';

beforeEach(() => { vi.restoreAllMocks(); });

describe('api-client', () => {
  it('fetchGalleries GETs /api/galleries', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ slug: 'a' }]), { status: 200 }));
    const out = await fetchGalleries();
    expect(spy).toHaveBeenCalledWith('/api/galleries', expect.objectContaining({ method: 'GET' }));
    expect(out[0].slug).toBe('a');
  });

  it('saveGallery POSTs the gallery and throws on non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 400 }));
    await expect(saveGallery({ slug: 'x' } as any)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/admin/api-client.test.ts`
Expected: FAIL — cannot find module `./api-client`.

- [ ] **Step 3: Implement src/components/admin/types.ts**

```ts
export type Font = 'serif' | 'sans' | 'mono';
export type Motion = 'none' | 'calm' | 'drift' | 'reveal';
export type Atmosphere = 'none' | 'grain' | 'vignette';
export type Span = 'single' | 'wide';

export interface Theme {
  paper?: string; ink?: string; muted?: string; accent?: string;
  font: Font; motion: Motion; atmosphere: Atmosphere;
}
export interface GalleryImage { src: string; alt: string; caption?: string; span: Span; }
export interface Audio { src: string; title: string; loop: boolean; }

export interface Gallery {
  slug: string;
  title: string;
  place?: string;
  date: string;          // YYYY-MM-DD
  summary: string;
  cover: string;
  draft: boolean;
  featured: boolean;
  theme: Theme;
  audio?: Audio;
  images: GalleryImage[];
  body: string;
}

export const emptyGallery = (): Gallery => ({
  slug: '', title: '', date: new Date().toISOString().slice(0, 10),
  summary: '', cover: '', draft: true, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  images: [], body: '',
});
```

- [ ] **Step 4: Implement src/components/admin/api-client.ts**

```ts
import type { Gallery } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchGalleries = () =>
  fetch('/api/galleries', { method: 'GET' }).then((r) => json<Gallery[]>(r));

export const fetchGallery = (slug: string) =>
  fetch(`/api/galleries/${slug}`, { method: 'GET' }).then((r) => json<Gallery>(r));

export const saveGallery = (g: Gallery) =>
  fetch('/api/galleries', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(g),
  }).then((r) => json<{ ok: boolean; slug: string }>(r));

export const deleteGallery = (slug: string) =>
  fetch(`/api/galleries/${slug}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r));

export const signUpload = (folder: 'mas/photos' | 'mas/audio', resourceType: 'image' | 'video') =>
  fetch('/api/upload/sign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ folder, resourceType }),
  }).then((r) => json<{ timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string; resourceType: string }>(r));

export const renderPreview = (g: Gallery) =>
  fetch('/api/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(g),
  }).then((r) => r.text());
```

- [ ] **Step 5: Run api-client test to verify it passes**

Run: `npm test -- src/components/admin/api-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Implement src/components/admin/Dashboard.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { fetchGalleries, deleteGallery } from './api-client';

export default function Dashboard() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGalleries().then(setGalleries).finally(() => setLoading(false)); }, []);

  async function onDelete(slug: string) {
    if (!confirm(`Delete gallery "${slug}"? This commits a deletion.`)) return;
    await deleteGallery(slug);
    setGalleries((gs) => gs.filter((g) => g.slug !== slug));
  }

  if (loading) return <p>Loading…</p>;
  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Galleries</h1>
        <a href="/admin/new"><button>+ New gallery</button></a>
      </header>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {galleries.map((g) => (
          <li key={g.slug} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '.5rem 0', borderBottom: '1px solid #eee' }}>
            <span style={{ flex: 1 }}>{g.title || g.slug}</span>
            {g.draft && <em>draft</em>}
            {g.featured && <strong>★</strong>}
            <a href={`/admin/${g.slug}/edit`}>Edit</a>
            <button onClick={() => onDelete(g.slug)}>Delete</button>
          </li>
        ))}
        {galleries.length === 0 && <li>No galleries yet. Create your first one.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Implement src/components/admin/AdminApp.tsx**

```tsx
import Dashboard from './Dashboard';
import Builder from './Builder';
import type { Gallery } from './types';

interface Props { view: 'dashboard' | 'builder'; initial?: Gallery; }

export default function AdminApp({ view, initial }: Props) {
  if (view === 'builder') return <Builder initial={initial} />;
  return <Dashboard />;
}
```

Note: `Builder` is created in Task 9. To keep this task independently testable/buildable, create a minimal placeholder `Builder.tsx` now that renders `<p>Builder…</p>` and accepts `{ initial?: Gallery }`; Task 9 replaces it.

- [ ] **Step 8: Create placeholder src/components/admin/Builder.tsx**

```tsx
import type { Gallery } from './types';
export default function Builder({ initial }: { initial?: Gallery }) {
  return <p>Builder placeholder for {initial?.slug ?? 'new gallery'}.</p>;
}
```

- [ ] **Step 9: Implement src/pages/admin/index.astro**

```astro
---
export const prerender = false;
import BaseLayout from '../../layouts/BaseLayout.astro';
import AdminApp from '../../components/admin/AdminApp';
---
<BaseLayout title="Studio — Galleries">
  <main style="max-width:60rem;margin:2rem auto;">
    <AdminApp view="dashboard" client:only="react" />
  </main>
</BaseLayout>
```

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`, log in, visit `/admin`. Confirm the dashboard loads (empty list if the GitHub repo has no galleries, or lists existing `kyoto-rain`/`salt-and-light` if the repo is connected). "+ New gallery" links to `/admin/new` (404 until Task 9).

- [ ] **Step 11: Commit**

```bash
git add src/components/admin src/pages/admin/index.astro
git commit -m "feat: add admin dashboard shell and api client"
```

---

## Task 9: Builder — meta + theme controls + save, with new/edit pages

**Files:**
- Modify: `src/components/admin/Builder.tsx` (replace placeholder)
- Create: `src/components/admin/MetaFields.tsx`
- Create: `src/components/admin/ThemeControls.tsx`
- Create: `src/pages/admin/new.astro`
- Create: `src/pages/admin/[slug]/edit.astro`
- Test: `src/components/admin/slugify.test.ts`
- Create: `src/components/admin/slugify.ts`

**Interfaces:**
- Consumes: `Gallery`, `emptyGallery`, `saveGallery`, `react-colorful`.
- Produces:
  - `slugify(title: string): string`.
  - `Builder` two-column shell with form (Meta + Theme) on the left and a `LivePreview` mount point on the right (preview wired in Task 11).
  - `MetaFields` and `ThemeControls` controlled components: `(value, onChange)`.

- [ ] **Step 1: Write the failing test for slugify**

Create `src/components/admin/slugify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('A Morning in the Alps')).toBe('a-morning-in-the-alps');
  });
  it('strips accents and punctuation', () => {
    expect(slugify('Café & Lumière!')).toBe('cafe-lumiere');
  });
  it('collapses repeated separators', () => {
    expect(slugify('  hello   world  ')).toBe('hello-world');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/admin/slugify.test.ts`
Expected: FAIL — cannot find module `./slugify`.

- [ ] **Step 3: Implement src/components/admin/slugify.ts**

```ts
export function slugify(title: string): string {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run slugify test to verify it passes**

Run: `npm test -- src/components/admin/slugify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement src/components/admin/MetaFields.tsx**

```tsx
import type { Gallery } from './types';
import { slugify } from './slugify';

interface Props { value: Gallery; onChange: (g: Gallery) => void; lockSlug: boolean; }

export default function MetaFields({ value, onChange, lockSlug }: Props) {
  const set = (patch: Partial<Gallery>) => onChange({ ...value, ...patch });
  return (
    <fieldset>
      <legend>Details</legend>
      <label>Title<input value={value.title}
        onChange={(e) => set({ title: e.target.value, ...(lockSlug ? {} : { slug: slugify(e.target.value) }) })} /></label>
      <label>Slug<input value={value.slug} disabled={lockSlug}
        onChange={(e) => set({ slug: slugify(e.target.value) })} /></label>
      <label>Place<input value={value.place ?? ''} onChange={(e) => set({ place: e.target.value })} /></label>
      <label>Date<input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} /></label>
      <label>Summary<textarea value={value.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
      <label><input type="checkbox" checked={value.draft} onChange={(e) => set({ draft: e.target.checked })} /> Draft</label>
      <label><input type="checkbox" checked={value.featured} onChange={(e) => set({ featured: e.target.checked })} /> Featured</label>
    </fieldset>
  );
}
```

- [ ] **Step 6: Implement src/components/admin/ThemeControls.tsx**

```tsx
import { HexColorPicker } from 'react-colorful';
import type { Gallery, Theme } from './types';

interface Props { value: Gallery; onChange: (g: Gallery) => void; }

const COLORS: (keyof Theme)[] = ['paper', 'ink', 'muted', 'accent'];

export default function ThemeControls({ value, onChange }: Props) {
  const setTheme = (patch: Partial<Theme>) => onChange({ ...value, theme: { ...value.theme, ...patch } });
  return (
    <fieldset>
      <legend>The world</legend>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {COLORS.map((key) => (
          <div key={key}>
            <span>{key}</span>
            <HexColorPicker color={value.theme[key] as string || '#000000'}
              onChange={(c) => setTheme({ [key]: c } as Partial<Theme>)} />
          </div>
        ))}
      </div>
      <label>Font
        <select value={value.theme.font} onChange={(e) => setTheme({ font: e.target.value as Theme['font'] })}>
          <option>serif</option><option>sans</option><option>mono</option>
        </select>
      </label>
      <label>Motion
        <select value={value.theme.motion} onChange={(e) => setTheme({ motion: e.target.value as Theme['motion'] })}>
          <option>none</option><option>calm</option><option>drift</option><option>reveal</option>
        </select>
      </label>
      <label>Atmosphere
        <select value={value.theme.atmosphere} onChange={(e) => setTheme({ atmosphere: e.target.value as Theme['atmosphere'] })}>
          <option>none</option><option>grain</option><option>vignette</option>
        </select>
      </label>
    </fieldset>
  );
}
```

- [ ] **Step 7: Replace src/components/admin/Builder.tsx**

```tsx
import { useState } from 'react';
import type { Gallery } from './types';
import { emptyGallery } from './types';
import { saveGallery } from './api-client';
import MetaFields from './MetaFields';
import ThemeControls from './ThemeControls';
import LivePreview from './LivePreview';

export default function Builder({ initial }: { initial?: Gallery }) {
  const [gallery, setGallery] = useState<Gallery>(initial ?? emptyGallery());
  const [status, setStatus] = useState<string>('');
  const isEdit = Boolean(initial);

  async function onSave() {
    if (!gallery.title || !gallery.slug || !gallery.cover) {
      setStatus('Title, slug and a cover are required.'); return;
    }
    setStatus('Saving…');
    try {
      await saveGallery(gallery);
      setStatus('Published — live in ~1–2 min (rebuild running).');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div>
        <MetaFields value={gallery} onChange={setGallery} lockSlug={isEdit} />
        <ThemeControls value={gallery} onChange={setGallery} />
        {/* PhotoUploader + MusicPicker mount here in Task 10 */}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={onSave}>{isEdit ? 'Save changes' : 'Publish'}</button>
          <p>{status}</p>
        </div>
      </div>
      <LivePreview gallery={gallery} />
    </div>
  );
}
```

- [ ] **Step 8: Create minimal src/components/admin/LivePreview.tsx placeholder**

```tsx
import type { Gallery } from './types';
export default function LivePreview({ gallery }: { gallery: Gallery }) {
  return <aside><p>Preview of {gallery.title || 'untitled'} (wired in Task 11).</p></aside>;
}
```

- [ ] **Step 9: Implement src/pages/admin/new.astro**

```astro
---
export const prerender = false;
import BaseLayout from '../../layouts/BaseLayout.astro';
import AdminApp from '../../components/admin/AdminApp';
---
<BaseLayout title="Studio — New gallery">
  <main style="max-width:80rem;margin:2rem auto;">
    <AdminApp view="builder" client:only="react" />
  </main>
</BaseLayout>
```

- [ ] **Step 10: Implement src/pages/admin/[slug]/edit.astro**

```astro
---
export const prerender = false;
import BaseLayout from '../../../layouts/BaseLayout.astro';
import AdminApp from '../../../components/admin/AdminApp';
import { getGallery } from '../../../lib/github';
const gallery = await getGallery(Astro.params.slug!);
if (!gallery) return Astro.redirect('/admin');
// Serialize Date -> string for the client component.
const initial = { ...gallery, date: new Date(gallery.date).toISOString().slice(0, 10) };
---
<BaseLayout title={`Studio — Edit ${gallery.slug}`}>
  <main style="max-width:80rem;margin:2rem auto;">
    <AdminApp view="builder" initial={initial} client:only="react" />
  </main>
</BaseLayout>
```

- [ ] **Step 11: Manual smoke test**

Run: `npm run dev`. Visit `/admin/new` → form renders with color pickers. Type a title → slug auto-fills. Visit `/admin/<existing-slug>/edit` → form pre-populated. (Saving requires a real GitHub repo + token; if not yet set up, expect the save call to error — that's fine for this task.)

- [ ] **Step 12: Commit**

```bash
git add src/components/admin/Builder.tsx src/components/admin/MetaFields.tsx src/components/admin/ThemeControls.tsx src/components/admin/slugify.ts src/components/admin/slugify.test.ts src/components/admin/LivePreview.tsx src/pages/admin/new.astro "src/pages/admin/[slug]/edit.astro"
git commit -m "feat: add gallery builder with meta + theme controls"
```

---

## Task 10: Media — PhotoUploader (drag-drop + reorder) and MusicPicker

**Files:**
- Create: `src/components/admin/cloudinary-upload.ts`
- Create: `src/components/admin/PhotoUploader.tsx`
- Create: `src/components/admin/MusicPicker.tsx`
- Modify: `src/components/admin/Builder.tsx` (mount the two components)
- Create: `src/pages/api/audio/index.ts` (list audio for MusicPicker)
- Test: `src/components/admin/cloudinary-upload.test.ts`

**Interfaces:**
- Consumes: `signUpload` (api-client), `@dnd-kit/*`, `GalleryImage`.
- Produces:
  - `uploadToCloudinary(file, folder, resourceType): Promise<{ url: string; publicId: string }>` — gets a signature, POSTs the file to Cloudinary's upload endpoint, returns the secure URL.
  - `PhotoUploader`: drag-drop zone → uploads → appends to `gallery.images`; sortable list with per-image alt/caption/span and "set as cover"; reorder persists order.
  - `MusicPicker`: dropdown of existing audio (`GET /api/audio`) + upload-new; sets `gallery.audio`.
  - `GET /api/audio` → `{ src, title }[]` from `listAudio()`.

- [ ] **Step 1: Write the failing test for uploadToCloudinary**

Create `src/components/admin/cloudinary-upload.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadToCloudinary } from './cloudinary-upload';

beforeEach(() => vi.restoreAllMocks());

describe('uploadToCloudinary', () => {
  it('signs then uploads and returns url + publicId', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        timestamp: 1, signature: 'sig', apiKey: 'ak', cloudName: 'demo',
        folder: 'mas/photos', resourceType: 'image',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/mas/photos/x.jpg',
        public_id: 'mas/photos/x',
      }), { status: 200 }));

    const file = new File(['data'], 'x.jpg', { type: 'image/jpeg' });
    const out = await uploadToCloudinary(file, 'mas/photos', 'image');

    expect(out.publicId).toBe('mas/photos/x');
    expect(out.url).toContain('res.cloudinary.com');
    // Second call hits Cloudinary's upload endpoint.
    expect(fetchSpy.mock.calls[1][0]).toContain('api.cloudinary.com/v1_1/demo/image/upload');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/admin/cloudinary-upload.test.ts`
Expected: FAIL — cannot find module `./cloudinary-upload`.

- [ ] **Step 3: Implement src/components/admin/cloudinary-upload.ts**

```ts
import { signUpload } from './api-client';

export async function uploadToCloudinary(
  file: File, folder: 'mas/photos' | 'mas/audio', resourceType: 'image' | 'video',
): Promise<{ url: string; publicId: string }> {
  const sig = await signUpload(folder, resourceType);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${res.status}`);
  const data = await res.json();
  return { url: data.secure_url as string, publicId: data.public_id as string };
}
```

- [ ] **Step 4: Run cloudinary-upload test to verify it passes**

Run: `npm test -- src/components/admin/cloudinary-upload.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implement src/pages/api/audio/index.ts**

```ts
import type { APIRoute } from 'astro';
import { listAudio } from '../../../lib/cloudinary';

export const prerender = false;

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await listAudio()), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
```

- [ ] **Step 6: Implement src/components/admin/PhotoUploader.tsx**

```tsx
import { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Gallery, GalleryImage } from './types';
import { uploadToCloudinary } from './cloudinary-upload';

function Row({ img, index, onPatch, onCover, isCover }: {
  img: GalleryImage; index: number; isCover: boolean;
  onPatch: (i: number, p: Partial<GalleryImage>) => void; onCover: (src: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.src });
  const style = { transform: CSS.Transform.toString(transform), transition, display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.4rem 0' };
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab' }}>⠿</span>
      <img src={img.src} alt="" width={64} height={64} style={{ objectFit: 'cover' }} />
      <input placeholder="alt text" value={img.alt} onChange={(e) => onPatch(index, { alt: e.target.value })} />
      <input placeholder="caption" value={img.caption ?? ''} onChange={(e) => onPatch(index, { caption: e.target.value })} />
      <select value={img.span} onChange={(e) => onPatch(index, { span: e.target.value as GalleryImage['span'] })}>
        <option value="single">single</option><option value="wide">wide</option>
      </select>
      <label><input type="radio" name="cover" checked={isCover} onChange={() => onCover(img.src)} /> cover</label>
    </div>
  );
}

export default function PhotoUploader({ value, onChange }: { value: Gallery; onChange: (g: Gallery) => void; }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true); setError('');
    for (const file of Array.from(files)) {
      try {
        const { url } = await uploadToCloudinary(file, 'mas/photos', 'image');
        const img: GalleryImage = { src: url, alt: '', span: 'single' };
        onChange({ ...value, images: [...value.images, img], cover: value.cover || url });
      } catch (e) { setError(`${file.name}: ${(e as Error).message}`); }
    }
    setBusy(false);
  }

  const patch = (i: number, p: Partial<GalleryImage>) =>
    onChange({ ...value, images: value.images.map((im, idx) => (idx === i ? { ...im, ...p } : im)) });

  function onDragEnd(e: any) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = value.images.findIndex((im) => im.src === active.id);
    const newIndex = value.images.findIndex((im) => im.src === over.id);
    onChange({ ...value, images: arrayMove(value.images, oldIndex, newIndex) });
  }

  return (
    <fieldset>
      <legend>Photos</legend>
      <input type="file" accept="image/*" multiple disabled={busy}
        onChange={(e) => onFiles(e.target.files)} />
      {busy && <span> uploading…</span>}
      {error && <p style={{ color: '#c00' }}>{error}</p>}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.images.map((im) => im.src)} strategy={verticalListSortingStrategy}>
          {value.images.map((img, i) => (
            <Row key={img.src} img={img} index={i} isCover={value.cover === img.src}
              onPatch={patch} onCover={(src) => onChange({ ...value, cover: src })} />
          ))}
        </SortableContext>
      </DndContext>
    </fieldset>
  );
}
```

- [ ] **Step 7: Implement src/components/admin/MusicPicker.tsx**

```tsx
import { useEffect, useState } from 'react';
import type { Gallery } from './types';
import { uploadToCloudinary } from './cloudinary-upload';

export default function MusicPicker({ value, onChange }: { value: Gallery; onChange: (g: Gallery) => void; }) {
  const [library, setLibrary] = useState<{ src: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch('/api/audio').then((r) => r.json()).then(setLibrary).catch(() => {}); }, []);

  function pick(src: string) {
    if (!src) return onChange({ ...value, audio: undefined });
    const found = library.find((a) => a.src === src);
    onChange({ ...value, audio: { src, title: value.audio?.title || found?.title || '', loop: true } });
  }

  async function onUpload(file: File) {
    setBusy(true);
    try {
      const { url } = await uploadToCloudinary(file, 'mas/audio', 'video'); // audio uses 'video' resource type
      const entry = { src: url, title: file.name.replace(/\.[^.]+$/, '') };
      setLibrary((l) => [...l, entry]);
      onChange({ ...value, audio: { src: url, title: entry.title, loop: true } });
    } finally { setBusy(false); }
  }

  return (
    <fieldset>
      <legend>Ambient music</legend>
      <select value={value.audio?.src ?? ''} onChange={(e) => pick(e.target.value)}>
        <option value="">— none —</option>
        {library.map((a) => <option key={a.src} value={a.src}>{a.title}</option>)}
      </select>
      <input type="file" accept="audio/*" disabled={busy}
        onChange={(e) => e.target.files && onUpload(e.target.files[0])} />
      {value.audio && (
        <label>Track title
          <input value={value.audio.title}
            onChange={(e) => onChange({ ...value, audio: { ...value.audio!, title: e.target.value } })} />
        </label>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 8: Mount both in Builder.tsx**

In `src/components/admin/Builder.tsx`, add imports and place the components where the Task 9 comment indicated:

```tsx
import PhotoUploader from './PhotoUploader';
import MusicPicker from './MusicPicker';
```

Replace the `{/* PhotoUploader + MusicPicker mount here in Task 10 */}` comment with:

```tsx
<PhotoUploader value={gallery} onChange={setGallery} />
<MusicPicker value={gallery} onChange={setGallery} />
```

- [ ] **Step 9: Manual smoke test**

Run: `npm run dev` (requires Cloudinary env vars). On `/admin/new`: drop a photo → it uploads and appears; set alt/caption/span; drag to reorder; mark a cover. Music dropdown lists existing tracks; uploading a new mp3 selects it.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/cloudinary-upload.ts src/components/admin/cloudinary-upload.test.ts src/components/admin/PhotoUploader.tsx src/components/admin/MusicPicker.tsx src/components/admin/Builder.tsx src/pages/api/audio/index.ts
git commit -m "feat: add photo uploader (drag-drop + reorder) and music picker"
```

---

## Task 11: Live preview pane

**Files:**
- Modify: `src/components/admin/LivePreview.tsx` (replace placeholder)
- Verify/adjust: `src/pages/api/preview.ts` (prop shape from Task 7)

**Interfaces:**
- Consumes: `renderPreview` (api-client), `Gallery`.
- Produces: `LivePreview` renders the gallery HTML returned by `/api/preview` inside a sandboxed iframe, debounced on `gallery` changes.

- [ ] **Step 1: Replace src/components/admin/LivePreview.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Gallery } from './types';
import { renderPreview } from './api-client';

export default function LivePreview({ gallery }: { gallery: Gallery }) {
  const [html, setHtml] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      renderPreview(gallery).then(setHtml).catch(() => {});
    }, 400);
    return () => clearTimeout(timer.current);
  }, [gallery]);

  return (
    <aside style={{ position: 'sticky', top: '1rem', height: '85vh' }}>
      <iframe title="Live preview" srcDoc={html}
        sandbox="allow-same-origin"
        style={{ width: '100%', height: '100%', border: '1px solid #ddd', borderRadius: 8 }} />
    </aside>
  );
}
```

- [ ] **Step 2: Confirm /api/preview returns a full HTML document**

Open `src/pages/api/preview.ts`. The iframe `srcDoc` needs a complete document (so the gallery's CSS variables apply). If `GalleryLayout` renders only a fragment, wrap the container output, or render the page component that includes `<html>`/global.css instead of the bare layout. Verify against `src/pages/photography/[...slug].astro` to mirror exactly how a real gallery page is assembled (same layout + same global stylesheet link).

Adjust `preview.ts` if needed so the returned HTML is a standalone document including the global stylesheet, e.g.:

```ts
// If GalleryLayout already includes BaseLayout/<html>, renderToString is enough.
// Otherwise prepend the document shell + <link rel="stylesheet" href="/styles/global.css">.
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, open `/admin/new`. As you change colors/font/motion and add photos, the right pane re-renders the real gallery look within ~0.4s. Confirm `paper`/`ink`/`accent` colors, font, atmosphere, and wide spans all reflect in the preview.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/LivePreview.tsx src/pages/api/preview.ts
git commit -m "feat: add live preview pane rendering the real gallery layout"
```

---

## Task 12: Full-flow verification + docs

**Files:**
- Modify: `README.md` (document the admin)
- Create: `docs/admin-setup.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites pass (env, auth, frontmatter, github, cloudinary, login, galleries, api-client, slugify, cloudinary-upload).

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build succeeds. Public pages prerender; `/admin/*` and `/api/*` are server functions.

- [ ] **Step 3: Document setup in docs/admin-setup.md**

Write the one-time setup: create GitHub repo + push; connect Vercel; create Cloudinary account; set all env vars (list from Global Constraints) locally and in Vercel; how to reach `/admin`; the publish→rebuild flow and ~1–2 min latency.

- [ ] **Step 4: Add a short "Admin" section to README.md**

Two or three sentences pointing at `docs/admin-setup.md` and noting `/admin` is the private builder.

- [ ] **Step 5: End-to-end manual checklist (against a real connected repo + Cloudinary)**

  - Log in at `/admin`; wrong password rejected.
  - Create a gallery: title, colors, font/motion/atmosphere, upload 3 photos, reorder, set cover, pick/upload music, live preview matches.
  - Publish → confirm a commit appears in GitHub → Vercel rebuild → gallery live on the site.
  - Edit it (change accent + caption) → save → rebuild → change visible.
  - Toggle draft → confirm hidden from production build.
  - Delete → confirm file removed via commit and gallery gone after rebuild.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/admin-setup.md
git commit -m "docs: document gallery builder admin setup and usage"
```

---

## Self-Review Notes (addressed)

- **Spec §4 components** → Tasks 2–11 (auth, github, cloudinary, frontmatter, admin UI, preview). ✅
- **Spec §4.3 live preview via real layout** → Tasks 7 (preview API) + 11 (pane), with explicit prop-shape verification step. ✅
- **Spec §5 publish flow** → Task 7 (write API) + Task 9 (save button) + Task 10 (upload). ✅
- **Spec §6 auth** → Task 2 + Task 6 (routes, login page, middleware guard). ✅
- **Spec §7 error handling** → per-file upload errors (Task 10), save failure toast (Task 9), 401 guard (Task 6), validation 400 (Task 7), rebuild-latency message (Task 9). ✅
- **Spec §8 testing** → unit (frontmatter round-trip, auth, cloudinary sig), integration (galleries API mocked), manual e2e checklist (Task 12). ✅
- **Spec §9 setup prerequisites** → Task 1 (.env.example, adapter) + Task 12 (docs/admin-setup.md). ✅
- **Type consistency:** `GalleryData` (server, `date: Date`) vs `Gallery` (client, `date: string`) — edit page converts Date→string before passing to React (Task 9 Step 10); POST body re-coerced by `z.coerce.date()` server-side (Task 3/7). ✅
- **Music resource type:** audio uploaded with Cloudinary `video` resource type (Task 10) — matches `signUpload` enum and the `/audio` upload folder. ✅
