# Phase 1: Publish Pipeline (Lightroom picks → R2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Docker worker on the UGREEN NAS that, every 15 minutes, finds Lightroom-cloud photos flagged as *picks*, exports them full-size with edits applied via Adobe's API, generates display + thumbnail derivatives, uploads them to the Cloudflare R2 bucket `photo-gallery`, and maintains a `manifest.json` the site's admin will consume in Phase 2.

**Architecture:** A small TypeScript Node app in `worker/` (new directory in this repo), tested with vitest against mocked HTTP, built into a Docker image deployed to the NAS over SSH. Adobe access uses OAuth refresh tokens persisted atomically to a volume; R2 access uses bucket-scoped S3 credentials via `@aws-sdk/client-s3`. Each pass is idempotent: per-asset state is saved as it goes, and `manifest.json` is written last.

**Tech Stack:** Node 22, TypeScript, vitest, sharp (libvips), @aws-sdk/client-s3, Docker. CLI helpers: wrangler (already authenticated on the Mac), ssh (`ssh nas` works).

**Spec:** `docs/superpowers/specs/2026-08-25-lightroom-nas-r2-photo-pipeline-design.md`

## Global Constraints

- Derivatives: display = JPEG, 3500 px long edge, quality 85; thumbnail = JPEG, 800 px long edge, quality 80. Never upscale. JPEG only.
- Object keys are content-hashed: `photos/<hash>-display.jpg`, `photos/<hash>-thumb.jpg` where `<hash>` = first 16 hex chars of SHA-256 of the exported fullsize bytes.
- Derivative objects get `Cache-Control: public, max-age=31536000, immutable`. `manifest.json` and `status.json` get `Cache-Control: no-cache`.
- `manifest.json` is uploaded only after all object uploads of a pass succeed ("admin never sees half-synced state").
- Token JSON writes are atomic (write `<path>.tmp`, then rename). Losing a rotated refresh token bricks the worker for the user.
- Adobe API responses are prefixed with a `while (1) {}` guard line that must be stripped before `JSON.parse`.
- All Adobe requests need headers `Authorization: Bearer <access_token>` and `X-API-Key: <client_id>`.
- Secrets never enter git: `worker/.env`, `worker/secrets/` are gitignored (Task 1 adds the entries).
- Worker code lives in `worker/` with its own `package.json`; run all worker commands from `worker/`.

---

### Task 1: Worker scaffold + config module

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/.gitignore`, `worker/src/config.ts`
- Test: `worker/test/config.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `loadConfig(env?: Record<string, string | undefined>): Config` and the `Config` type below — every later task takes `Config` as input.

- [ ] **Step 1: Scaffold the package**

Create `worker/package.json`:

```json
{
  "name": "photo-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  }
}
```

Create `worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `worker/.gitignore`:

```
node_modules/
dist/
.env
secrets/
```

Run: `cd worker && npm install`

- [ ] **Step 2: Write the failing config test**

`worker/test/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

const FULL_ENV = {
  ADOBE_CLIENT_ID: "cid",
  ADOBE_CLIENT_SECRET: "csecret",
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "ak",
  R2_SECRET_ACCESS_KEY: "sk",
  R2_BUCKET: "photo-gallery",
  PHOTOS_BASE_URL: "https://pub-x.r2.dev",
  DATA_DIR: "/data",
};

