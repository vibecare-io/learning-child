# Learning Child / VibeCare Kids

YouTube's algorithm optimizes for watch time. Its thumbnails are dopamine honeypots,
and kids are the easiest prey. This project flips who controls the feed.

A Chrome extension (MV3) makes YouTube look and feel like normal YouTube - but every
recommendation is filled from a catalog **you** curate: science, music, space, maths,
exploration. The swap is invisible to the kid. The algorithm just... got better taste.

## What it does

- **Homepage & up-next**: fully replaced with your curated videos, styled like YouTube.
- **Topic chips**: YouTube's algorithmic chip bar (Podcasts, Gaming, Satire...) is
  replaced with chips for the topics actually in the feed (science, maths, space...).
- **Search**: real results, filtered to channels you approve.
- **Shorts**: gone. Redirects to the homepage.
- **Also neutralized**: comments, autoplay, end-screen suggestions, notification bell, Trending.
- **Feels alive**: the feed reshuffles daily per kid profile, so it never looks frozen.
- **Onboarding**: installing the extension opens a tab walking the parent through age
  profile, interests, and an optional daily screen-time limit; the toolbar icon also
  opens this flow (in a side panel) until it's finished. After that, the same icon
  opens a **settings side panel** instead.
- **Safety tier**: keyword/per-video blocking at curation time, plus a PIN-gated
  "Parent controls" panel for instant runtime changes. See below.

## How it works

```
catalog.yaml  ──(build via YouTube API: on push + daily cron)──▶  catalog.json  ──▶  extension
(you edit this)                                                  (static file)      (renders it)
```

No server. The "backend" is a couple of static JSON files: pushing a `catalog.yaml`
edit rebuilds and publishes them, and a daily cron keeps them fresh in between
(see "Hosting" below).

## Safety controls

Good channels still publish videos a kid shouldn't watch unsupervised (dangerous DIY,
explosions, fire, power tools). Two tiers, same keyword-matching logic
(`shared/safety.ts`) at both:

- **Curation time (`catalog.yaml`)** - authoritative and permanent:
  ```yaml
  safety:
    blocked_keywords: [exploding, explosion, firework]  # word-boundary match on title -> dropped
    exclude_videos: [XZ6j5-nBFyc]                       # surgical per-video removal

  sources:
    - channel: "@markrober"
      supervision: true   # kept, but tagged flags: ["supervision"] in catalog.json
  ```
  Keyword/exclude hits are **dropped** from the catalog and reported in the pipeline's
  build log for audit. `supervision: true` sources are **kept but tagged** - visible
  only when a parent turns on supervised mode.
- **Runtime (instant)** - click the toolbar icon -> Parent controls (PIN-gated, first
  visit sets the PIN): a supervised-mode toggle, an editable keyword blocklist, and a
  list of blocked video URLs/ids. Stored in `chrome.storage.local` alongside the rest of
  onboarding, applied as a filter over every rendered list before it hits the screen -
  no pipeline rebuild needed.

Honest limit: title keywords can't see inside the video. The per-channel safety
judgment behind `supervision:` plus `exclude_videos` is the real net; keywords are the
tripwire.

## Parent quick-start

1. **Fork/clone this repo.** Toolchain is [Bun](https://bun.sh) + `just`
   ([casey/just](https://github.com/casey/just)); run `just setup`.
2. **Edit `catalog-pipeline/catalog.yaml`** - add channels, playlists, or single
   videos, tag them with topics and kid profiles (the shipped catalog already has
   ~350 researched sources across a "little"/"big" age split). Push.
3. **One-time setup**: create a free YouTube Data API key
   ([console.cloud.google.com](https://console.cloud.google.com) -> enable "YouTube
   Data API v3" -> credentials -> API key). Put it in a repo-root `.env` as
   `YT_API_KEY=...` for local builds (auto-loaded by the Justfile), and as a secret for
   your host (see "Hosting" below).
4. **Install the extension**: `just bundle`, then `chrome://extensions` -> enable
   Developer mode -> **Load unpacked** -> `extension/dist`.
5. **First click on the toolbar icon** opens onboarding: pick the kid's age profile
   and a few interests. After that, the same icon opens the settings side panel,
   where you can point the extension at your catalog URL and set up Parent controls.
   One Chrome profile per kid works best.

The background service worker refreshes the catalog every 4 hours; until a catalog
URL is configured, the extension falls back to a tiny bundled `extension/seed-catalog.json`.

## Hosting

This repo's own catalog is built and served from **kids.vibecare.io** via Cloudflare
Pages, git-integrated: every push to `main` runs `scripts/deploy.sh` (installs deps,
builds the catalog, copies `catalog.json`/`allowed-channels.json` into `public/api`).
Set `YT_API_KEY` as a Cloudflare Pages environment variable. A separate daily
GitHub Action (`.github/workflows/catalog.yml`) also rebuilds the catalog on a cron,
so it stays fresh even with no pushes. Forking this for your own kid means either
standing up your own Cloudflare Pages project the same way, or pointing the settings
panel at any static host that serves those two JSON files.

## Commands (`just`)

```sh
just setup      # bun install
just test       # vitest - unit tests for pipeline + extension
just typecheck  # tsc --noEmit across workspaces
just bundle     # build the extension into extension/dist
just catalog    # build the catalog into catalog-pipeline/dist (needs YT_API_KEY)
just check      # test + typecheck + bundle - the pre-commit gate
just e2e        # Playwright canary against live youtube.com (one-time:
                # `bunx playwright install chromium`); flaky by nature, not a CI gate
```

## Honest limits

- If YouTube changes its page structure, the extension **fails open** - real YouTube
  shows and the toolbar icon gets a red `!` badge so you notice. Fix is usually a
  one-line selector update in `extension/src/selectors.ts`.
- A kid with admin rights can disable the extension. Real lockdown needs Chrome's
  supervised accounts / managed policies - future work.
- Safety filtering is keyword- and channel-judgment-based, not content analysis - see
  "Safety controls" above.
