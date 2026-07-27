# Learning Child - Kids YouTube Curation: Design

**Date:** 2026-07-26
**Status:** Approved

## The idea

YouTube's recommendation algorithm optimizes for watch time, and its thumbnails act as
dopamine honeypots for kids. This project flips who controls the feed: a Chrome extension
makes YouTube *look and feel* like normal YouTube, but every recommendation slot is filled
from a catalog curated by parents - science, music, exploration, math, space - content that
sparks curiosity instead of hijacking it. The swap is tactful: kids browse and watch as
usual, without knowing the algorithm has been replaced.

## Decisions made

| Question | Decision |
|---|---|
| Audience | Own family first; clean path to multi-family later |
| Surfaces | Homepage feed, watch-page sidebar/up-next, search, Shorts |
| Swap style | Full replace - YouTube's algorithm gets zero slots |
| Search behavior | Real results filtered to parent-approved channels |
| Kids | Mixed ages → per-kid profiles in the catalog |
| Backend | Static catalog pipeline (no server): YAML → cron → static JSON |
| v1 scope | YouTube only; per-site adapter layer keeps other sites possible later |
| Extra cleanups | Hide comments, disable autoplay, hide end-screen cards, hide bell/Trending |
| Swap technique | Hide YouTube's containers via `document_start` CSS, inject our own YouTube-styled UI |
| Docs | Simple, clear `README.md` and `AGENTS.md` are first-class deliverables |

## Architecture

Two independent pieces in one repo, both TypeScript:

```
learning-child/
├── README.md               # the why + parent quick-start (plain language)
├── AGENTS.md               # repo map + invariants for AI agents
├── catalog-pipeline/
│   ├── catalog.yaml        # the file parents edit
│   └── src/                # yaml → catalog.json expansion via YouTube Data API
└── extension/              # Chrome MV3 extension
    └── src/
        ├── selectors.ts    # ALL YouTube DOM selectors live here, nowhere else
        ├── catalog.ts      # fetch/cache/seed-fallback + feed logic
        ├── adapters/       # one module per surface: home, watch, search, shorts
        └── options/        # parent options page (profile picker, catalog URL)
```

**Flow:** parents edit `catalog.yaml` → GitHub Action (daily cron + on push) expands it via
the YouTube Data API → publishes `catalog.json` + `allowed-channels.json` to static hosting
(GitHub Pages or Cloudflare Pages) → extension service worker fetches and caches it →
content-script adapters render curated content on YouTube.

No server, no auth, no database. The "backend" is a cron job and a static file. A parent
edit to `catalog.yaml` goes live in about two minutes.

## Catalog pipeline

### Parent-facing config (`catalog.yaml`)

```yaml
profiles:
  little: { label: "Ages 3-7" }
  big:    { label: "Ages 8-12" }

sources:
  - channel: "@veritasium"
    topics: [science]
    profiles: [big]
  - playlist: "PLxxxxxxx"
    topics: [music]
    profiles: [little, big]
  - video: "abc123xyz"
    topics: [space]
    profiles: [big]

search_only_channels:        # allowed in search results, not pushed into feeds
  - "@some-channel"
```

### Expansion rules

- Channels expand to recent + top uploads, capped at 50 videos per channel by default
  (`max_videos` overridable per source). Playlists expand to all items.
- Guardrails: drop videos shorter than a configurable minimum length (default 120s -
  filters Shorts-style uploads), dedupe across sources (a video keeps the union of
  topics/profiles from all sources that include it).
- Dead (private/deleted) videos disappear naturally on the next daily run.

### Outputs

- `catalog.json` - `{ version, generatedAt, profiles, videos: [{ id, title, channel,
  channelId, durationSec, publishedAt, topics, profiles, thumbnail }] }`
- `allowed-channels.json` - every channel ID in the catalog plus `search_only_channels`.

YouTube Data API free quota (10k units/day) is far beyond what a daily run needs.

## Extension

Manifest V3. A shared catalog module plus one adapter per surface. YouTube is a SPA, so
adapters re-run on YouTube's `yt-navigate-finish` event, not just page load.

### Instant hide - the key trick

CSS injected at `document_start`, before YouTube paints, hides: the home recommendation
grid, watch-page sidebar, Shorts shelves and links, comments, end-screen suggestion cards,
the notification bell, and Trending/Explore navigation. Forbidden thumbnails never render -
not even a flash. During load the kid sees a normal-looking skeleton.

### Surfaces

- **Homepage:** inject our own grid styled to match YouTube tiles (thumbnail from
  `i.ytimg.com`, title, channel name, duration badge), filled from the active profile's
  feed. Tiles link to real watch pages.
- **Watch page:** inject our own up-next list (~15 videos) into the sidebar slot, biased
  toward the current video's topics when the video is in the catalog, mixed otherwise.
  Force the autoplay toggle off.
- **Search:** keep YouTube's real results but remove any result whose channel is not in
  `allowed-channels.json`, and all Shorts results. If zero results survive, show a
  friendly "nothing here - try these instead" panel with curated suggestions.