describe("loadConfig", () => {
  it("parses a complete environment", () => {
    const cfg = loadConfig(FULL_ENV);
    expect(cfg.adobe.clientId).toBe("cid");
    expect(cfg.r2.bucket).toBe("photo-gallery");
    expect(cfg.tokenPath).toBe("/data/tokens.json");
    expect(cfg.statePath).toBe("/data/state.json");
    expect(cfg.archiveDir).toBe("/data/published");
    expect(cfg.intervalMinutes).toBe(15);
    expect(cfg.runOnce).toBe(false);
  });

  it("honors RUN_ONCE and RUN_INTERVAL_MINUTES", () => {
    const cfg = loadConfig({ ...FULL_ENV, RUN_ONCE: "1", RUN_INTERVAL_MINUTES: "30" });
    expect(cfg.runOnce).toBe(true);
    expect(cfg.intervalMinutes).toBe(30);
  });

  it("throws listing every missing variable", () => {
    expect(() => loadConfig({ ADOBE_CLIENT_ID: "cid" })).toThrow(/ADOBE_CLIENT_SECRET.*R2_ENDPOINT/s);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd worker && npx vitest run test/config.test.ts`
Expected: FAIL — cannot find `../src/config.js`.

- [ ] **Step 4: Implement `worker/src/config.ts`**

```ts
export interface Config {
  adobe: { clientId: string; clientSecret: string };
  r2: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicBaseUrl: string;
  };
  tokenPath: string;
  statePath: string;
  archiveDir: string; // edited fullsize JPEGs are archived here (spec: /volume1/photos/published)
  intervalMinutes: number;
  runOnce: boolean;
}

const REQUIRED = [
  "ADOBE_CLIENT_ID",
  "ADOBE_CLIENT_SECRET",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "PHOTOS_BASE_URL",
  "DATA_DIR",
] as const;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  const dataDir = env.DATA_DIR!.replace(/\/$/, "");
  return {
    adobe: { clientId: env.ADOBE_CLIENT_ID!, clientSecret: env.ADOBE_CLIENT_SECRET! },
    r2: {
      endpoint: env.R2_ENDPOINT!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET!,
      publicBaseUrl: env.PHOTOS_BASE_URL!.replace(/\/$/, ""),
    },
    tokenPath: `${dataDir}/tokens.json`,
    statePath: `${dataDir}/state.json`,
    archiveDir: env.ARCHIVE_DIR ?? `${dataDir}/published`,
    intervalMinutes: Number(env.RUN_INTERVAL_MINUTES ?? "15"),
    runOnce: env.RUN_ONCE === "1",
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run test/config.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/tsconfig.json worker/.gitignore worker/src/config.ts worker/test/config.test.ts
git commit -m "feat(worker): scaffold photo-worker package with config module"
```

---

### Task 2: Adobe token store with atomic persistence and refresh

**Files:**
- Create: `worker/src/adobe/auth.ts`
- Test: `worker/test/auth.test.ts`

**Interfaces:**
- Consumes: `Config` from Task 1.
- Produces:
  - `interface TokenSet { access_token: string; refresh_token: string; expires_at: number }` (`expires_at` = epoch ms)
  - `loadTokens(path: string): Promise<TokenSet>`
  - `saveTokensAtomic(path: string, t: TokenSet): Promise<void>`
  - `ensureFreshTokens(cfg: Config, fetchFn?: typeof fetch): Promise<TokenSet>` — loads, refreshes against Adobe IMS if < 10 min of life remain, persists the rotated refresh token, returns a usable set. Task 6 calls only this.

- [ ] **Step 1: Write the failing tests**

`worker/test/auth.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTokens, saveTokensAtomic, ensureFreshTokens } from "../src/adobe/auth.js";
import type { Config } from "../src/config.js";

async function tmpTokenFile(t: object): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auth-"));
  const p = join(dir, "tokens.json");
  await writeFile(p, JSON.stringify(t));
  return p;
}

function cfgWith(tokenPath: string): Config {
  return {
    adobe: { clientId: "cid", clientSecret: "cs" },
    r2: { endpoint: "", accessKeyId: "", secretAccessKey: "", bucket: "", publicBaseUrl: "" },
    tokenPath,
    statePath: "/unused",
    archiveDir: "/unused",
    intervalMinutes: 15,
    runOnce: true,
  };
}

describe("token store", () => {
  it("round-trips through save/load", async () => {
    const p = await tmpTokenFile({});
    const t = { access_token: "a", refresh_token: "r", expires_at: 123 };
    await saveTokensAtomic(p, t);
    expect(await loadTokens(p)).toEqual(t);
  });

  it("returns tokens untouched when they have >10 min of life", async () => {
    const t = { access_token: "a", refresh_token: "r", expires_at: Date.now() + 60 * 60 * 1000 };
    const p = await tmpTokenFile(t);
    const fetchFn = vi.fn();
    const out = await ensureFreshTokens(cfgWith(p), fetchFn as unknown as typeof fetch);
    expect(out.access_token).toBe("a");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refreshes expired tokens and persists the rotated refresh token", async () => {
    const t = { access_token: "old", refresh_token: "oldr", expires_at: Date.now() - 1000 };
    const p = await tmpTokenFile(t);
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "new", refresh_token: "newr", expires_in: 86399 }),
        { status: 200 },
      ),
    );
    const out = await ensureFreshTokens(cfgWith(p), fetchFn as unknown as typeof fetch);
    expect(out.access_token).toBe("new");
    const onDisk = JSON.parse(await readFile(p, "utf8"));
    expect(onDisk.refresh_token).toBe("newr");
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("ims-na1.adobelogin.com/ims/token/v3");
    expect(String(init.body)).toContain("grant_type=refresh_token");
  });

  it("throws a clear error when the refresh is rejected", async () => {
    const t = { access_token: "old", refresh_token: "dead", expires_at: 0 };
    const p = await tmpTokenFile(t);
    const fetchFn = vi.fn().mockResolvedValue(new Response("denied", { status: 400 }));
    await expect(ensureFreshTokens(cfgWith(p), fetchFn as unknown as typeof fetch)).rejects.toThrow(
      /re-consent/i,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run test/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `worker/src/adobe/auth.ts`**

```ts
import { readFile, writeFile, rename } from "node:fs/promises";
import type { Config } from "../config.js";

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3";
const MIN_LIFE_MS = 10 * 60 * 1000;

export async function loadTokens(path: string): Promise<TokenSet> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function saveTokensAtomic(path: string, t: TokenSet): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(t, null, 2));
  await rename(tmp, path);
}

export async function ensureFreshTokens(
  cfg: Config,
  fetchFn: typeof fetch = fetch,
): Promise<TokenSet> {
  const current = await loadTokens(cfg.tokenPath);
  if (current.expires_at - Date.now() > MIN_LIFE_MS) return current;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cfg.adobe.clientId,
    client_secret: cfg.adobe.clientSecret,
    refresh_token: current.refresh_token,
  });
  const res = await fetchFn(IMS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Adobe token refresh failed (${res.status}). If the worker was down >14 days, ` +
        `interactive re-consent is required: run scripts/consent.ts again.`,
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const next: TokenSet = {
    access_token: json.access_token,
    // Adobe rotates refresh tokens; fall back to the old one if none returned.
    refresh_token: json.refresh_token ?? current.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
  await saveTokensAtomic(cfg.tokenPath, next);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run test/auth.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add worker/src/adobe/auth.ts worker/test/auth.test.ts
git commit -m "feat(worker): Adobe IMS token refresh with atomic rotated-token persistence"
```

---

### Task 3: One-time consent script

**Files:**
- Create: `worker/scripts/consent.ts`, `worker/src/adobe/consent.ts`
- Test: `worker/test/consent.test.ts`

**Interfaces:**
- Consumes: `saveTokensAtomic`, `TokenSet` from Task 2.
- Produces:
  - `buildAuthorizeUrl(clientId: string): string`
  - `exchangeCode(clientId: string, clientSecret: string, code: string, fetchFn?: typeof fetch): Promise<TokenSet>`
  - `extractCode(redirectedUrl: string): string`
  - Runnable script: `npx tsx scripts/consent.ts` (interactive; used in Task 8).

The flow is paste-based (no local HTTPS server needed): print the authorize URL, the user opens it, approves, lands on `https://localhost:8080/callback?code=...` (the page won't load — that's fine), and pastes that full address back into the terminal.

- [ ] **Step 1: Write the failing tests**

`worker/test/consent.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCode, extractCode } from "../src/adobe/consent.js";

describe("consent helpers", () => {
  it("builds the IMS authorize URL with the Lightroom scopes", () => {
    const url = new URL(buildAuthorizeUrl("mycid"));
    expect(url.hostname).toBe("ims-na1.adobelogin.com");
    expect(url.pathname).toBe("/ims/authorize/v2");
    expect(url.searchParams.get("client_id")).toBe("mycid");
    expect(url.searchParams.get("scope")).toBe("openid,AdobeID,lr_partner_apis,offline_access");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://localhost:8080/callback");
  });

  it("extracts the code from a pasted redirect URL", () => {
    expect(extractCode("https://localhost:8080/callback?code=abc123&state=x")).toBe("abc123");
  });

  it("throws when the pasted URL has no code", () => {
    expect(() => extractCode("https://localhost:8080/callback?error=denied")).toThrow(/code/);
  });

  it("exchanges the code for tokens", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 86399 }),
        { status: 200 },
      ),
    );
    const t = await exchangeCode("cid", "cs", "thecode", fetchFn as unknown as typeof fetch);
    expect(t.access_token).toBe("a");
    expect(t.refresh_token).toBe("r");
    expect(t.expires_at).toBeGreaterThan(Date.now());
    const [, init] = fetchFn.mock.calls[0];
    expect(String(init.body)).toContain("grant_type=authorization_code");
    expect(String(init.body)).toContain("code=thecode");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run test/consent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `worker/src/adobe/consent.ts`**

```ts
import type { TokenSet } from "./auth.js";

const IMS_BASE = "https://ims-na1.adobelogin.com";
export const REDIRECT_URI = "https://localhost:8080/callback";

export function buildAuthorizeUrl(clientId: string): string {
  const u = new URL(`${IMS_BASE}/ims/authorize/v2`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("scope", "openid,AdobeID,lr_partner_apis,offline_access");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  return u.toString();
}

export function extractCode(redirectedUrl: string): string {
  const code = new URL(redirectedUrl).searchParams.get("code");
  if (!code) throw new Error("No ?code= found in the pasted URL. Paste the full address bar contents.");
  return code;
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetchFn(`${IMS_BASE}/ims/token/v3`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Code exchange failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!json.refresh_token) {
    throw new Error(
      "Adobe did not return a refresh_token. The API key may need offline access enabled " +
        "(see the Developer Console credential settings).",
    );
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + json.expires_in * 1000,
  };
}
```

- [ ] **Step 4: Implement the interactive wrapper `worker/scripts/consent.ts`**

```ts
import { createInterface } from "node:readline/promises";
import { buildAuthorizeUrl, exchangeCode, extractCode } from "../src/adobe/consent.js";
import { saveTokensAtomic } from "../src/adobe/auth.js";

const clientId = process.env.ADOBE_CLIENT_ID;
const clientSecret = process.env.ADOBE_CLIENT_SECRET;
const out = process.env.TOKEN_OUT ?? "secrets/tokens.json";
if (!clientId || !clientSecret) {
  console.error("Set ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET first.");
  process.exit(1);
}

console.log("\n1. Open this URL in your browser and approve access:\n");
console.log(buildAuthorizeUrl(clientId));
console.log(
  "\n2. You will land on https://localhost:8080/callback?... — the page will fail to load. That is expected.",
);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pasted = await rl.question("\n3. Paste the FULL address from the address bar here:\n> ");
rl.close();

const tokens = await exchangeCode(clientId, clientSecret, extractCode(pasted.trim()));
await saveTokensAtomic(out, tokens);
console.log(`\nTokens written to ${out}. Copy this file to the NAS data volume as tokens.json.`);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run test/consent.test.ts`
Expected: 4 passing. (The wrapper script is exercised live in Task 8.)

- [ ] **Step 6: Commit**

```bash
git add worker/src/adobe/consent.ts worker/scripts/consent.ts worker/test/consent.test.ts
git commit -m "feat(worker): one-time OAuth consent script (paste-based, no local server)"
```

---

### Task 4: Lightroom API client (catalog, picks, fullsize rendition)

**Files:**
- Create: `worker/src/adobe/client.ts`
- Test: `worker/test/client.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (takes plain strings; Task 6 wires it to `Config` + `TokenSet`).
- Produces:
  - `stripGuard(text: string): string`
  - `interface PickAsset { id: string; updated: string; captureDate: string }`
  - `class LrClient { constructor(clientId: string, accessToken: string, fetchFn?: typeof fetch); getCatalogId(): Promise<string>; listPicks(catalogId: string): Promise<PickAsset[]>; fetchFullsize(catalogId: string, assetId: string, opts?: { pollMs?: number; maxPolls?: number }): Promise<Buffer> }`

Design note: `listPicks` enumerates ALL picks each run (`flag=pick`, paginated). Pick counts are small (hundreds), so a full listing per run is one or two requests and makes unflag-detection a simple diff in Task 6 — no `updated_since` bookkeeping. Fullsize uses the generate-renditions endpoint: POST with `X-Generate-Renditions: fullsize`, then poll the rendition GET until 200. **The exact response field names are verified live in Task 8** — if the real API differs, adjust this client and its test fixtures there.

- [ ] **Step 1: Write the failing tests**

`worker/test/client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { LrClient, stripGuard } from "../src/adobe/client.js";

const GUARD = "while (1) {}\n";
const json = (o: object, status = 200) =>
  new Response(GUARD + JSON.stringify(o), { status });

describe("stripGuard", () => {
  it("removes the while(1) prefix", () => {
    expect(JSON.parse(stripGuard(GUARD + '{"a":1}'))).toEqual({ a: 1 });
  });
  it("passes unguarded text through", () => {
    expect(stripGuard('{"a":1}')).toBe('{"a":1}');
  });
});

describe("LrClient", () => {
  it("gets the catalog id with auth headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ id: "cat1" }));
    const c = new LrClient("cid", "tok", fetchFn as unknown as typeof fetch);
    expect(await c.getCatalogId()).toBe("cat1");
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://lr.adobe.io/v2/catalog");
    expect(init.headers["Authorization"]).toBe("Bearer tok");
    expect(init.headers["X-API-Key"]).toBe("cid");
  });

  it("lists picks across pages", async () => {
    const page1 = {
      resources: [
        { id: "a1", updated: "2026-08-01T00:00:00Z", payload: { captureDate: "2026-07-30T10:00:00" } },
      ],
      links: { next: { href: "catalogs/cat1/assets?flag=pick&cursor=2" } },
    };
    const page2 = {
      resources: [
        { id: "a2", updated: "2026-08-02T00:00:00Z", payload: { captureDate: "2026-07-31T10:00:00" } },
      ],
    };
    const fetchFn = vi.fn().mockResolvedValueOnce(json(page1)).mockResolvedValueOnce(json(page2));
    const c = new LrClient("cid", "tok", fetchFn as unknown as typeof fetch);
    const picks = await c.listPicks("cat1");
    expect(picks.map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(String(fetchFn.mock.calls[0][0])).toContain("flag=pick");
    expect(String(fetchFn.mock.calls[0][0])).toContain("subtype=image");
    expect(String(fetchFn.mock.calls[1][0])).toBe("https://lr.adobe.io/v2/catalogs/cat1/assets?flag=pick&cursor=2");
  });

  it("generates then polls a fullsize rendition", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3]);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 })) // POST generate
      .mockResolvedValueOnce(new Response("nope", { status: 404 })) // not ready
      .mockResolvedValueOnce(new Response(jpeg, { status: 200 })); // ready
    const c = new LrClient("cid", "tok", fetchFn as unknown as typeof fetch);
    const buf = await c.fetchFullsize("cat1", "a1", { pollMs: 1, maxPolls: 5 });
    expect(Buffer.compare(buf, jpeg)).toBe(0);
    const [postUrl, postInit] = fetchFn.mock.calls[0];
    expect(String(postUrl)).toBe("https://lr.adobe.io/v2/catalogs/cat1/assets/a1/renditions");
    expect(postInit.method).toBe("POST");
    expect(postInit.headers["X-Generate-Renditions"]).toBe("fullsize");
    expect(String(fetchFn.mock.calls[1][0])).toBe(
      "https://lr.adobe.io/v2/catalogs/cat1/assets/a1/renditions/fullsize",
    );
  });

  it("gives up after maxPolls with a clear error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    const c = new LrClient("cid", "tok", fetchFn as unknown as typeof fetch);
    await expect(c.fetchFullsize("cat1", "a1", { pollMs: 1, maxPolls: 3 })).rejects.toThrow(/a1/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run test/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `worker/src/adobe/client.ts`**

```ts
const LR_BASE = "https://lr.adobe.io/v2";

export function stripGuard(text: string): string {
  return text.replace(/^while\s*\(\s*1\s*\)\s*\{\s*\}\s*/, "");
}

export interface PickAsset {
  id: string;
  updated: string;
  captureDate: string;
}

interface AssetsPage {
  resources: Array<{ id: string; updated: string; payload?: { captureDate?: string } }>;
  links?: { next?: { href: string } };
}

export class LrClient {
  constructor(
    private clientId: string,
    private accessToken: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, "X-API-Key": this.clientId };
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchFn(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Lightroom API GET ${url} failed: ${res.status}`);
    return JSON.parse(stripGuard(await res.text())) as T;
  }

  async getCatalogId(): Promise<string> {
    const cat = await this.getJson<{ id: string }>(`${LR_BASE}/catalog`);
    return cat.id;
  }

  async listPicks(catalogId: string): Promise<PickAsset[]> {
    const picks: PickAsset[] = [];
    let url: string | undefined = `${LR_BASE}/catalogs/${catalogId}/assets?subtype=image&flag=pick&limit=500`;
    while (url) {
      const page: AssetsPage = await this.getJson<AssetsPage>(url);
      for (const r of page.resources) {
        picks.push({ id: r.id, updated: r.updated, captureDate: r.payload?.captureDate ?? "" });
      }
      // next hrefs are relative to /v2/
      url = page.links?.next?.href ? `${LR_BASE}/${page.links.next.href}` : undefined;
    }
    return picks;
  }

  async fetchFullsize(
    catalogId: string,
    assetId: string,
    opts: { pollMs?: number; maxPolls?: number } = {},
  ): Promise<Buffer> {
    const { pollMs = 5000, maxPolls = 60 } = opts;
    const base = `${LR_BASE}/catalogs/${catalogId}/assets/${assetId}/renditions`;
    const gen = await this.fetchFn(base, {
      method: "POST",
      headers: { ...this.headers(), "X-Generate-Renditions": "fullsize" },
    });
    if (gen.status !== 202 && !gen.ok) {
      throw new Error(`Rendition generation for ${assetId} failed: ${gen.status}`);
    }
    for (let i = 0; i < maxPolls; i++) {
      const res = await this.fetchFn(`${base}/fullsize`, { headers: this.headers() });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Fullsize rendition for ${assetId} not ready after ${maxPolls} polls`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npx vitest run test/client.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add worker/src/adobe/client.ts worker/test/client.test.ts
git commit -m "feat(worker): Lightroom API client — catalog, pick listing, fullsize renditions"
```

---

### Task 5: Derivatives, R2 store, state, and manifest modules

**Files:**
- Create: `worker/src/derive.ts`, `worker/src/r2.ts`, `worker/src/state.ts`, `worker/src/manifest.ts`
- Test: `worker/test/derive.test.ts`, `worker/test/state-manifest.test.ts`

**Interfaces:**
- Consumes: `Config` from Task 1.
- Produces (Task 6 depends on every name here):
  - `derive(source: Buffer): Promise<Derived>` where `interface Derived { hash: string; width: number; height: number; display: { buf: Buffer; width: number; height: number }; thumb: { buf: Buffer; width: number; height: number } }` (`width`/`height` are the display derivative's dimensions — the largest the site will ever show)
  - `interface ObjectStore { putImage(key: string, body: Buffer): Promise<void>; putJson(key: string, value: unknown): Promise<void>; deleteKeys(keys: string[]): Promise<void> }`
  - `makeR2Store(cfg: Config): ObjectStore` (S3 against R2; `putImage` sets `image/jpeg` + immutable cache; `putJson` sets `application/json` + `no-cache`)
  - `keysFor(hash: string): { display: string; thumb: string }` → `photos/<hash>-display.jpg` / `photos/<hash>-thumb.jpg`
  - `interface PublishedEntry { hash: string; updated: string; captureDate: string; width: number; height: number }`
  - `interface State { published: Record<string, PublishedEntry> }`
  - `loadState(path: string): Promise<State>` (missing file → `{ published: {} }`), `saveStateAtomic(path: string, s: State): Promise<void>`
  - `buildManifest(s: State, publicBaseUrl: string, generatedAt: string): Manifest` where `interface Manifest { generatedAt: string; photos: Array<{ id: string; captureDate: string; width: number; height: number; thumbUrl: string; displayUrl: string }> }`, photos sorted by `captureDate` descending.

- [ ] **Step 1: Write the failing derive test**

`worker/test/derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { derive } from "../src/derive.js";

async function testJpeg(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();
}

describe("derive", () => {
  it("produces display at 3500px long edge and thumb at 800px", async () => {
    const d = await derive(await testJpeg(6000, 4000));
    expect(d.display.width).toBe(3500);
    expect(d.display.height).toBe(2333);
    expect(d.thumb.width).toBe(800);
    expect(d.width).toBe(3500);
    expect(d.hash).toMatch(/^[0-9a-f]{16}$/);
    const meta = await sharp(d.display.buf).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("never upscales a small source", async () => {
    const d = await derive(await testJpeg(1200, 900));
    expect(d.display.width).toBe(1200);
    expect(d.thumb.width).toBe(800);
  });

  it("is deterministic: same bytes, same hash", async () => {
    const buf = await testJpeg(1000, 800);
    const [a, b] = [await derive(buf), await derive(buf)];
    expect(a.hash).toBe(b.hash);
  });
});
```

- [ ] **Step 2: Write the failing state/manifest test**

`worker/test/state-manifest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState, saveStateAtomic } from "../src/state.js";
import { buildManifest } from "../src/manifest.js";
import { keysFor } from "../src/r2.js";

describe("state", () => {
  it("returns empty state for a missing file and round-trips", async () => {
    const p = join(await mkdtemp(join(tmpdir(), "st-")), "state.json");
    expect(await loadState(p)).toEqual({ published: {} });
    const s = {
      published: { a1: { hash: "h1", updated: "u", captureDate: "c", width: 3500, height: 2333 } },
    };
    await saveStateAtomic(p, s);
    expect(await loadState(p)).toEqual(s);
  });
});

describe("keysFor", () => {
  it("builds content-hash keys", () => {
    expect(keysFor("abcd")).toEqual({ display: "photos/abcd-display.jpg", thumb: "photos/abcd-thumb.jpg" });
  });
});

describe("buildManifest", () => {
  it("sorts photos newest-first and builds absolute URLs", () => {
    const s = {
      published: {
        old: { hash: "h1", updated: "u", captureDate: "2024-01-01T00:00:00", width: 3500, height: 2333 },
        new: { hash: "h2", updated: "u", captureDate: "2026-05-05T00:00:00", width: 2000, height: 3000 },
      },
    };
    const m = buildManifest(s, "https://pub-x.r2.dev", "2026-08-25T00:00:00Z");
    expect(m.generatedAt).toBe("2026-08-25T00:00:00Z");
    expect(m.photos.map((p) => p.id)).toEqual(["new", "old"]);
    expect(m.photos[0].displayUrl).toBe("https://pub-x.r2.dev/photos/h2-display.jpg");
    expect(m.photos[0].thumbUrl).toBe("https://pub-x.r2.dev/photos/h2-thumb.jpg");
    expect(m.photos[0].width).toBe(2000);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `cd worker && npx vitest run test/derive.test.ts test/state-manifest.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the four modules**

`worker/src/derive.ts`:

```ts
import sharp from "sharp";
import { createHash } from "node:crypto";

export interface DerivedImage {
  buf: Buffer;
  width: number;
  height: number;
}

export interface Derived {
  hash: string;
  width: number;
  height: number;
  display: DerivedImage;
  thumb: DerivedImage;
}

async function resizeJpeg(source: Buffer, longEdge: number, quality: number): Promise<DerivedImage> {
  const buf = await sharp(source)
    .rotate() // honor EXIF orientation
    .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width!, height: meta.height! };
}

export async function derive(source: Buffer): Promise<Derived> {
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
  const [display, thumb] = await Promise.all([
    resizeJpeg(source, 3500, 85),
    resizeJpeg(source, 800, 80),
  ]);
  return { hash, width: display.width, height: display.height, display, thumb };
}
```

`worker/src/r2.ts`:

```ts
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { Config } from "./config.js";

export interface ObjectStore {
  putImage(key: string, body: Buffer): Promise<void>;
  putJson(key: string, value: unknown): Promise<void>;
  deleteKeys(keys: string[]): Promise<void>;
}

export function keysFor(hash: string): { display: string; thumb: string } {
  return { display: `photos/${hash}-display.jpg`, thumb: `photos/${hash}-thumb.jpg` };
}

export function makeR2Store(cfg: Config): ObjectStore {
  const s3 = new S3Client({
    region: "auto",
    endpoint: cfg.r2.endpoint,
    credentials: { accessKeyId: cfg.r2.accessKeyId, secretAccessKey: cfg.r2.secretAccessKey },
  });
  const Bucket = cfg.r2.bucket;
  return {
    async putImage(key, body) {
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: body,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async putJson(key, value) {
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: JSON.stringify(value, null, 2),
          ContentType: "application/json",
          CacheControl: "no-cache",
        }),
      );
    },
    async deleteKeys(keys) {
      if (!keys.length) return;
      await s3.send(
        new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
      );
    },
  };
}
```

`worker/src/state.ts`:

```ts
import { readFile, writeFile, rename } from "node:fs/promises";

export interface PublishedEntry {
  hash: string;
  updated: string;
  captureDate: string;
  width: number;
  height: number;
}

export interface State {
  published: Record<string, PublishedEntry>;
}

export async function loadState(path: string): Promise<State> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { published: {} };
    throw e;
  }
}

export async function saveStateAtomic(path: string, s: State): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2));
  await rename(tmp, path);
}
```

`worker/src/manifest.ts`:

```ts
import type { State } from "./state.js";
import { keysFor } from "./r2.js";

export interface ManifestPhoto {
  id: string;
  captureDate: string;
  width: number;
  height: number;
  thumbUrl: string;
  displayUrl: string;
}

export interface Manifest {
  generatedAt: string;
  photos: ManifestPhoto[];
}

export function buildManifest(s: State, publicBaseUrl: string, generatedAt: string): Manifest {
  const photos = Object.entries(s.published)
    .map(([id, e]) => {
      const keys = keysFor(e.hash);
      return {
        id,
        captureDate: e.captureDate,
        width: e.width,
        height: e.height,
        thumbUrl: `${publicBaseUrl}/${keys.thumb}`,
        displayUrl: `${publicBaseUrl}/${keys.display}`,
      };
    })
    .sort((a, b) => b.captureDate.localeCompare(a.captureDate));
  return { generatedAt, photos };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && npx vitest run test/derive.test.ts test/state-manifest.test.ts`
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
git add worker/src/derive.ts worker/src/r2.ts worker/src/state.ts worker/src/manifest.ts worker/test/derive.test.ts worker/test/state-manifest.test.ts
git commit -m "feat(worker): derivatives, R2 object store, state persistence, manifest builder"
```

---

### Task 6: Orchestrator (`runOnce`) + entry loop

**Files:**
- Create: `worker/src/run.ts`, `worker/src/index.ts`
- Test: `worker/test/run.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 1–5, exactly as named there.
- Produces: `runOnce(deps: RunDeps): Promise<RunResult>` with

```ts
interface RunDeps {
  cfg: Config;
  client: Pick<LrClient, "getCatalogId" | "listPicks" | "fetchFullsize">;
  store: ObjectStore;
  now: () => Date;
}
interface RunResult { publishedCount: number; added: number; removed: number }
```

`status.json` shape (uploaded every pass, also on failure by `index.ts`):
`{ lastRunAt: string; ok: boolean; error: string | null; publishedCount: number }`

- [ ] **Step 1: Write the failing tests**

`worker/test/run.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { runOnce } from "../src/run.js";
import { loadState, saveStateAtomic } from "../src/state.js";
import type { Config } from "../src/config.js";
import type { ObjectStore } from "../src/r2.js";

async function testJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 9, g: 9, b: 9 } } })
    .jpeg()
    .toBuffer();
}

