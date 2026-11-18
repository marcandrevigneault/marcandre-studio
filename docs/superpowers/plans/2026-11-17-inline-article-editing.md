# Inline article editing

Goal: Grey unfinished sections and let the owner edit article text directly on its page, with double-click or an accessible button.

Approach: Retain Astro/Vercel and existing owner session. Keep original MDX untouched; persist per-language Markdown article overrides in GitHub, rendered safely on the next build. The editor loads the latest committed override and uses its SHA for optimistic concurrency. Only authenticated same-origin API requests may preview/save. Failed saves and conflicts retain the draft.

- [x] Grey Photography, Art, Science and existing upcoming sections; suppress example gallery promotion.
- [x] Test and implement Markdown validation, safe rendering, allowlisted paths and SHA-based GitHub persistence.
- [x] Integrate override rendering and owner-only inline form with title, summary, subtitle and Markdown body; preview, cancel, publish and unsaved-change handling.
- [x] Preserve login return path and language; verify unauthorized writes, conflicts, successful writes, preview, mobile and build.
- [ ] Deploy through existing Vercel project and verify public page and auth boundaries.

Review focus: malicious markup in preview, path traversal, stale SHA conflicts, failed publishing with preserved text, FR/EN separation and login redirect safety.

Validation: 58 tests pass; full build passes. Browser verification covered auth return, protected endpoints, actual GitHub reads, Markdown/math preview, stale-write UI, mocked publish response, double click, FR/EN and 320px layout. Live publishing write requires the owner’s production session; no test prose was published.