- **Shorts:** any navigation to `/shorts/*` redirects to the homepage.

### Feeling alive (mixed-age kids must not notice)

- **Daily seeded shuffle:** feed order seeded by `date + profile` - different every day,
  stable within a day. Both a frozen feed and a wildly reshuffling one look suspicious.
- **Freshness mix:** each day front-loads a rotating subset of the catalog; videos newly
  added to the catalog get a temporary boost.
- **Profiles:** the options page selects the active kid profile per Chrome profile
  (natural setup: one Chrome profile per kid). Stored in `chrome.storage.sync`.

### Catalog freshness

Service worker refreshes the catalog every few hours via `chrome.alarms`, caching in
`chrome.storage.local`.

## Safety controls (added 2026-07-27)

Good channels still publish videos kids shouldn't watch unsupervised (dangerous DIY,
explosions, fire, power tools). Two-tier filtering, same semantics at both tiers:

**Tier 1 - curation time (authoritative).** `catalog.yaml` gains:

```yaml
safety:
  blocked_keywords: [exploding, explosion, firework]   # word-boundary match on title -> dropped
  exclude_videos: [XZ6j5-nBFyc]                        # surgical per-video removal

sources:
  - channel: "@markrober"
    supervision: true          # kept but tagged flags: ["supervision"] in catalog.json
```

Keyword/exclude hits are DROPPED from the catalog and reported in the build log for
audit. `supervision: true` videos are KEPT and tagged - hidden at runtime unless a
parent enables supervised mode (decision: tag-and-hide, not drop - preserves
co-watching content). Dedupe rule: if any source marks a video supervised, the flag
sticks. `CatalogVideo` gains optional `flags?: string[]`.

**Tier 2 - runtime (instant).** A PIN-gated Parent Controls **side panel**
(`chrome.sidePanel`) with: supervised-mode toggle; parent-editable keyword blocklist;
per-video block list (paste a YouTube URL). Stored in the prefs store
(`chrome.storage.local`, key "prefs" - as built), applied
as a pure filter (`applySafety`) over feed/up-next/search suggestions before render.
Runtime rules act within seconds; promoting them into `catalog.yaml` makes them
permanent. Keyword matching lives in `shared/safety.ts`, used by both tiers.

Honest limit: title keywords can't see inside the video. The research data's per-channel
safety assessment (solo-safe / supervision / mixed) plus `exclude_videos` is the real
net; keywords are the tripwire.

## Failure handling & honest limits

- **Catalog fetch fails:** serve the last cached catalog; a small seed catalog is bundled
  in the extension as final fallback. Kids never see an empty page.
- **YouTube DOM changes:** hide-selectors are broad container-level selectors that change
  rarely; every selector lives in `selectors.ts`. If an adapter fails to inject, the
  extension shows a badge on its toolbar icon so a parent notices. Failure **fails open**
  (real YouTube shows) - a known, documented limitation, never a silent one.
- **Kid disables/removes the extension:** out of scope for v1. Chrome extensions cannot
  protect themselves; real lockdown requires Chrome managed/supervised-account policies.
  Documented in the README as a future step.

## Testing

- **Pipeline:** unit tests for yaml → catalog expansion with a mocked YouTube API
  (dedupe, short-video filtering, profile/topic tagging, search-only channels).
- **Extension:** unit tests for feed logic (seeded shuffle determinism, freshness mix,
  profile filtering). Playwright smoke tests load the unpacked extension against live
  YouTube: home grid swapped, sidebar swapped, search filtered, Shorts redirected,
  comments hidden. Live-YouTube tests are a canary, not a CI gate.

## Docs deliverables

- **`README.md`** - plain-language: the why (thumbnails as dopamine honeypots; parents
  reclaiming the algorithm), what it does, parent quick-start (edit `catalog.yaml`,
  one-time YouTube API key setup, install the extension, pick a profile). Short.
- **`AGENTS.md`** - repo map, key invariants (all selectors in `selectors.ts`; fail-open
  + badge on breakage; catalog schema; adapters re-run on `yt-navigate-finish`), how to
  run tests and a local pipeline build. Short.

## Future (explicitly not v1)

Multi-family backend with auth, YouTube Kids and other video sites (via new adapters),
kid-proof lockdown via managed Chrome policies, a friendlier curation UI than YAML,
watch-history reporting for parents.

**Parent safety & control:** curation controls *what* a kid sees but not *how much*, *how*,
or *right now*. Two roadmap capabilities — (1) **anti-addiction guardrails** (daily time
budgets, session "stretch break" caps, allowed-hours windows, a local-first parent watch
report, fixation nudges) and (2) **remote intervention** (parent, seeing/hearing a kid
watch junk, pushes good content to the kid's device live from their own phone via a
parent→child command channel). Both, and the honest privacy line between local behavior
data and the parent command channel, are specced in
[`specs/2026-07-27-parent-safety-guardrails.md`](2026-07-27-parent-safety-guardrails.md).