function memStore() {
  const objects = new Map<string, Buffer | string>();
  const putOrder: string[] = [];
  const store: ObjectStore = {
    async putImage(key, body) { objects.set(key, body); putOrder.push(key); },
    async putJson(key, value) { objects.set(key, JSON.stringify(value)); putOrder.push(key); },
    async deleteKeys(keys) { keys.forEach((k) => objects.delete(k)); },
  };
  return { store, objects, putOrder };
}

let cfg: Config;
beforeEach(async () => {
  const dir = await mkdtemp(join(tmpdir(), "run-"));
  cfg = {
    adobe: { clientId: "cid", clientSecret: "cs" },
    r2: { endpoint: "", accessKeyId: "", secretAccessKey: "", bucket: "b", publicBaseUrl: "https://pub-x.r2.dev" },
    tokenPath: join(dir, "tokens.json"),
    statePath: join(dir, "state.json"),
    archiveDir: join(dir, "published"),
    intervalMinutes: 15,
    runOnce: true,
  };
});

describe("runOnce", () => {
  it("publishes a new pick: images, state, manifest last", async () => {
    const jpeg = await testJpeg();
    const { store, objects, putOrder } = memStore();
    const result = await runOnce({
      cfg,
      client: {
        getCatalogId: vi.fn().mockResolvedValue("cat1"),
        listPicks: vi.fn().mockResolvedValue([
          { id: "a1", updated: "2026-08-20T00:00:00Z", captureDate: "2026-08-10T12:00:00" },
        ]),
        fetchFullsize: vi.fn().mockResolvedValue(jpeg),
      },
      store,
      now: () => new Date("2026-08-25T10:00:00Z"),
    });
    expect(result).toEqual({ publishedCount: 1, added: 1, removed: 0 });
    const manifest = JSON.parse(objects.get("manifest.json") as string);
    expect(manifest.photos).toHaveLength(1);
    expect(manifest.photos[0].id).toBe("a1");
    // manifest.json and status.json are the last two writes
    expect(putOrder.at(-2)).toBe("manifest.json");
    expect(putOrder.at(-1)).toBe("status.json");
    const state = await loadState(cfg.statePath);
    expect(state.published.a1.width).toBe(1600);
    // edited fullsize archived on the NAS volume (spec: only readable backup of edits)
    const archived = await readFile(join(cfg.archiveDir, "a1.jpg"));
    expect(Buffer.compare(archived, jpeg)).toBe(0);
  });

  it("skips unchanged picks (no re-export)", async () => {
    const jpeg = await testJpeg();
    const fetchFullsize = vi.fn().mockResolvedValue(jpeg);
    const deps = {
      cfg,
      client: {
        getCatalogId: vi.fn().mockResolvedValue("cat1"),
        listPicks: vi.fn().mockResolvedValue([
          { id: "a1", updated: "2026-08-20T00:00:00Z", captureDate: "2026-08-10T12:00:00" },
        ]),
        fetchFullsize,
      },
      store: memStore().store,
      now: () => new Date(),
    };
    await runOnce(deps);
    await runOnce(deps);
    expect(fetchFullsize).toHaveBeenCalledTimes(1);
  });

  it("removes unflagged picks from R2 and state", async () => {
    await saveStateAtomic(cfg.statePath, {
      published: { gone: { hash: "hh", updated: "u", captureDate: "c", width: 10, height: 10 } },
    });
    const { store, objects } = memStore();
    objects.set("photos/hh-display.jpg", Buffer.from("x"));
    objects.set("photos/hh-thumb.jpg", Buffer.from("x"));
    const result = await runOnce({
      cfg,
      client: {
        getCatalogId: vi.fn().mockResolvedValue("cat1"),
        listPicks: vi.fn().mockResolvedValue([]),
        fetchFullsize: vi.fn(),
      },
      store,
      now: () => new Date(),
    });
    expect(result).toEqual({ publishedCount: 0, added: 0, removed: 1 });
    expect(objects.has("photos/hh-display.jpg")).toBe(false);
    expect((await loadState(cfg.statePath)).published).toEqual({});
  });

  it("keeps earlier successes if one asset fails mid-pass", async () => {
    const jpeg = await testJpeg();
    const { store } = memStore();
    const deps = {
      cfg,
      client: {
        getCatalogId: vi.fn().mockResolvedValue("cat1"),
        listPicks: vi.fn().mockResolvedValue([
          { id: "ok1", updated: "u1", captureDate: "2026-01-01T00:00:00" },
          { id: "bad", updated: "u2", captureDate: "2026-01-02T00:00:00" },
        ]),
        fetchFullsize: vi
          .fn()
          .mockImplementation(async (_c: string, id: string) => {
            if (id === "bad") throw new Error("render timeout");
            return jpeg;
          }),
      },
      store,
      now: () => new Date(),
    };
    await expect(runOnce(deps)).rejects.toThrow(/bad/);
    // ok1 survived in state, so the next pass won't redo it
    const state = await loadState(cfg.statePath);
    expect(state.published.ok1).toBeDefined();
    expect(state.published.bad).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npx vitest run test/run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `worker/src/run.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.js";
import type { LrClient } from "./adobe/client.js";
import type { ObjectStore } from "./r2.js";
import { keysFor } from "./r2.js";
import { derive } from "./derive.js";
import { loadState, saveStateAtomic } from "./state.js";
import { buildManifest } from "./manifest.js";

export interface RunDeps {
  cfg: Config;
  client: Pick<LrClient, "getCatalogId" | "listPicks" | "fetchFullsize">;
  store: ObjectStore;
  now: () => Date;
}

export interface RunResult {
  publishedCount: number;
  added: number;
  removed: number;
}

export async function runOnce({ cfg, client, store, now }: RunDeps): Promise<RunResult> {
  const catalogId = await client.getCatalogId();
  const picks = await client.listPicks(catalogId);
  const state = await loadState(cfg.statePath);
  const pickIds = new Set(picks.map((p) => p.id));

  let added = 0;
  let failure: Error | null = null;

  for (const pick of picks) {
    const existing = state.published[pick.id];
    if (existing && existing.updated === pick.updated) continue;
    try {
      const fullsize = await client.fetchFullsize(catalogId, pick.id);
      // Archive the edited fullsize on the NAS — the only readable backup of develop edits.
      await mkdir(cfg.archiveDir, { recursive: true });
      await writeFile(join(cfg.archiveDir, `${pick.id}.jpg`), fullsize);
      const d = await derive(fullsize);
      const keys = keysFor(d.hash);
      await store.putImage(keys.display, d.display.buf);
      await store.putImage(keys.thumb, d.thumb.buf);
      if (existing && existing.hash !== d.hash) {
        const old = keysFor(existing.hash);
        await store.deleteKeys([old.display, old.thumb]);
      }
      state.published[pick.id] = {
        hash: d.hash,
        updated: pick.updated,
        captureDate: pick.captureDate,
        width: d.width,
        height: d.height,
      };
      await saveStateAtomic(cfg.statePath, state); // per-asset: crash-safe progress
      added++;
    } catch (e) {
      failure = new Error(`Asset ${pick.id} failed: ${(e as Error).message}`);
      break; // stop the pass; completed assets are already persisted
    }
  }

  let removed = 0;
  if (!failure) {
    const goneIds = Object.keys(state.published).filter((id) => !pickIds.has(id));
    const goneKeys = goneIds.flatMap((id) => {
      const k = keysFor(state.published[id].hash);
      return [k.display, k.thumb];
    });
    await store.deleteKeys(goneKeys);
    for (const id of goneIds) delete state.published[id];
    if (goneIds.length) await saveStateAtomic(cfg.statePath, state);
    removed = goneIds.length;
  }

  const publishedCount = Object.keys(state.published).length;
  // Manifest reflects everything persisted so far — written last, even before rethrowing.
  await store.putJson("manifest.json", buildManifest(state, cfg.r2.publicBaseUrl, now().toISOString()));
  await store.putJson("status.json", {
    lastRunAt: now().toISOString(),
    ok: !failure,
    error: failure ? failure.message : null,
    publishedCount,
  });
  if (failure) throw failure;
  return { publishedCount, added, removed };
}
```

- [ ] **Step 4: Implement `worker/src/index.ts` (entry loop)**

```ts
import { loadConfig } from "./config.js";
import { ensureFreshTokens } from "./adobe/auth.js";
import { LrClient } from "./adobe/client.js";
import { makeR2Store } from "./r2.js";
import { runOnce } from "./run.js";

const cfg = loadConfig();
const store = makeR2Store(cfg);

async function pass(): Promise<void> {
  const tokens = await ensureFreshTokens(cfg);
  const client = new LrClient(cfg.adobe.clientId, tokens.access_token);
  const result = await runOnce({ cfg, client, store, now: () => new Date() });
  console.log(
    `[${new Date().toISOString()}] pass ok: ${result.publishedCount} published (+${result.added}/-${result.removed})`,
  );
}

async function main(): Promise<void> {
  if (cfg.runOnce) {
    await pass();
    return;
  }
  for (;;) {
    try {
      await pass();
    } catch (e) {
      console.error(`[${new Date().toISOString()}] pass failed:`, (e as Error).message);
      // Surface auth/API failures even when runOnce couldn't write status itself.
      await store
        .putJson("status.json", {
          lastRunAt: new Date().toISOString(),
          ok: false,
          error: (e as Error).message,
          publishedCount: -1,
        })
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, cfg.intervalMinutes * 60 * 1000));
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
```

- [ ] **Step 5: Run the full worker test suite and the build**

Run: `cd worker && npx vitest run && npm run build`
Expected: all tests pass; `tsc` emits `dist/` with no errors.

- [ ] **Step 6: Commit**

```bash
git add worker/src/run.ts worker/src/index.ts worker/test/run.test.ts
git commit -m "feat(worker): idempotent publish pass with manifest-last ordering and entry loop"
```

---

### Task 7: R2 provisioning — dev URL + S3 credentials + live smoke

This task is CLI/dashboard work, not TDD. wrangler on the Mac is already authenticated; the bucket `photo-gallery` already exists.

**Files:**
- Create: `worker/.env.example`
- Create: `worker/scripts/r2-smoke.ts`

**Interfaces:**
- Consumes: `loadConfig`, `makeR2Store` from earlier tasks.
- Produces: a filled-in local `worker/.env` (gitignored) with working `R2_*` and `PHOTOS_BASE_URL` values; used by Tasks 8–9.

- [ ] **Step 1: Enable the r2.dev public dev URL**

```bash
npx wrangler r2 bucket dev-url enable photo-gallery
```

Confirm when prompted. Note the printed `https://pub-<id>.r2.dev` URL — this is `PHOTOS_BASE_URL` until a custom domain exists.

- [ ] **Step 2: Get the account ID**

```bash
npx wrangler whoami
```

The R2 S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

- [ ] **Step 3: Create bucket-scoped S3 credentials (user does this in the dashboard)**

Ask the user to: Cloudflare dashboard → R2 → **Manage R2 API Tokens** → Create API Token → Permissions: **Object Read & Write**, Scope: **Apply to specific buckets → `photo-gallery`** → Create. Copy the **Access Key ID** and **Secret Access Key** shown once. (There is no wrangler command for this.)

- [ ] **Step 4: Write `worker/.env.example` and the real `.env`**

`worker/.env.example` (committed):

```
ADOBE_CLIENT_ID=
ADOBE_CLIENT_SECRET=
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=photo-gallery
PHOTOS_BASE_URL=https://pub-XXXX.r2.dev
DATA_DIR=/data
```

Copy to `worker/.env` (gitignored) and fill in the real values from Steps 1–3. Adobe values stay empty until Task 8.

- [ ] **Step 5: Write and run the R2 smoke script**

`worker/scripts/r2-smoke.ts`:

```ts
import { loadConfig } from "../src/config.js";
import { makeR2Store } from "../src/r2.js";

const cfg = loadConfig({ ...process.env, ADOBE_CLIENT_ID: "x", ADOBE_CLIENT_SECRET: "x" });
const store = makeR2Store(cfg);
await store.putJson("smoke-test.json", { ok: true, at: new Date().toISOString() });
console.log("Wrote smoke-test.json. Public URL check:");
const res = await fetch(`${cfg.r2.publicBaseUrl}/smoke-test.json`);
console.log(`GET ${cfg.r2.publicBaseUrl}/smoke-test.json → ${res.status}`);
if (!res.ok) throw new Error("Public read failed — check dev URL and credentials.");
await store.deleteKeys(["smoke-test.json"]);
console.log("Cleaned up. R2 provisioning verified.");
```

Run: `cd worker && set -a && source .env && set +a && npx tsx scripts/r2-smoke.ts`
Expected: status 200 and "R2 provisioning verified." (Install tsx on demand: `npm i -D tsx`.)

- [ ] **Step 6: Commit**

```bash
git add worker/.env.example worker/scripts/r2-smoke.ts worker/package.json worker/package-lock.json
git commit -m "chore(worker): R2 provisioning smoke script and env template"
```

---

### Task 8: Adobe console setup + consent + live API verification

User-in-the-loop task. The Adobe Developer Console cannot be automated.

**Files:**
- Create: `worker/scripts/lr-smoke.ts`

**Interfaces:**
- Consumes: `ensureFreshTokens`, `LrClient`, consent script from Tasks 2–4.
- Produces: `worker/secrets/tokens.json` (gitignored) with a working refresh token; verified field names in `LrClient` (adjust client + fixtures here if the live API differs).

- [ ] **Step 1: Guide the user through the Developer Console (user action)**

Ask the user to, at https://developer.adobe.com/console: Create project → Add API → **Lightroom Services** → choose **OAuth Web App** credential → Redirect URI: `https://localhost:8080/callback`, Redirect URI pattern: `https://localhost:8080/.*` → save. Then copy the **Client ID** and **Client Secret** into `worker/.env`. (If "Lightroom Services" is not offered to their account, STOP and report — this is the research spike's known access risk; the pipeline design needs revisiting with the user.)

- [ ] **Step 2: Run the consent flow (user action, guided)**

```bash
cd worker && mkdir -p secrets && set -a && source .env && set +a && npx tsx scripts/consent.ts
```

The user opens the printed URL, logs into Adobe, approves, and pastes back the resulting `https://localhost:8080/callback?code=...` address. Expected output: `Tokens written to secrets/tokens.json`.

- [ ] **Step 3: Write the live smoke script**

`worker/scripts/lr-smoke.ts`:

```ts
import { loadConfig } from "../src/config.js";
import { ensureFreshTokens } from "../src/adobe/auth.js";
import { LrClient } from "../src/adobe/client.js";

const cfg = loadConfig({ ...process.env, DATA_DIR: "secrets", R2_ENDPOINT: process.env.R2_ENDPOINT ?? "x",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "x", R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "x",
  R2_BUCKET: process.env.R2_BUCKET ?? "x", PHOTOS_BASE_URL: process.env.PHOTOS_BASE_URL ?? "x" });
const tokens = await ensureFreshTokens(cfg);
const client = new LrClient(cfg.adobe.clientId, tokens.access_token);
const catalogId = await client.getCatalogId();
console.log(`catalog: ${catalogId}`);
const picks = await client.listPicks(catalogId);
console.log(`picks: ${picks.length}`);
for (const p of picks.slice(0, 3)) console.log(` - ${p.id} updated=${p.updated} captured=${p.captureDate}`);
if (picks.length) {
  const buf = await client.fetchFullsize(catalogId, picks[0].id);
  console.log(`fullsize of ${picks[0].id}: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}
```

- [ ] **Step 4: Have the user flag one test pick, then run the smoke**

Ask the user to flag exactly one photo as a pick in Lightroom (any device) and wait ~a minute for cloud sync. Then:

Run: `cd worker && set -a && source .env && set +a && npx tsx scripts/lr-smoke.ts`
Expected: a catalog id, `picks: 1` (or more), and a fullsize download of several MB.

**If any call 404s or returns different field names:** dump the raw response (`stripGuard` output) with a temporary `console.log`, adjust `LrClient`/`PickAsset` mapping and the Task 4 test fixtures to match reality, re-run `npx vitest run`, and note the corrected shapes in the commit message.

- [ ] **Step 5: Commit**

```bash
git add worker/scripts/lr-smoke.ts
git commit -m "chore(worker): live Lightroom API smoke script (verified against real catalog)"
```

---

### Task 9: End-to-end on the Mac, then Dockerize and deploy to the NAS

**Files:**
- Create: `worker/Dockerfile`, `worker/compose.yml`
- Modify: `docs/admin-setup.md` (append worker ops section)

**Interfaces:**
- Consumes: the whole worker; `.env` from Task 7/8; `secrets/tokens.json` from Task 8.
- Produces: the running production worker on the NAS at `/volume1/docker/photo-worker/`, data volume `/volume1/photos/worker/`.

- [ ] **Step 1: Full pass locally on the Mac**

```bash
cd worker && set -a && source .env && set +a && DATA_DIR=secrets RUN_ONCE=1 npm run build && node dist/index.js
```

Expected: `pass ok: N published (+N/-0)`. Verify in a browser: `<PHOTOS_BASE_URL>/manifest.json` lists the test pick, and its `displayUrl` renders a JPEG at 3500 px long edge.

- [ ] **Step 2: Write `worker/Dockerfile`**

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Write `worker/compose.yml`**

```yaml
services:
  photo-worker:
    build: .
    container_name: photo-worker
    restart: unless-stopped
    env_file: .env
    environment:
      DATA_DIR: /data
      ARCHIVE_DIR: /archive
    volumes:
      - /volume1/photos/worker:/data
      - /volume1/photos/published:/archive
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
```

- [ ] **Step 4: Deploy to the NAS**

```bash
ssh nas 'mkdir -p /volume1/docker/photo-worker /volume1/photos/worker /volume1/photos/published'
rsync -a --exclude node_modules --exclude dist --exclude secrets worker/ nas:/volume1/docker/photo-worker/
scp worker/.env nas:/volume1/docker/photo-worker/.env
scp worker/secrets/tokens.json nas:/volume1/photos/worker/tokens.json
ssh nas 'cd /volume1/docker/photo-worker && docker compose up -d --build'
```

- [ ] **Step 5: Verify the deployed worker**

```bash
ssh nas 'docker logs -f --tail 20 photo-worker'
```

Expected within a minute: a `pass ok:` line. Then confirm `<PHOTOS_BASE_URL>/status.json` shows `"ok": true` with a fresh `lastRunAt`. Ask the user to flag one more pick in Lightroom; within ~16 minutes it must appear in `manifest.json` without any manual action. Also verify unflagging: remove the test pick flag, wait a pass, confirm it disappears from `manifest.json`.

- [ ] **Step 6: Document operations**

Append to `docs/admin-setup.md` a "Photo worker (NAS)" section covering: where it runs (`/volume1/docker/photo-worker`), the data volume (`/volume1/photos/worker`), how to read logs, what `status.json` means, the >14-day-outage re-consent procedure (`scripts/consent.ts` on the Mac, then `scp` the token file and `docker compose restart`), and the future custom-domain swap (`PHOTOS_BASE_URL` in `.env` + restart).

- [ ] **Step 7: Commit**

```bash
git add worker/Dockerfile worker/compose.yml docs/admin-setup.md
git commit -m "feat(worker): Dockerfile, compose config, and NAS deployment docs"
```

---

## Verification sweep (after all tasks)

- `cd worker && npx vitest run` — full suite green.
- `<PHOTOS_BASE_URL>/manifest.json` — valid JSON, photos sorted newest-first, URLs resolve to JPEGs with immutable cache headers (`curl -sI <displayUrl> | grep -i cache-control`).
- `ssh nas 'docker ps --filter name=photo-worker'` — up, restart policy `unless-stopped`.
- Memory update: record the deployed worker + pending custom-domain swap in the project memory directory.
