# AGENTS.md

Guide for AI agents working in this repo.

## What this is

Chrome MV3 extension + static catalog pipeline that replaces YouTube's recommendations
with a parent-curated video catalog for kids, plus a two-tier safety layer. Spec:
`docs/superpowers/specs/2026-07-26-kids-youtube-curation-design.md` (see also the
"Safety controls" section added 2026-07-27).

## Map

- `shared/types.ts` - `Catalog`/`CatalogVideo`/`AllowedChannels`. THE contract between
  pipeline and extension (`CatalogVideo.flags` carries `"supervision"`). Change it only
  with both sides in the same commit.
- `shared/safety.ts` - `matchesBlockedKeyword(title, keywords)`, the single
  word-boundary keyword matcher used by both the pipeline (drop at build time) and the
  extension (filter at render time).
- `catalog-pipeline/` - `catalog.yaml` (parent-edited: profiles, sources, optional
  `safety.blocked_keywords` / `safety.exclude_videos`, per-source `supervision: true`)
  → `dist/catalog.json` + `dist/allowed-channels.json` via the YouTube Data API.
  `src/config.ts` parses/validates the yaml, `src/build.ts` is the entry (needs
  `YT_API_KEY`). Published on every push to `main` via Cloudflare Pages
  (`scripts/deploy.sh`) and, in parallel, daily by `.github/workflows/catalog.yml`.
- `extension/src/content.ts` - router; runs at `document_start`, injects hide-CSS
  pre-paint, re-dispatches on SPA navigation.
- `extension/src/adapters/{home,watch,search}.ts` - one per YouTube surface: `home.ts`
  swaps the grid and renders the topic-chip bar, `watch.ts` swaps the up-next sidebar,
  `search.ts` filters result items to approved channels (MutationObserver, since
  results stream in) and shows a curated empty-state when nothing survives.
- `extension/src/feed.ts` - pure, deterministic feed logic (seeded by date + profile);
  no `chrome.*`, easy to unit test.
- `extension/src/ui.ts` - tile/grid/chip-bar rendering. `extension/src/catalog.ts` -
  storage + seed-catalog fallback. `extension/src/background.ts` - 4-hourly catalog
  refresh, toolbar failure badge, and routes the side panel (onboarding vs settings).
- `extension/src/prefs.ts` - the one preferences store (`chrome.storage.local`, key
  `"prefs"`): onboarding state, profile, interests, screen-time limit, and
  `ParentControls` (`supervisedMode`, `blockedKeywords`, `blockedVideoIds`) plus
  `parentPin`. `extension/src/safety.ts` re-exports `ParentControls`/`DEFAULT_CONTROLS`
  from `prefs.ts` and adds `applySafety()` + `loadControls()` - the one place consumers
  should import safety types from.
- `extension/src/onboarding/` - onboarding flow (age profile, interests, screen-time),
  opened as a full tab on install and as the side panel's content until onboarding
  finishes. `extension/src/settings/` - side panel shown after onboarding: catalog
  source picker + the PIN-gated Parent controls section (`video-id.ts` extracts a
  video id from a pasted YouTube URL for the block list).
- `extension/src/selectors.ts` - every YouTube DOM selector, nothing else.

## Invariants - do not break

1. **Every YouTube DOM selector lives in `extension/src/selectors.ts`.** Never inline
   one in an adapter. Prefer broad, container-level selectors over deep, brittle ones.
2. **Fail open**: if an adapter throws, `content.ts` calls `reportFailure(surface)` -
   it unhides real YouTube and badges the toolbar icon red. Never leave a blank page.
3. Adapters re-run on the `yt-navigate-finish` SPA event. An adapter may return a
   cleanup function; `content.ts` calls the previous route's cleanup before running the
   next one, and a stale in-flight navigation's result is discarded (via a nav-token),
   never applied to the wrong page.
4. Injected element ids/classes are prefixed `lc-` (`lc-home`, `lc-chips`, `lc-upnext`,
   `lc-search-empty`, ...).
5. `feed.ts` (and its consumers `dailyFeed`/`upNext`) stay pure and deterministic -
   keep them testable without `chrome.*`.
6. **The safety filter (`applySafety`, in `extension/src/safety.ts`) is applied to
   every rendered list** - home grid, up-next, and search's empty-state suggestions -
   right before render, using `loadControls()`. A new surface that renders catalog
   videos must call it too, or supervision-flagged/blocked content leaks through.
7. `ParentControls` and its default live in `prefs.ts` (which owns the stored-prefs
   shape); `safety.ts` only re-exports them. Don't redefine the shape elsewhere.

## Commands

- `just setup` - `bun install`
- `just test` - all unit tests (vitest; DOM tests use `// @vitest-environment jsdom`)
- `just typecheck` - tsc over catalog-pipeline and extension
- `just bundle` - build the extension into `extension/dist`
- `YT_API_KEY=... just catalog` - build the catalog locally into `catalog-pipeline/dist`
- `just check` - test + typecheck + bundle; the pre-commit gate
- `just e2e` - Playwright canary against live youtube.com (one-time setup:
  `bunx playwright install chromium`); flaky by nature - a selector-drift alarm, not a
  CI gate

## When YouTube breaks the extension

Symptoms: red `!` badge on the toolbar icon, or real YouTube recommendations visible
where curated ones should be. Fix: find the drifted selector (adapter's `waitFor(...)`
timed out, or an element it expected is gone/renamed), update it in `selectors.ts`, run
`just e2e` to confirm live, done. Selectors are container-level on purpose - a broad,
slow-churn selector survives more YouTube redesigns than a deep, specific one.

## Companion work

`site/` is an Astro landing site (currently untracked in this checkout) for
kids.vibecare.io's marketing page - separate from the extension/pipeline; treat it as
its own project, not something to keep in sync with every extension change.
