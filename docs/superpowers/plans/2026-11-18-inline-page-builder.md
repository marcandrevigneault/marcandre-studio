# Inline Page Builder Implementation Plan

> **For agentic workers:** use subagent-driven-development for independent schema/rendering, UI and persistence tasks.

**Goal:** Let the administrator build Home, Projects and About directly on their pages.
**Architecture:** Shared validated bilingual block documents render with React SSR in Astro. A client-only admin overlay replaces the static canvas while editing. D1 stores private drafts; GitHub stores published JSON with SHA conflict protection.
**Tech Stack:** Existing Astro, React, Zod, dnd-kit, Octokit, Cloudflare D1.
**Spec:** docs/superpowers/specs/2026-11-18-inline-page-builder.md

## Tasks
- [x] Schema/default documents and shared renderer: malicious URL/shape tests, preserved content and unavailable links, no raw HTML.
- [x] Draft and publish APIs: private optimistic D1 saves, published SHA commits, no data loss on concurrency/failures; backend tests.
- [x] In-page toolbar: direct text edit, block palette/settings/reordering, undo/redo, bilingual edits, mobile preview, save/publish/exit controls.
- [x] Integrate three routes and admin links; validate initial appearance and authenticated/anonymous/visitor states.
- [x] Browser workflow against isolated test storage: edit, reorder, draft/reload, publish, conflict, discard, mobile.
- [ ] Build/test, review, deploy Worker migration + site and verify live read-only flows without changing owner's published pages.

## Review Focus
- Stored or pasted script URLs and HTML must never execute.
- Drafts are never exposed via public SSR routes.
- Stale browser tabs cannot overwrite another draft/publication.
- French/English edits remain independent and unpublished edits survive errors.
- Exit/visitor navigation warns before discarding unsaved edits.

Validation: 102 automated tests passed; production Astro build passed. Isolated browser checks covered private D1 saves/reloads/conflicts, inline FR/EN editing, keyboard drag, undo/redo, media/settings, mobile, visitor gating, and publish UI. GitHub publishing is exercised via store/API tests; no test content was published to the real site. A temporary local published JSON file was verified through the actual Astro public route and removed.
