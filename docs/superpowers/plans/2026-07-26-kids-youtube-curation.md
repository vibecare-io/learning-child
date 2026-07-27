# Kids YouTube Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Chrome MV3 extension that replaces YouTube's recommendations with a parent-curated catalog, plus a no-server pipeline that builds that catalog from a simple YAML file.

**Architecture:** Two npm workspaces in one repo. `catalog-pipeline` expands `catalog.yaml` (channels/playlists/videos tagged by topic + kid profile) into static `catalog.json` + `allowed-channels.json` via the YouTube Data API, published by a GitHub Action. `extension` hides YouTube's recommendation containers via CSS injected at `document_start` and renders its own YouTube-styled tiles from the catalog; search is filtered to approved channels; Shorts redirect home.

**Tech Stack:** TypeScript, npm workspaces, vitest (+jsdom for DOM tests), esbuild (extension bundling), tsx (pipeline runner), `yaml`, YouTube Data API v3, Playwright (manual smoke canary), GitHub Actions + GitHub Pages.

## Global Constraints

- Node >= 20 (built-in `fetch`). TypeScript strict mode everywhere.
- Spec: `docs/superpowers/specs/2026-07-26-kids-youtube-curation-design.md`.
- ALL YouTube DOM selectors live in `extension/src/selectors.ts` - never inline a selector in an adapter.
- Failure fails OPEN: if an adapter can't inject, remove the hide-style and set a badge - never leave the kid on an empty page.
- Extension surfaces re-run on YouTube's `yt-navigate-finish` SPA event, not just page load.
- Injected element ids are prefixed `lc-` (lc-home-grid, lc-upnext, lc-search-empty, lc-hide, lc-ui-css).
- Catalog schema types live ONLY in `shared/types.ts`; both workspaces import them by relative path (type-only imports).
- Pipeline defaults: 50 videos max per channel source, 120s minimum duration, video keeps the union of topics/profiles when multiple sources include it.
- Commit after every task with a conventional-commit message ending in the Claude co-author trailer.

---

### Task 1: Repo scaffolding + shared catalog types

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`
- Create: `shared/types.ts`
- Create: `catalog-pipeline/package.json`, `catalog-pipeline/tsconfig.json`
- Create: `extension/package.json`, `extension/tsconfig.json`
- Test: `shared/types.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `Catalog`, `CatalogVideo`, `AllowedChannels` types every later task imports from `shared/types.ts`; working `npm test` / `npm run build` workspace commands.

- [ ] **Step 1: Write root config files**

`package.json`:
```json
{
  "name": "learning-child",
  "private": true,
  "workspaces": ["catalog-pipeline", "extension"],
  "scripts": {
    "test": "vitest run",
    "build": "npm run build -ws --if-present",
    "typecheck": "tsc -p catalog-pipeline --noEmit && tsc -p extension --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^3.0.0",
    "jsdom": "^25.0.0",
    "@types/node": "^20.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
```

`catalog-pipeline/package.json`:
```json
{
  "name": "catalog-pipeline",
  "private": true,
  "type": "module",
  "scripts": { "build": "tsx src/build.ts" },
  "dependencies": { "yaml": "^2.5.0" },
  "devDependencies": { "tsx": "^4.19.0" }
}
```

`catalog-pipeline/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src", "../shared"] }
```

`extension/package.json`:
```json
{
  "name": "extension",
  "private": true,
  "type": "module",
  "scripts": { "build": "node build.mjs" },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "@types/chrome": "^0.0.280"
  }
}
```

`extension/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["chrome"] },
  "include": ["src", "../shared"]
}
```

- [ ] **Step 2: Write the failing smoke test**

`shared/types.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Catalog } from "./types";

describe("shared types", () => {
  it("catalog shape compiles and is usable", () => {
    const catalog: Catalog = {
      version: 1,
      generatedAt: "2026-07-26T00:00:00Z",
      profiles: { little: { label: "Ages 3-7" } },
      videos: [
        {
          id: "abc123xyz00",
          title: "How stars are born",
          channel: "Space Kids",
          channelId: "UC0000000000000000000000",
          durationSec: 300,
          publishedAt: "2026-07-01T00:00:00Z",
          topics: ["space"],
          profiles: ["little"],
          thumbnail: "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg"
        }
      ]
    };
    expect(catalog.videos[0].topics).toContain("space");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm install && npm test`
Expected: FAIL - `Cannot find module './types'`

- [ ] **Step 4: Write `shared/types.ts`**

```ts
export interface CatalogVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  durationSec: number;
  publishedAt: string;
  topics: string[];
  profiles: string[];
  thumbnail: string;
}

export interface Catalog {
  version: 1;
  generatedAt: string;
  profiles: Record<string, { label: string }>;
  videos: CatalogVideo[];
}

export interface AllowedChannels {
  channelIds: string[];
  /** lowercase, including the leading "@" */
  handles: string[];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold workspaces and shared catalog types"
```

---

### Task 2: Pipeline - parse and validate `catalog.yaml`

**Files:**
- Create: `catalog-pipeline/src/config.ts`
- Test: `catalog-pipeline/src/config.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Source = { kind: "channel" | "playlist" | "video"; ref: string; topics: string[]; profiles: string[]; maxVideos: number }`
  - `interface Config { profiles: Record<string, { label: string }>; sources: Source[]; searchOnlyChannels: string[]; minDurationSec: number }`
  - `parseConfig(yamlText: string): Config` - throws `Error` with a human-readable message on invalid config.

- [ ] **Step 1: Write the failing tests**

`catalog-pipeline/src/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const VALID = `
profiles:
  little: { label: "Ages 3-7" }
  big:    { label: "Ages 8-12" }
sources:
  - channel: "@veritasium"
    topics: [science]
    profiles: [big]
  - playlist: "PLtest123"
    topics: [music]
  - video: "abc123xyz00"
    topics: [space]
    profiles: [big]
    max_videos: 1
search_only_channels:
  - "@scishowkids"
`;

describe("parseConfig", () => {
  it("parses sources with kind, defaults and profile fallback", () => {
    const config = parseConfig(VALID);
    expect(config.sources).toHaveLength(3);
    expect(config.sources[0]).toEqual({
      kind: "channel", ref: "@veritasium", topics: ["science"],
      profiles: ["big"], maxVideos: 50
    });
    // profiles omitted -> all profiles
    expect(config.sources[1].profiles).toEqual(["little", "big"]);
    expect(config.sources[2].maxVideos).toBe(1);
    expect(config.searchOnlyChannels).toEqual(["@scishowkids"]);
    expect(config.minDurationSec).toBe(120);
  });

  it("rejects a source with no channel/playlist/video key", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources:
  - topics: [science]
`)).toThrow(/exactly one of/i);
  });

  it("rejects unknown profile references", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources:
  - channel: "@a"
    profiles: [teenager]
`)).toThrow(/unknown profile/i);
  });

  it("rejects missing profiles section", () => {
    expect(() => parseConfig(`sources: []`)).toThrow(/profiles/i);
  });

  it("allows overriding min_duration_sec", () => {
    const config = parseConfig(`
profiles: { little: { label: "x" } }
min_duration_sec: 60
sources: []
`);
    expect(config.minDurationSec).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './config'`

- [ ] **Step 3: Implement `catalog-pipeline/src/config.ts`**

```ts
import { parse } from "yaml";

export interface Source {
  kind: "channel" | "playlist" | "video";
  ref: string;
  topics: string[];
  profiles: string[];
  maxVideos: number;
}

export interface Config {
  profiles: Record<string, { label: string }>;
  sources: Source[];
  searchOnlyChannels: string[];
  minDurationSec: number;
}

const DEFAULT_MAX_VIDEOS = 50;
const DEFAULT_MIN_DURATION_SEC = 120;

export function parseConfig(yamlText: string): Config {
  const raw = parse(yamlText) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") throw new Error("catalog.yaml is empty or not a mapping");

  const profilesRaw = raw.profiles as Record<string, { label?: string }> | undefined;
  if (!profilesRaw || Object.keys(profilesRaw).length === 0) {
    throw new Error("catalog.yaml must define at least one entry under 'profiles'");
  }
  const profiles: Record<string, { label: string }> = {};
  for (const [id, p] of Object.entries(profilesRaw)) {
    profiles[id] = { label: p?.label ?? id };
  }
  const allProfiles = Object.keys(profiles);

  const sourcesRaw = (raw.sources ?? []) as Record<string, unknown>[];
  const sources: Source[] = sourcesRaw.map((s, i) => {
    const kinds = (["channel", "playlist", "video"] as const).filter((k) => s[k] != null);
    if (kinds.length !== 1) {
      throw new Error(`sources[${i}]: must have exactly one of channel/playlist/video`);
    }
    const kind = kinds[0];
    const sourceProfiles = (s.profiles as string[] | undefined) ?? allProfiles;
    for (const p of sourceProfiles) {
      if (!profiles[p]) throw new Error(`sources[${i}]: unknown profile '${p}'`);
    }
    return {
      kind,
      ref: String(s[kind]),
      topics: (s.topics as string[] | undefined) ?? [],
      profiles: sourceProfiles,
      maxVideos: (s.max_videos as number | undefined) ?? DEFAULT_MAX_VIDEOS,
    };
  });

  return {
    profiles,
    sources,
    searchOnlyChannels: (raw.search_only_channels as string[] | undefined) ?? [],
    minDurationSec: (raw.min_duration_sec as number | undefined) ?? DEFAULT_MIN_DURATION_SEC,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (config tests + smoke test)

- [ ] **Step 5: Commit**

```bash
git add catalog-pipeline/src/config.ts catalog-pipeline/src/config.test.ts
git commit -m "feat(pipeline): parse and validate catalog.yaml"
```

---

### Task 3: Pipeline - expand sources into the catalog (pure logic)

**Files:**
- Create: `catalog-pipeline/src/expand.ts`
- Test: `catalog-pipeline/src/expand.test.ts`

**Interfaces:**
- Consumes: `Config`, `Source` from `./config`; `Catalog`, `CatalogVideo`, `AllowedChannels` from `../../shared/types`
- Produces:
  - `interface VideoData { id: string; title: string; channelTitle: string; channelId: string; durationSec: number; publishedAt: string }` (what the API client returns per video)
  - `interface FetchedSource { source: Source; videos: VideoData[] }`
  - `expandCatalog(config: Config, fetched: FetchedSource[], generatedAt: string): Catalog`
  - `buildAllowed(catalog: Catalog, resolved: { channelId: string; handle?: string }[]): AllowedChannels`

- [ ] **Step 1: Write the failing tests**

`catalog-pipeline/src/expand.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { expandCatalog, buildAllowed, type FetchedSource, type VideoData } from "./expand";
import type { Config, Source } from "./config";

const config: Config = {
  profiles: { little: { label: "Ages 3-7" }, big: { label: "Ages 8-12" } },
  sources: [],
  searchOnlyChannels: [],
  minDurationSec: 120,
};

function video(over: Partial<VideoData>): VideoData {
  return {
    id: "v1", title: "T", channelTitle: "Chan", channelId: "UC1",
    durationSec: 300, publishedAt: "2026-07-01T00:00:00Z", ...over,
  };
}

function source(over: Partial<Source>): Source {
  return { kind: "channel", ref: "@c", topics: [], profiles: ["big"], maxVideos: 50, ...over };
}

describe("expandCatalog", () => {
  it("tags videos with source topics/profiles and builds thumbnails", () => {
    const fetched: FetchedSource[] = [
      { source: source({ topics: ["science"] }), videos: [video({ id: "aaa" })] },
    ];
    const catalog = expandCatalog(config, fetched, "2026-07-26T00:00:00Z");
    expect(catalog.version).toBe(1);
    expect(catalog.videos).toHaveLength(1);
    expect(catalog.videos[0]).toMatchObject({
      id: "aaa", topics: ["science"], profiles: ["big"],
      thumbnail: "https://i.ytimg.com/vi/aaa/hqdefault.jpg",
    });
  });

  it("drops videos shorter than minDurationSec", () => {
    const fetched: FetchedSource[] = [
      { source: source({}), videos: [video({ id: "short1", durationSec: 45 }), video({ id: "ok1" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos.map((v) => v.id)).toEqual(["ok1"]);
  });

  it("caps videos per source at maxVideos", () => {
    const vids = Array.from({ length: 5 }, (_, i) => video({ id: `v${i}` }));
    const fetched: FetchedSource[] = [{ source: source({ maxVideos: 3 }), videos: vids }];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos).toHaveLength(3);
  });

  it("dedupes across sources keeping the union of topics and profiles", () => {
    const fetched: FetchedSource[] = [
      { source: source({ topics: ["science"], profiles: ["big"] }), videos: [video({ id: "dup" })] },
      { source: source({ kind: "playlist", topics: ["space"], profiles: ["little"] }), videos: [video({ id: "dup" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos).toHaveLength(1);
    expect(catalog.videos[0].topics.sort()).toEqual(["science", "space"]);
    expect(catalog.videos[0].profiles.sort()).toEqual(["big", "little"]);
  });
});

describe("buildAllowed", () => {
  it("collects channel ids from catalog plus resolved extras, handles lowercased", () => {
    const fetched: FetchedSource[] = [
      { source: source({}), videos: [video({ id: "a", channelId: "UC1" }), video({ id: "b", channelId: "UC2" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    const allowed = buildAllowed(catalog, [
      { channelId: "UC1", handle: "@Veritasium" },
      { channelId: "UC9", handle: "@SciShowKids" },
    ]);
    expect(allowed.channelIds.sort()).toEqual(["UC1", "UC2", "UC9"]);
    expect(allowed.handles.sort()).toEqual(["@scishowkids", "@veritasium"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './expand'`

- [ ] **Step 3: Implement `catalog-pipeline/src/expand.ts`**

```ts
import type { Config, Source } from "./config";
import type { AllowedChannels, Catalog, CatalogVideo } from "../../shared/types";

export interface VideoData {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  durationSec: number;
  publishedAt: string;
}

export interface FetchedSource {
  source: Source;
  videos: VideoData[];
}

export function expandCatalog(config: Config, fetched: FetchedSource[], generatedAt: string): Catalog {
  const byId = new Map<string, CatalogVideo>();
  for (const { source, videos } of fetched) {
    const kept = videos
      .filter((v) => v.durationSec >= config.minDurationSec)
      .slice(0, source.maxVideos);
    for (const v of kept) {
      const existing = byId.get(v.id);
      if (existing) {
        existing.topics = [...new Set([...existing.topics, ...source.topics])];
        existing.profiles = [...new Set([...existing.profiles, ...source.profiles])];
        continue;
      }
      byId.set(v.id, {
        id: v.id,
        title: v.title,
        channel: v.channelTitle,
        channelId: v.channelId,
        durationSec: v.durationSec,
        publishedAt: v.publishedAt,
        topics: [...source.topics],
        profiles: [...source.profiles],
        thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      });
    }
  }
  return { version: 1, generatedAt, profiles: config.profiles, videos: [...byId.values()] };
}

export function buildAllowed(
  catalog: Catalog,
  resolved: { channelId: string; handle?: string }[],
): AllowedChannels {
  const channelIds = new Set(catalog.videos.map((v) => v.channelId));
  const handles = new Set<string>();
  for (const r of resolved) {
    channelIds.add(r.channelId);
    if (r.handle) handles.add(r.handle.toLowerCase());
  }
  return { channelIds: [...channelIds], handles: [...handles] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add catalog-pipeline/src/expand.ts catalog-pipeline/src/expand.test.ts
git commit -m "feat(pipeline): expand sources into catalog with dedupe and guardrails"
```

---

### Task 4: Pipeline - YouTube Data API client

**Files:**
- Create: `catalog-pipeline/src/youtube-api.ts`
- Test: `catalog-pipeline/src/youtube-api.test.ts`

**Interfaces:**
- Consumes: `VideoData` from `./expand`
- Produces:
  - `interface ResolvedChannel { channelId: string; uploadsPlaylistId: string; handle?: string }`
  - `interface YouTubeClient { resolveChannel(ref: string): Promise<ResolvedChannel>; listPlaylistVideoIds(playlistId: string, max: number): Promise<string[]>; getVideos(ids: string[]): Promise<VideoData[]> }`
  - `class YouTubeApiClient implements YouTubeClient` - constructor takes `apiKey: string`
  - `parseIsoDuration(iso: string): number` (seconds)

- [ ] **Step 1: Write the failing tests**

`catalog-pipeline/src/youtube-api.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIsoDuration, YouTubeApiClient } from "./youtube-api";

describe("parseIsoDuration", () => {
  it("parses hours/minutes/seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT12M")).toBe(720);
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
    expect(parseIsoDuration("garbage")).toBe(0);
  });
});

function mockJsonFetch(payloads: unknown[]) {
  let call = 0;
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => payloads[call++],
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("YouTubeApiClient", () => {
  it("resolveChannel uses forHandle for @refs and id for UC refs", async () => {
    const fetchMock = mockJsonFetch([
      {
        items: [{
          id: "UCabc",
          snippet: { customUrl: "@veritasium" },
          contentDetails: { relatedPlaylists: { uploads: "UUabc" } },
        }],
      },
    ]);
    const client = new YouTubeApiClient("KEY");
    const ch = await client.resolveChannel("@veritasium");
    expect(ch).toEqual({ channelId: "UCabc", uploadsPlaylistId: "UUabc", handle: "@veritasium" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("forHandle=%40veritasium");
  });

  it("listPlaylistVideoIds follows pages until max", async () => {
    mockJsonFetch([
      { items: [{ contentDetails: { videoId: "a" } }, { contentDetails: { videoId: "b" } }], nextPageToken: "T" },
      { items: [{ contentDetails: { videoId: "c" } }] },
    ]);
    const client = new YouTubeApiClient("KEY");
    expect(await client.listPlaylistVideoIds("UUabc", 10)).toEqual(["a", "b", "c"]);
  });

  it("getVideos maps snippet + contentDetails to VideoData", async () => {
    mockJsonFetch([
      {
        items: [{
          id: "vid1",
          snippet: {
            title: "Stars", channelTitle: "Space", channelId: "UC9",
            publishedAt: "2026-01-01T00:00:00Z",
          },
          contentDetails: { duration: "PT10M" },
        }],
      },
    ]);
    const client = new YouTubeApiClient("KEY");
    expect(await client.getVideos(["vid1"])).toEqual([{
      id: "vid1", title: "Stars", channelTitle: "Space", channelId: "UC9",
      durationSec: 600, publishedAt: "2026-01-01T00:00:00Z",
    }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './youtube-api'`

- [ ] **Step 3: Implement `catalog-pipeline/src/youtube-api.ts`**

```ts
import type { VideoData } from "./expand";

const API = "https://www.googleapis.com/youtube/v3";

export interface ResolvedChannel {
  channelId: string;
  uploadsPlaylistId: string;
  handle?: string;
}

export interface YouTubeClient {
  resolveChannel(ref: string): Promise<ResolvedChannel>;
  listPlaylistVideoIds(playlistId: string, max: number): Promise<string[]>;
  getVideos(ids: string[]): Promise<VideoData[]>;
}

export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => (x ? parseInt(x, 10) : 0)) as unknown as number[];
  return d * 86400 + h * 3600 + min * 60 + s;
}

export class YouTubeApiClient implements YouTubeClient {
  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${API}/${path}`);
    for (const [k, v] of Object.entries({ ...params, key: this.apiKey })) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${path} failed: ${res.status ?? "network error"}`);
    return res.json();
  }

  async resolveChannel(ref: string): Promise<ResolvedChannel> {
    const params: Record<string, string> = { part: "snippet,contentDetails" };
    if (ref.startsWith("@")) params.forHandle = ref;
    else params.id = ref;
    const data = await this.get("channels", params);
    const item = data.items?.[0];
    if (!item) throw new Error(`Channel not found: ${ref}`);
    return {
      channelId: item.id,
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      handle: item.snippet?.customUrl,
    };
  }

  async listPlaylistVideoIds(playlistId: string, max: number): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < max) {
      const data = await this.get("playlistItems", {
        part: "contentDetails",
        playlistId,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const item of data.items ?? []) ids.push(item.contentDetails.videoId);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return ids.slice(0, max);
  }

  async getVideos(ids: string[]): Promise<VideoData[]> {
    const out: VideoData[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const data = await this.get("videos", {
        part: "snippet,contentDetails",
        id: chunk.join(","),
      });
      for (const item of data.items ?? []) {
        out.push({
          id: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          durationSec: parseIsoDuration(item.contentDetails.duration),
          publishedAt: item.snippet.publishedAt,
        });
      }
    }
    return out;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add catalog-pipeline/src/youtube-api.ts catalog-pipeline/src/youtube-api.test.ts
git commit -m "feat(pipeline): YouTube Data API client"
```

---

### Task 5: Pipeline - build entrypoint + starter `catalog.yaml`

**Files:**
- Create: `catalog-pipeline/src/build.ts`
- Create: `catalog-pipeline/catalog.yaml`
- Test: `catalog-pipeline/src/build.test.ts`

**Interfaces:**
- Consumes: `parseConfig` (Task 2), `expandCatalog`/`buildAllowed`/`FetchedSource` (Task 3), `YouTubeClient`/`ResolvedChannel` (Task 4)
- Produces:
  - `runBuild(config: Config, client: YouTubeClient, now: string): Promise<{ catalog: Catalog; allowed: AllowedChannels }>` - all fetching/assembly, no filesystem
  - CLI behavior: `YT_API_KEY=... npm run build -w catalog-pipeline` reads `catalog.yaml`, writes `catalog-pipeline/dist/catalog.json` and `catalog-pipeline/dist/allowed-channels.json`

- [ ] **Step 1: Write the failing test**

`catalog-pipeline/src/build.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { runBuild } from "./build";
import { parseConfig } from "./config";
import type { ResolvedChannel, YouTubeClient } from "./youtube-api";
import type { VideoData } from "./expand";

const fakeVideos: Record<string, VideoData> = {
  s1: { id: "s1", title: "Science 1", channelTitle: "Veritasium", channelId: "UCver", durationSec: 600, publishedAt: "2026-06-01T00:00:00Z" },
  m1: { id: "m1", title: "Music 1", channelTitle: "MusicKids", channelId: "UCmus", durationSec: 240, publishedAt: "2026-05-01T00:00:00Z" },
  one: { id: "one", title: "One-off", channelTitle: "Solo", channelId: "UCsol", durationSec: 400, publishedAt: "2026-04-01T00:00:00Z" },
};

const fakeClient: YouTubeClient = {
  async resolveChannel(ref: string): Promise<ResolvedChannel> {
    if (ref === "@veritasium") return { channelId: "UCver", uploadsPlaylistId: "UUver", handle: "@veritasium" };
    if (ref === "@scishowkids") return { channelId: "UCsci", uploadsPlaylistId: "UUsci", handle: "@SciShowKids" };
    throw new Error(`unexpected ref ${ref}`);
  },
  async listPlaylistVideoIds(playlistId: string): Promise<string[]> {
    if (playlistId === "UUver") return ["s1"];
    if (playlistId === "PLmusic") return ["m1"];
    throw new Error(`unexpected playlist ${playlistId}`);
  },
  async getVideos(ids: string[]): Promise<VideoData[]> {
    return ids.map((id) => fakeVideos[id]).filter(Boolean);
  },
};

describe("runBuild", () => {
  it("assembles catalog and allowed channels from all source kinds", async () => {
    const config = parseConfig(`
profiles:
  big: { label: "Ages 8-12" }
sources:
  - channel: "@veritasium"
    topics: [science]
  - playlist: "PLmusic"
    topics: [music]
  - video: "one"
    topics: [space]
search_only_channels:
  - "@scishowkids"
`);
    const { catalog, allowed } = await runBuild(config, fakeClient, "2026-07-26T00:00:00Z");
    expect(catalog.videos.map((v) => v.id).sort()).toEqual(["m1", "one", "s1"]);
    expect(catalog.generatedAt).toBe("2026-07-26T00:00:00Z");
    expect(allowed.channelIds.sort()).toEqual(["UCmus", "UCsci", "UCsol", "UCver"]);
    expect(allowed.handles.sort()).toEqual(["@scishowkids", "@veritasium"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - `Cannot find module './build'`

- [ ] **Step 3: Implement `catalog-pipeline/src/build.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConfig, type Config } from "./config";
import { buildAllowed, expandCatalog, type FetchedSource } from "./expand";
import { YouTubeApiClient, type ResolvedChannel, type YouTubeClient } from "./youtube-api";
import type { AllowedChannels, Catalog } from "../../shared/types";

export async function runBuild(
  config: Config,
  client: YouTubeClient,
  now: string,
): Promise<{ catalog: Catalog; allowed: AllowedChannels }> {
  const fetched: FetchedSource[] = [];
  const resolved: ResolvedChannel[] = [];

  for (const source of config.sources) {
    if (source.kind === "channel") {
      const ch = await client.resolveChannel(source.ref);
      resolved.push(ch);
      const ids = await client.listPlaylistVideoIds(ch.uploadsPlaylistId, source.maxVideos);
      fetched.push({ source, videos: await client.getVideos(ids) });
    } else if (source.kind === "playlist") {
      const ids = await client.listPlaylistVideoIds(source.ref, source.maxVideos);
      fetched.push({ source, videos: await client.getVideos(ids) });
    } else {
      fetched.push({ source, videos: await client.getVideos([source.ref]) });
    }
  }

  for (const ref of config.searchOnlyChannels) {
    resolved.push(await client.resolveChannel(ref));
  }

  const catalog = expandCatalog(config, fetched, now);
  return { catalog, allowed: buildAllowed(catalog, resolved) };
}

async function main() {
  const apiKey = process.env.YT_API_KEY;
  if (!apiKey) throw new Error("Set YT_API_KEY environment variable");
  const root = dirname(fileURLToPath(import.meta.url));
  const config = parseConfig(readFileSync(join(root, "..", "catalog.yaml"), "utf8"));
  const { catalog, allowed } = await runBuild(config, new YouTubeApiClient(apiKey), new Date().toISOString());
  const dist = join(root, "..", "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "catalog.json"), JSON.stringify(catalog, null, 2));
  writeFileSync(join(dist, "allowed-channels.json"), JSON.stringify(allowed, null, 2));
  console.log(`Wrote ${catalog.videos.length} videos across ${new Set(catalog.videos.map((v) => v.channelId)).size} channels`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Write starter `catalog-pipeline/catalog.yaml`**

```yaml
# Learning Child - parent-curated video sources.
# Edit this file, push, and the catalog rebuilds automatically.
# Docs: see README.md at the repo root.

profiles:
  little: { label: "Ages 3-7" }
  big:    { label: "Ages 8-12" }

# min_duration_sec: 120   # uncomment to change the Shorts-style filter

sources:
  - channel: "@veritasium"
    topics: [science]
    profiles: [big]
  - channel: "@kurzgesagt"
    topics: [science, space]
    profiles: [big]
  - channel: "@SciShowKids"
    topics: [science]
    profiles: [little]

search_only_channels: []
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: (Optional, needs a real key) Live smoke run**

Run: `YT_API_KEY=<key> npm run build -w catalog-pipeline`
Expected: `Wrote N videos across 3 channels`, files exist in `catalog-pipeline/dist/`. Skip if no key available; the GitHub Action (Task 6) is the real runner.

- [ ] **Step 7: Commit**

```bash
git add catalog-pipeline/src/build.ts catalog-pipeline/src/build.test.ts catalog-pipeline/catalog.yaml
git commit -m "feat(pipeline): build CLI and starter catalog.yaml"
```

---

### Task 6: GitHub Action - scheduled catalog publish

**Files:**
- Create: `.github/workflows/catalog.yml`

**Interfaces:**
- Consumes: `npm run build -w catalog-pipeline` (Task 5), repo secret `YT_API_KEY`
- Produces: `catalog.json` + `allowed-channels.json` served at `https://<user>.github.io/learning-child/` (the URL parents paste into the extension options page, Task 14)

- [ ] **Step 1: Write `.github/workflows/catalog.yml`**

```yaml
name: Build and publish catalog

on:
  schedule:
    - cron: "0 9 * * *"   # daily
  push:
    branches: [main]
    paths: ["catalog-pipeline/**", "shared/**"]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build -w catalog-pipeline
        env:
          YT_API_KEY: ${{ secrets.YT_API_KEY }}
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: catalog-pipeline/dist
```

- [ ] **Step 2: Verify YAML parses**

Run: `npx yaml < .github/workflows/catalog.yml > /dev/null && echo OK` (or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/catalog.yml'))" && echo OK`)
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/catalog.yml
git commit -m "ci: daily catalog build published to GitHub Pages"
```

Note for the human: after pushing to GitHub - add the `YT_API_KEY` repo secret (YouTube Data API v3 key from Google Cloud Console) and enable Pages from the `gh-pages` branch. Documented in README (Task 16).

---

### Task 7: Extension - scaffold, manifest, selectors, instant-hide

**Files:**
- Create: `extension/manifest.json`, `extension/build.mjs`
- Create: `extension/src/selectors.ts`, `extension/src/content.ts`, `extension/src/background.ts`
- Create: `extension/seed-catalog.json`

**Interfaces:**
- Consumes: `Catalog` shape from `shared/types.ts` (seed file must conform)
- Produces:
  - `HIDE_SELECTORS: string[]`, `HOME_GRID`, `WATCH_SIDEBAR`, `SEARCH_RESULTS`, `SEARCH_RESULT_ITEM`, `CHANNEL_LINK_IN_RESULT`, `SEARCH_SHELF_ITEMS`, `AUTONAV_TOGGLE` exported from `extension/src/selectors.ts`
  - `installHideStyle(): void` / hide-style element with id `lc-hide` (later tasks remove it on failure)
  - `npm run build -w extension` produces a loadable unpacked extension in `extension/dist/`

- [ ] **Step 1: Write `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Learning Child",
  "version": "0.1.0",
  "description": "Shows parent-curated videos on YouTube instead of algorithmic recommendations.",
  "action": {},
  "background": { "service_worker": "background.js" },
  "options_page": "options.html",
  "permissions": ["storage", "alarms"],
  "host_permissions": ["https://www.youtube.com/*", "https://*.github.io/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}
```

- [ ] **Step 2: Write `extension/build.mjs`**

```js
import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    options: "src/options/options.ts",
  },
  bundle: true,
  format: "iife",
  outdir: "dist",
  logLevel: "info",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("seed-catalog.json", "dist/seed-catalog.json");
if (existsSync("src/options/options.html")) cpSync("src/options/options.html", "dist/options.html");
```

(The options entry point doesn't exist until Task 14 - create a placeholder now: `extension/src/options/options.ts` containing `export {};` and `extension/src/options/options.html` containing `<!doctype html><title>Learning Child</title><script src="options.js" defer></script>`.)

- [ ] **Step 3: Write `extension/src/selectors.ts`**

```ts
/**
 * ALL YouTube DOM selectors live here. Never inline a selector in an adapter.
 * When YouTube breaks the extension, this is the only file to fix.
 */

/** Hidden pre-paint by the lc-hide style. Broad, container-level, slow-churn. */
export const HIDE_SELECTORS = [
  // Home recommendation grid contents (our grid is injected alongside)
  "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer #contents",
  // Watch-page related videos / up next
  "#related",
  // Comments
  "ytd-comments#comments",
  // Shorts shelves and nav entries
  "ytd-reel-shelf-renderer",
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-guide-entry-renderer:has(a[href^='/shorts'])",
  "ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])",
  // Trending / Explore nav entries
  "ytd-guide-entry-renderer:has(a[href='/feed/trending'])",
  "ytd-guide-entry-renderer:has(a[href='/feed/explore'])",
  // Notification bell
  "ytd-notification-topbar-button-renderer",
  // End-screen suggestion cards + grid
  ".ytp-ce-element",
  ".ytp-endscreen-content",
];

/** Home grid container - our curated grid is inserted before it. */
export const HOME_GRID = "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer";

/** Watch page right-hand column - our up-next list is prepended into it. */
export const WATCH_SIDEBAR = "#secondary.ytd-watch-flexy";

/** Search results list container (observed for infinite scroll). */
export const SEARCH_RESULTS = "ytd-search #contents";

/** A single organic search result. */
export const SEARCH_RESULT_ITEM = "ytd-video-renderer";

/** Channel link inside a search result (href is /channel/UC… or /@handle). */
export const CHANNEL_LINK_IN_RESULT = "ytd-channel-name a";

/** Non-video shelves in search results (Shorts, "people also watched", …). */
export const SEARCH_SHELF_ITEMS = "ytd-reel-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer";

/** Player autoplay-next toggle (aria-checked reflects state). */
export const AUTONAV_TOGGLE = ".ytp-autonav-toggle-button";
```

- [ ] **Step 4: Write `extension/src/content.ts` (v0 - hide only, router comes in Task 11)**

```ts
import { HIDE_SELECTORS } from "./selectors";

export function installHideStyle(): void {
  if (document.getElementById("lc-hide")) return;
  const style = document.createElement("style");
  style.id = "lc-hide";
  style.textContent = `${HIDE_SELECTORS.join(",\n")} { display: none !important; }`;
  document.documentElement.appendChild(style);
}

installHideStyle();
```

- [ ] **Step 5: Write `extension/src/background.ts` (v0 - badge only, refresh comes in Task 10)**

```ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "adapter-failure") {
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    chrome.action.setBadgeText({ text: "!" });
  }
});
```

- [ ] **Step 6: Write `extension/seed-catalog.json`**

Bundled fallback so kids never see an empty page. Sample entries - regenerate from a real pipeline run once the catalog is live (README covers this):

```json
{
  "version": 1,
  "generatedAt": "2026-07-26T00:00:00Z",
  "profiles": {
    "little": { "label": "Ages 3-7" },
    "big": { "label": "Ages 8-12" }
  },
  "videos": [
    {
      "id": "zQGOcOUBi6s",
      "title": "The Immune System Explained I - Bacteria Infection",
      "channel": "Kurzgesagt - In a Nutshell",
      "channelId": "UCsXVk37bltHxD1rDPwtNM8Q",
      "durationSec": 425,
      "publishedAt": "2014-07-01T00:00:00Z",
      "topics": ["science"],
      "profiles": ["big"],
      "thumbnail": "https://i.ytimg.com/vi/zQGOcOUBi6s/hqdefault.jpg"
    },
    {
      "id": "WUvTyaaNkzM",
      "title": "The essence of calculus",
      "channel": "3Blue1Brown",
      "channelId": "UCYO_jab_esuFRV4b17AJtAw",
      "durationSec": 1039,
      "publishedAt": "2017-04-28T00:00:00Z",
      "topics": ["maths"],
      "profiles": ["big"],
      "thumbnail": "https://i.ytimg.com/vi/WUvTyaaNkzM/hqdefault.jpg"
    }
  ]
}
```

- [ ] **Step 7: Build and load manually**

Run: `npm install && npm run build -w extension`
Expected: esbuild reports `dist/content.js`, `dist/background.js`, `dist/options.js` written; `dist/manifest.json` exists.

Manual check: `chrome://extensions` → Developer mode → Load unpacked → `extension/dist` → open youtube.com. Expected: home grid tiles, watch-sidebar suggestions, comments, Shorts shelves are all GONE (blank areas are fine at this stage - injection comes next tasks).

- [ ] **Step 8: Commit**

```bash
git add extension
git commit -m "feat(extension): MV3 scaffold with pre-paint hiding of YouTube recommendations"
```

---

### Task 8: Extension - feed logic (pure)

**Files:**
- Create: `extension/src/feed.ts`
- Test: `extension/src/feed.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `CatalogVideo` from `shared/types.ts`
- Produces:
  - `hashSeed(s: string): number`, `mulberry32(seed: number): () => number`
  - `seededShuffle<T>(items: T[], seedStr: string): T[]` (non-mutating)
  - `dailyFeed(catalog: Catalog, profile: string, dateStr: string): CatalogVideo[]`
  - `upNext(catalog: Catalog, profile: string, currentId: string, dateStr: string, count?: number): CatalogVideo[]` (default count 15)
  - `todayStr(): string` - `YYYY-MM-DD`

- [ ] **Step 1: Write the failing tests**

`extension/src/feed.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { dailyFeed, seededShuffle, upNext } from "./feed";
import type { Catalog, CatalogVideo } from "../../shared/types";

function vid(over: Partial<CatalogVideo>): CatalogVideo {
  return {
    id: "v", title: "T", channel: "C", channelId: "UC1", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"],
    thumbnail: "t", ...over,
  };
}

function makeCatalog(videos: CatalogVideo[]): Catalog {
  return { version: 1, generatedAt: "x", profiles: { little: { label: "l" }, big: { label: "b" } }, videos };
}

const many = Array.from({ length: 30 }, (_, i) => vid({ id: `v${i}` }));

describe("seededShuffle", () => {
  it("is deterministic for the same seed and different for different seeds", () => {
    const a = seededShuffle(many, "2026-07-26:big");
    const b = seededShuffle(many, "2026-07-26:big");
    const c = seededShuffle(many, "2026-07-27:big");
    expect(a.map((v) => v.id)).toEqual(b.map((v) => v.id));
    expect(a.map((v) => v.id)).not.toEqual(c.map((v) => v.id));
    expect(a).toHaveLength(30);
  });

  it("does not mutate its input", () => {
    const input = [...many];
    seededShuffle(input, "s");
    expect(input.map((v) => v.id)).toEqual(many.map((v) => v.id));
  });
});

describe("dailyFeed", () => {
  it("only includes videos for the profile", () => {
    const catalog = makeCatalog([
      vid({ id: "forBig", profiles: ["big"] }),
      vid({ id: "forLittle", profiles: ["little"] }),
    ]);
    const feed = dailyFeed(catalog, "little", "2026-07-26");
    expect(feed.map((v) => v.id)).toEqual(["forLittle"]);
  });

  it("front-loads up to 4 videos published in the last 30 days", () => {
    const catalog = makeCatalog([
      ...many,
      vid({ id: "fresh1", publishedAt: "2026-07-20T00:00:00Z" }),
      vid({ id: "fresh2", publishedAt: "2026-07-10T00:00:00Z" }),
    ]);
    const feed = dailyFeed(catalog, "big", "2026-07-26");
    expect(feed.slice(0, 2).map((v) => v.id).sort()).toEqual(["fresh1", "fresh2"]);
    expect(feed).toHaveLength(32);
  });
});

describe("upNext", () => {
  it("excludes the current video and ranks topic overlap first", () => {
    const catalog = makeCatalog([
      vid({ id: "current", topics: ["space"] }),
      vid({ id: "same1", topics: ["space"] }),
      vid({ id: "same2", topics: ["space", "science"] }),
      ...Array.from({ length: 20 }, (_, i) => vid({ id: `other${i}`, topics: ["music"] })),
    ]);
    const next = upNext(catalog, "big", "current", "2026-07-26", 5);
    expect(next).toHaveLength(5);
    expect(next.map((v) => v.id)).not.toContain("current");
    expect(next.slice(0, 2).map((v) => v.id).sort()).toEqual(["same1", "same2"]);
  });

  it("falls back to a shuffle when the current video is unknown", () => {
    const catalog = makeCatalog(many);
    const next = upNext(catalog, "big", "notInCatalog", "2026-07-26");
    expect(next).toHaveLength(15);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './feed'`

- [ ] **Step 3: Implement `extension/src/feed.ts`**

```ts
import type { Catalog, CatalogVideo } from "../../shared/types";

const FRESH_DAYS = 30;
const FRESH_SLOTS = 4;

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const rand = mulberry32(hashSeed(seedStr));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dailyFeed(catalog: Catalog, profile: string, dateStr: string): CatalogVideo[] {
  const pool = catalog.videos.filter((v) => v.profiles.includes(profile));
  const shuffled = seededShuffle(pool, `${dateStr}:${profile}`);
  const cutoff = new Date(dateStr).getTime() - FRESH_DAYS * 86_400_000;
  const fresh = shuffled
    .filter((v) => new Date(v.publishedAt).getTime() >= cutoff)
    .slice(0, FRESH_SLOTS);
  const freshIds = new Set(fresh.map((v) => v.id));
  return [...fresh, ...shuffled.filter((v) => !freshIds.has(v.id))];
}

export function upNext(
  catalog: Catalog,
  profile: string,
  currentId: string,
  dateStr: string,
  count = 15,
): CatalogVideo[] {
  const current = catalog.videos.find((v) => v.id === currentId);
  const pool = catalog.videos.filter((v) => v.profiles.includes(profile) && v.id !== currentId);
  const shuffled = seededShuffle(pool, `${dateStr}:${profile}:${currentId}`);
  if (!current || current.topics.length === 0) return shuffled.slice(0, count);
  const overlap = (v: CatalogVideo) => v.topics.filter((t) => current.topics.includes(t)).length;
  return shuffled
    .map((v, i) => ({ v, i }))
    .sort((a, b) => overlap(b.v) - overlap(a.v) || a.i - b.i)
    .map((x) => x.v)
    .slice(0, count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src/feed.ts extension/src/feed.test.ts
git commit -m "feat(extension): deterministic daily feed and topic-biased up-next"
```

---

### Task 9: Extension - tile renderer (jsdom-tested)

**Files:**
- Create: `extension/src/ui.ts`
- Test: `extension/src/ui.test.ts`

**Interfaces:**
- Consumes: `CatalogVideo` from `shared/types.ts`
- Produces:
  - `formatDuration(sec: number): string` - `754 → "12:34"`, `3723 → "1:02:03"`
  - `renderGrid(videos: CatalogVideo[]): HTMLElement` - element with class `lc-grid`, one `a.lc-tile` per video
  - `renderList(videos: CatalogVideo[]): HTMLElement` - element with class `lc-list`, same tiles in list layout
  - `injectUiCss(doc?: Document): void` - idempotent, style id `lc-ui-css`

- [ ] **Step 1: Write the failing tests**

`extension/src/ui.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatDuration, injectUiCss, renderGrid, renderList } from "./ui";
import type { CatalogVideo } from "../../shared/types";

const videos: CatalogVideo[] = [
  {
    id: "abc", title: "Star stuff", channel: "Space Kids", channelId: "UC1",
    durationSec: 754, publishedAt: "2026-01-01T00:00:00Z", topics: ["space"],
    profiles: ["big"], thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  },
];

describe("formatDuration", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(45)).toBe("0:45");
  });
});

describe("renderGrid", () => {
  it("renders one tile per video linking to the watch page", () => {
    const grid = renderGrid(videos);
    expect(grid.classList.contains("lc-grid")).toBe(true);
    const tiles = grid.querySelectorAll("a.lc-tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].getAttribute("href")).toBe("/watch?v=abc");
    expect(tiles[0].querySelector("img")!.src).toContain("abc");
    expect(tiles[0].textContent).toContain("Star stuff");
    expect(tiles[0].textContent).toContain("Space Kids");
    expect(tiles[0].textContent).toContain("12:34");
  });
});

describe("renderList", () => {
  it("renders tiles in list mode", () => {
    const list = renderList(videos);
    expect(list.classList.contains("lc-list")).toBe(true);
    expect(list.querySelectorAll("a.lc-tile")).toHaveLength(1);
  });
});

describe("injectUiCss", () => {
  it("is idempotent", () => {
    injectUiCss(document);
    injectUiCss(document);
    expect(document.querySelectorAll("#lc-ui-css")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './ui'`

- [ ] **Step 3: Implement `extension/src/ui.ts`**

```ts
import type { CatalogVideo } from "../../shared/types";

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function renderTile(v: CatalogVideo, doc: Document): HTMLAnchorElement {
  const a = doc.createElement("a");
  a.className = "lc-tile";
  a.href = `/watch?v=${v.id}`;

  const thumbWrap = doc.createElement("div");
  thumbWrap.className = "lc-thumb";
  const img = doc.createElement("img");
  img.src = v.thumbnail;
  img.alt = "";
  img.loading = "lazy";
  const badge = doc.createElement("span");
  badge.className = "lc-duration";
  badge.textContent = formatDuration(v.durationSec);
  thumbWrap.append(img, badge);

  const title = doc.createElement("div");
  title.className = "lc-title";
  title.textContent = v.title;

  const channel = doc.createElement("div");
  channel.className = "lc-channel";
  channel.textContent = v.channel;

  a.append(thumbWrap, title, channel);
  return a;
}

function renderContainer(videos: CatalogVideo[], className: string): HTMLElement {
  const doc = document;
  injectUiCss(doc);
  const el = doc.createElement("div");
  el.className = className;
  for (const v of videos) el.appendChild(renderTile(v, doc));
  return el;
}

export function renderGrid(videos: CatalogVideo[]): HTMLElement {
  return renderContainer(videos, "lc-grid");
}

export function renderList(videos: CatalogVideo[]): HTMLElement {
  return renderContainer(videos, "lc-list");
}

/** Uses YouTube's own CSS variables so tiles follow light/dark theme. */
const UI_CSS = `
.lc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px 16px;
  padding: 24px;
}
.lc-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
.lc-list .lc-tile { display: grid; grid-template-columns: 168px 1fr; gap: 8px; }
.lc-list .lc-title { grid-column: 2; margin: 0; }
.lc-list .lc-channel { grid-column: 2; }
.lc-list .lc-thumb { grid-row: 1 / span 2; }
.lc-tile { text-decoration: none; display: block; }
.lc-thumb { position: relative; }
.lc-thumb img {
  width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
  border-radius: 12px; display: block; background: #0002;
}
.lc-duration {
  position: absolute; right: 6px; bottom: 6px;
  background: rgba(0,0,0,0.8); color: #fff;
  font-size: 12px; font-weight: 500; padding: 1px 4px; border-radius: 4px;
}
.lc-title {
  margin-top: 10px;
  color: var(--yt-spec-text-primary, #0f0f0f);
  font-family: "Roboto", Arial, sans-serif;
  font-size: 15px; font-weight: 500; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lc-channel {
  color: var(--yt-spec-text-secondary, #606060);
  font-family: "Roboto", Arial, sans-serif;
  font-size: 13px; margin-top: 4px;
}
`;

export function injectUiCss(doc: Document = document): void {
  if (doc.getElementById("lc-ui-css")) return;
  const style = doc.createElement("style");
  style.id = "lc-ui-css";
  style.textContent = UI_CSS;
  doc.head?.appendChild(style) ?? doc.documentElement.appendChild(style);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src/ui.ts extension/src/ui.test.ts
git commit -m "feat(extension): YouTube-styled tile grid and list renderers"
```

---

### Task 10: Extension - catalog store + background refresher

**Files:**
- Create: `extension/src/catalog.ts`
- Modify: `extension/src/background.ts` (replace v0 entirely - full code below)
- Test: `extension/src/catalog.test.ts`

**Interfaces:**
- Consumes: `Catalog`, `AllowedChannels` from `shared/types.ts`; storage keys written by background: `local.catalog`, `local.allowed`; sync keys written by options (Task 14): `sync.catalogUrl`, `sync.profile`
- Produces:
  - `loadCatalog(): Promise<Catalog>` - `storage.local.catalog` → bundled seed fallback
  - `loadAllowed(): Promise<AllowedChannels>` - `storage.local.allowed` → derived from catalog
  - `getActiveProfile(catalog: Catalog): Promise<string>` - `sync.profile` if valid, else first profile
  - Background: alarm `refresh-catalog` every 240 min fetches `<catalogUrl>/catalog.json` + `<catalogUrl>/allowed-channels.json` into `storage.local`; failures keep the cache; `adapter-failure` message sets a red `!` badge

- [ ] **Step 1: Write the failing tests**

`extension/src/catalog.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Catalog } from "../../shared/types";

const seedCatalog: Catalog = {
  version: 1, generatedAt: "x",
  profiles: { little: { label: "l" }, big: { label: "b" } },
  videos: [{
    id: "seed1", title: "T", channel: "C", channelId: "UCseed", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"], thumbnail: "t",
  }],
};

function stubChrome(localData: Record<string, unknown>, syncData: Record<string, unknown>) {
  vi.stubGlobal("chrome", {
    storage: {
      local: { get: vi.fn(async (k: string) => ({ [k]: localData[k] })) },
      sync: { get: vi.fn(async (k: string) => ({ [k]: syncData[k] })) },
    },
    runtime: { getURL: (p: string) => `chrome-extension://x/${p}` },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("loadCatalog", () => {
  it("returns the cached catalog when present", async () => {
    stubChrome({ catalog: seedCatalog }, {});
    const { loadCatalog } = await import("./catalog");
    expect((await loadCatalog()).videos[0].id).toBe("seed1");
  });

  it("falls back to the bundled seed when cache is empty", async () => {
    stubChrome({}, {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => seedCatalog })));
    const { loadCatalog } = await import("./catalog");
    const catalog = await loadCatalog();
    expect(catalog.videos[0].id).toBe("seed1");
    expect(fetch).toHaveBeenCalledWith("chrome-extension://x/seed-catalog.json");
  });
});

describe("loadAllowed", () => {
  it("derives allowed channels from the catalog when no allowed cache", async () => {
    stubChrome({ catalog: seedCatalog }, {});
    const { loadAllowed } = await import("./catalog");
    expect(await loadAllowed()).toEqual({ channelIds: ["UCseed"], handles: [] });
  });
});

describe("getActiveProfile", () => {
  it("uses the synced profile when valid, else the first catalog profile", async () => {
    stubChrome({}, { profile: "big" });
    const { getActiveProfile } = await import("./catalog");
    expect(await getActiveProfile(seedCatalog)).toBe("big");

    stubChrome({}, { profile: "ghost" });
    expect(await getActiveProfile(seedCatalog)).toBe("little");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './catalog'`

- [ ] **Step 3: Implement `extension/src/catalog.ts`**

```ts
import type { AllowedChannels, Catalog } from "../../shared/types";

export async function loadCatalog(): Promise<Catalog> {
  const { catalog } = await chrome.storage.local.get("catalog");
  if (catalog) return catalog as Catalog;
  const res = await fetch(chrome.runtime.getURL("seed-catalog.json"));
  return (await res.json()) as Catalog;
}

export async function loadAllowed(): Promise<AllowedChannels> {
  const { allowed } = await chrome.storage.local.get("allowed");
  if (allowed) return allowed as AllowedChannels;
  const catalog = await loadCatalog();
  return { channelIds: [...new Set(catalog.videos.map((v) => v.channelId))], handles: [] };
}

export async function getActiveProfile(catalog: Catalog): Promise<string> {
  const { profile } = await chrome.storage.sync.get("profile");
  if (typeof profile === "string" && catalog.profiles[profile]) return profile;
  return Object.keys(catalog.profiles)[0];
}
```

- [ ] **Step 4: Replace `extension/src/background.ts`**

```ts
const REFRESH_ALARM = "refresh-catalog";
const REFRESH_MINUTES = 240;

async function refreshCatalog(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  if (typeof catalogUrl !== "string" || !catalogUrl) return;
  const base = catalogUrl.replace(/\/+$/, "");
  try {
    const [catalog, allowed] = await Promise.all([
      fetch(`${base}/catalog.json`).then((r) => {
        if (!r.ok) throw new Error(`catalog.json ${r.status}`);
        return r.json();
      }),
      fetch(`${base}/allowed-channels.json`).then((r) => {
        if (!r.ok) throw new Error(`allowed-channels.json ${r.status}`);
        return r.json();
      }),
    ]);
    await chrome.storage.local.set({ catalog, allowed });
    await chrome.action.setBadgeText({ text: "" });
  } catch (err) {
    // Keep the cached catalog; kids never see an empty page.
    console.warn("[learning-child] catalog refresh failed", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES, delayInMinutes: 0 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void refreshCatalog();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.catalogUrl) void refreshCatalog();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "adapter-failure") {
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    chrome.action.setBadgeText({ text: "!" });
  }
});
```

- [ ] **Step 5: Run tests + build**

Run: `npm test && npm run build -w extension`
Expected: tests PASS, build succeeds

- [ ] **Step 6: Commit**

```bash
git add extension/src/catalog.ts extension/src/catalog.test.ts extension/src/background.ts
git commit -m "feat(extension): catalog store with seed fallback and background refresher"
```

---

### Task 11: Extension - SPA router, home adapter, Shorts redirect, fail-open

**Files:**
- Create: `extension/src/dom.ts` (waitFor helper)
- Create: `extension/src/adapters/home.ts`
- Modify: `extension/src/content.ts` (replace entirely - full code below)
- Test: `extension/src/dom.test.ts`

**Interfaces:**
- Consumes: `loadCatalog`/`getActiveProfile` (Task 10), `dailyFeed`/`todayStr` (Task 8), `renderGrid` (Task 9), `HOME_GRID` (Task 7)
- Produces:
  - `waitFor(selector: string, timeoutMs?: number): Promise<Element>` (default 10000) - rejects on timeout
  - `reportFailure(surface: string): void` - removes `#lc-hide` (fail open) and messages the background to set the badge
  - `runHome(): Promise<void>` - injects `#lc-home-grid`
  - Router in `content.ts`: routes on load + `yt-navigate-finish`; `/shorts/*` → `location.replace("/")`; every adapter wrapped in try/catch → `reportFailure`; calls the previous adapter's cleanup before routing. Adapters may return `void | (() => void)` (cleanup).

- [ ] **Step 1: Write the failing test**

`extension/src/dom.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { waitFor } from "./dom";

describe("waitFor", () => {
  it("resolves immediately when the element exists", async () => {
    document.body.innerHTML = `<div id="x"></div>`;
    expect((await waitFor("#x")).id).toBe("x");
  });

  it("resolves when the element appears later", async () => {
    document.body.innerHTML = "";
    setTimeout(() => {
      const el = document.createElement("div");
      el.id = "later";
      document.body.appendChild(el);
    }, 10);
    expect((await waitFor("#later", 1000)).id).toBe("later");
  });

  it("rejects on timeout", async () => {
    document.body.innerHTML = "";
    await expect(waitFor("#never", 30)).rejects.toThrow(/timeout/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - `Cannot find module './dom'`

- [ ] **Step 3: Implement `extension/src/dom.ts`**

```ts
export function waitFor(selector: string, timeoutMs = 10_000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`timeout waiting for ${selector}`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}
```

- [ ] **Step 4: Implement `extension/src/adapters/home.ts`**

```ts
import { loadCatalog, getActiveProfile } from "../catalog";
import { dailyFeed, todayStr } from "../feed";
import { renderGrid } from "../ui";
import { waitFor } from "../dom";
import { HOME_GRID } from "../selectors";

export async function runHome(): Promise<void> {
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(HOME_GRID);
  document.getElementById("lc-home-grid")?.remove();
  const grid = renderGrid(dailyFeed(catalog, profile, todayStr()));
  grid.id = "lc-home-grid";
  host.parentElement!.insertBefore(grid, host);
}
```

- [ ] **Step 5: Replace `extension/src/content.ts`**

```ts
import { HIDE_SELECTORS } from "./selectors";
import { runHome } from "./adapters/home";

export function installHideStyle(): void {
  if (document.getElementById("lc-hide")) return;
  const style = document.createElement("style");
  style.id = "lc-hide";
  style.textContent = `${HIDE_SELECTORS.join(",\n")} { display: none !important; }`;
  document.documentElement.appendChild(style);
}

/** Fail OPEN: unhide real YouTube and flag the parent via the toolbar badge. */
export function reportFailure(surface: string): void {
  console.warn(`[learning-child] adapter failed: ${surface}`);
  document.getElementById("lc-hide")?.remove();
  try {
    chrome.runtime.sendMessage({ type: "adapter-failure", surface });
  } catch {
    // extension context gone (e.g. reloaded) - nothing to do
  }
}

type Cleanup = void | (() => void);
let cleanup: Cleanup;

const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  // watch (Task 12) and search (Task 13) adapters register here
];

async function route(): Promise<void> {
  if (typeof cleanup === "function") cleanup();
  cleanup = undefined;

  const path = location.pathname;
  if (path.startsWith("/shorts")) {
    location.replace("https://www.youtube.com/");
    return;
  }
  for (const [pattern, surface, run] of routes) {
    if (pattern.test(path)) {
      try {
        cleanup = await run();
      } catch {
        reportFailure(surface);
      }
      return;
    }
  }
}

installHideStyle();
window.addEventListener("yt-navigate-finish", () => void route());
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void route());
} else {
  void route();
}
```

- [ ] **Step 6: Run tests + build, manual check**

Run: `npm test && npm run build -w extension`
Expected: PASS, build OK.

Manual: reload the unpacked extension, open youtube.com. Expected: curated tiles fill the homepage; clicking one opens its watch page; visiting youtube.com/shorts/anything bounces back to the homepage.

- [ ] **Step 7: Commit**

```bash
git add extension/src
git commit -m "feat(extension): SPA router, curated homepage grid, shorts redirect, fail-open"
```

---

### Task 12: Extension - watch-page adapter (up next + autoplay off)

**Files:**
- Create: `extension/src/adapters/watch.ts`
- Modify: `extension/src/content.ts:` routes table - add the watch entry (shown below)

**Interfaces:**
- Consumes: `loadCatalog`/`getActiveProfile` (Task 10), `upNext`/`todayStr` (Task 8), `renderList` (Task 9), `waitFor` (Task 11), `WATCH_SIDEBAR`/`AUTONAV_TOGGLE` (Task 7)
- Produces: `runWatch(): Promise<() => void>` - injects `#lc-upnext` into the sidebar, forces autoplay off; returns cleanup that stops the autoplay poller

- [ ] **Step 1: Implement `extension/src/adapters/watch.ts`**

```ts
import { loadCatalog, getActiveProfile } from "../catalog";
import { upNext, todayStr } from "../feed";
import { renderList } from "../ui";
import { waitFor } from "../dom";
import { WATCH_SIDEBAR, AUTONAV_TOGGLE } from "../selectors";

const AUTOPLAY_POLL_MS = 500;
const AUTOPLAY_GIVE_UP_MS = 15_000;

function disableAutoplay(): () => void {
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += AUTOPLAY_POLL_MS;
    const toggle = document.querySelector<HTMLElement>(AUTONAV_TOGGLE);
    if (toggle?.getAttribute("aria-checked") === "true") {
      toggle.click();
      clearInterval(timer);
    } else if (elapsed >= AUTOPLAY_GIVE_UP_MS) {
      clearInterval(timer);
    }
  }, AUTOPLAY_POLL_MS);
  return () => clearInterval(timer);
}

export async function runWatch(): Promise<() => void> {
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const currentId = new URLSearchParams(location.search).get("v") ?? "";
  const sidebar = await waitFor(WATCH_SIDEBAR);
  document.getElementById("lc-upnext")?.remove();
  const list = renderList(upNext(catalog, profile, currentId, todayStr()));
  list.id = "lc-upnext";
  sidebar.prepend(list);
  return disableAutoplay();
}
```

- [ ] **Step 2: Register the route in `extension/src/content.ts`**

In the `routes` table add (and import `runWatch` at the top):
```ts
import { runWatch } from "./adapters/watch";
// ...
const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  [/^\/watch$/, "watch", runWatch],
];
```

- [ ] **Step 3: Build + manual check**

Run: `npm run build -w extension`
Manual: reload extension, open a curated video. Expected: sidebar shows curated up-next list (topic-related first); comments absent; autoplay toggle switches itself off; end-screen suggestion tiles don't appear at video end; clicking an up-next item navigates and the sidebar repopulates (SPA route ran again).

- [ ] **Step 4: Run tests (regression)**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src
git commit -m "feat(extension): curated up-next sidebar and forced autoplay off"
```

---

### Task 13: Extension - search filtering

**Files:**
- Create: `extension/src/search-filter.ts` (pure)
- Create: `extension/src/adapters/search.ts`
- Modify: `extension/src/content.ts` routes table - add the search entry (shown below)
- Test: `extension/src/search-filter.test.ts`

**Interfaces:**
- Consumes: `AllowedChannels` from `shared/types.ts`; `loadAllowed`/`loadCatalog`/`getActiveProfile` (Task 10); `dailyFeed`/`todayStr` (Task 8); `renderGrid` (Task 9); `waitFor` (Task 11); search selectors (Task 7)
- Produces:
  - `channelRefFromHref(href: string): string | null` - `"/channel/UCx" → "UCx"`, `"/@Handle" → "@handle"`, full URLs accepted
  - `isAllowed(href: string | null, allowed: AllowedChannels): boolean`
  - `runSearch(): Promise<() => void>` - removes disallowed results (initial + infinite scroll via MutationObserver), removes shelf modules, shows `#lc-search-empty` curated panel when nothing survives; cleanup disconnects the observer

- [ ] **Step 1: Write the failing tests**

`extension/src/search-filter.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { channelRefFromHref, isAllowed } from "./search-filter";
import type { AllowedChannels } from "../../shared/types";

const allowed: AllowedChannels = {
  channelIds: ["UCgood"],
  handles: ["@goodchannel"],
};

describe("channelRefFromHref", () => {
  it("extracts channel ids and lowercased handles", () => {
    expect(channelRefFromHref("/channel/UCgood")).toBe("UCgood");
    expect(channelRefFromHref("/@GoodChannel")).toBe("@goodchannel");
    expect(channelRefFromHref("https://www.youtube.com/@GoodChannel/videos")).toBe("@goodchannel");
    expect(channelRefFromHref("/watch?v=x")).toBeNull();
  });
});

describe("isAllowed", () => {
  it("matches by channel id or handle, rejects everything else", () => {
    expect(isAllowed("/channel/UCgood", allowed)).toBe(true);
    expect(isAllowed("/@goodchannel", allowed)).toBe(true);
    expect(isAllowed("/@GOODCHANNEL", allowed)).toBe(true);
    expect(isAllowed("/channel/UCevil", allowed)).toBe(false);
    expect(isAllowed("/@clickbait", allowed)).toBe(false);
    expect(isAllowed(null, allowed)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL - `Cannot find module './search-filter'`

- [ ] **Step 3: Implement `extension/src/search-filter.ts`**

```ts
import type { AllowedChannels } from "../../shared/types";

export function channelRefFromHref(href: string): string | null {
  let path = href;
  if (href.startsWith("http")) {
    try {
      path = new URL(href).pathname;
    } catch {
      return null;
    }
  }
  if (path.startsWith("/channel/")) return path.split("/")[2] ?? null;
  if (path.startsWith("/@")) return `@${path.slice(2).split("/")[0].toLowerCase()}`;
  return null;
}

export function isAllowed(href: string | null, allowed: AllowedChannels): boolean {
  if (!href) return false;
  const ref = channelRefFromHref(href);
  if (!ref) return false;
  if (ref.startsWith("@")) return allowed.handles.includes(ref);
  return allowed.channelIds.includes(ref);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Implement `extension/src/adapters/search.ts`**

```ts
import { loadAllowed, loadCatalog, getActiveProfile } from "../catalog";
import { dailyFeed, todayStr } from "../feed";
import { renderGrid } from "../ui";
import { waitFor } from "../dom";
import {
  SEARCH_RESULTS,
  SEARCH_RESULT_ITEM,
  SEARCH_SHELF_ITEMS,
  CHANNEL_LINK_IN_RESULT,
} from "../selectors";
import type { AllowedChannels } from "../../../shared/types";
import { isAllowed } from "../search-filter";

const EMPTY_CHECK_DELAY_MS = 3000;
const EMPTY_SUGGESTION_COUNT = 8;

function filterResults(container: Element, allowed: AllowedChannels): number {
  let kept = 0;
  for (const item of container.querySelectorAll(SEARCH_RESULT_ITEM)) {
    const link = item.querySelector<HTMLAnchorElement>(CHANNEL_LINK_IN_RESULT);
    if (isAllowed(link?.getAttribute("href") ?? null, allowed)) kept++;
    else item.remove();
  }
  for (const shelf of container.querySelectorAll(SEARCH_SHELF_ITEMS)) shelf.remove();
  return kept;
}

async function showEmptyPanel(container: Element): Promise<void> {
  if (document.getElementById("lc-search-empty")) return;
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const panel = document.createElement("div");
  panel.id = "lc-search-empty";
  const heading = document.createElement("h2");
  heading.textContent = "Nothing here for that search - try one of these!";
  heading.style.cssText = "padding: 24px 24px 0; font-family: Roboto, Arial, sans-serif;";
  panel.append(heading, renderGrid(dailyFeed(catalog, profile, todayStr()).slice(0, EMPTY_SUGGESTION_COUNT)));
  container.prepend(panel);
}

export async function runSearch(): Promise<() => void> {
  const allowed = await loadAllowed();
  const container = await waitFor(SEARCH_RESULTS);
  document.getElementById("lc-search-empty")?.remove();

  filterResults(container, allowed);
  const observer = new MutationObserver(() => filterResults(container, allowed));
  observer.observe(container, { childList: true, subtree: true });

  const emptyTimer = setTimeout(() => {
    if (filterResults(container, allowed) === 0 && !container.querySelector(SEARCH_RESULT_ITEM)) {
      void showEmptyPanel(container);
    }
  }, EMPTY_CHECK_DELAY_MS);

  return () => {
    observer.disconnect();
    clearTimeout(emptyTimer);
  };
}
```

- [ ] **Step 6: Register the route in `extension/src/content.ts`**

```ts
import { runSearch } from "./adapters/search";
// ...
const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  [/^\/watch$/, "watch", runWatch],
  [/^\/results$/, "search", runSearch],
];
```

- [ ] **Step 7: Build + manual check, run tests**

Run: `npm test && npm run build -w extension`
Manual: reload extension; search "veritasium" → only approved-channel results remain; search "skibidi toilet" → results vanish and the curated suggestion panel appears; scrolling doesn't leak disallowed results back in.

- [ ] **Step 8: Commit**

```bash
git add extension/src
git commit -m "feat(extension): search results filtered to approved channels with curated empty state"
```

---

### Task 14: Extension - parent options page

**Files:**
- Modify: `extension/src/options/options.html` (replace placeholder)
- Modify: `extension/src/options/options.ts` (replace placeholder)

**Interfaces:**
- Consumes: `sync.catalogUrl` / `sync.profile` storage keys (background refetches on `catalogUrl` change - Task 10); `loadCatalog` (Task 10) for the profile list
- Produces: options page where a parent sets the catalog URL and active kid profile; saving writes both keys to `chrome.storage.sync`

- [ ] **Step 1: Write `extension/src/options/options.html`**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Learning Child - Parent Settings</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 0 16px; color: #222; }
    label { display: block; margin: 16px 0 4px; font-weight: 600; }
    input, select { width: 100%; padding: 8px; font-size: 14px; box-sizing: border-box; }
    button { margin-top: 20px; padding: 8px 20px; font-size: 14px; cursor: pointer; }
    #status { margin-left: 12px; color: #2e7d32; }
    .hint { color: #666; font-size: 13px; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Learning Child - Parent Settings</h1>
  <p>This page is for parents. Settings apply to this Chrome profile.</p>

  <label for="catalogUrl">Catalog URL</label>
  <input id="catalogUrl" type="url" placeholder="https://YOURNAME.github.io/learning-child">
  <div class="hint">Where your published catalog lives. Leave empty to use the small built-in sample.</div>

  <label for="profile">Kid profile for this Chrome profile</label>
  <select id="profile"></select>

  <button id="save">Save</button><span id="status"></span>

  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `extension/src/options/options.ts`**

```ts
import { loadCatalog } from "../catalog";

async function init(): Promise<void> {
  const urlInput = document.getElementById("catalogUrl") as HTMLInputElement;
  const profileSelect = document.getElementById("profile") as HTMLSelectElement;
  const saveButton = document.getElementById("save") as HTMLButtonElement;
  const status = document.getElementById("status") as HTMLSpanElement;

  const { catalogUrl, profile } = await chrome.storage.sync.get(["catalogUrl", "profile"]);
  urlInput.value = typeof catalogUrl === "string" ? catalogUrl : "";

  const catalog = await loadCatalog();
  for (const [id, p] of Object.entries(catalog.profiles)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${p.label} (${id})`;
    profileSelect.appendChild(option);
  }
  if (typeof profile === "string" && catalog.profiles[profile]) profileSelect.value = profile;

  saveButton.addEventListener("click", async () => {
    await chrome.storage.sync.set({
      catalogUrl: urlInput.value.trim(),
      profile: profileSelect.value,
    });
    status.textContent = "Saved ✓";
    setTimeout(() => (status.textContent = ""), 2000);
  });
}

void init();
```

- [ ] **Step 3: Build + manual check**

Run: `npm run build -w extension`
Manual: reload extension → right-click icon → Options. Expected: profile dropdown lists "Ages 3-7 (little)" and "Ages 8-12 (big)" from the seed; saving persists across reopening; changing profile changes the homepage feed; setting a real catalog URL (once Task 6 is deployed) makes the background fetch it (check `chrome.storage.local` in the service-worker console).

- [ ] **Step 4: Run tests (regression)**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add extension/src/options
git commit -m "feat(extension): parent options page for catalog URL and kid profile"
```

---

### Task 15: Playwright smoke canary (manual-run, not a CI gate)

**Files:**
- Create: `extension/e2e/smoke.spec.ts`, `extension/playwright.config.ts`
- Modify: `extension/package.json` - add e2e script + dependency

**Interfaces:**
- Consumes: built extension in `extension/dist` (run `npm run build -w extension` first); injected ids `lc-home-grid`, `lc-upnext` (Tasks 11-12)
- Produces: `npm run e2e -w extension` - a canary that tells you when YouTube's DOM has drifted

- [ ] **Step 1: Add Playwright**

In `extension/package.json` `devDependencies` add `"@playwright/test": "^1.48.0"`, and to `scripts` add `"e2e": "playwright test"`. Then:

Run: `npm install && npx playwright install chromium`

- [ ] **Step 2: Write `extension/playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 1,
  use: { headless: false },
});
```

- [ ] **Step 3: Write `extension/e2e/smoke.spec.ts`**

```ts
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const distPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });
});

test.afterAll(async () => context.close());

test("homepage shows the curated grid, not YouTube's", async () => {
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/");
  await expect(page.locator("#lc-home-grid")).toBeVisible({ timeout: 20_000 });
  const tiles = page.locator("#lc-home-grid a.lc-tile");
  expect(await tiles.count()).toBeGreaterThan(0);
});

test("watch page shows curated up-next and hides comments", async () => {
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=zQGOcOUBi6s");
  await expect(page.locator("#lc-upnext")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("ytd-comments#comments")).toBeHidden();
});

test("shorts redirect home", async () => {
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/shorts/anyid");
  await page.waitForURL("https://www.youtube.com/", { timeout: 20_000 });
});
```

- [ ] **Step 4: Run the canary**

Run: `npm run build -w extension && npm run e2e -w extension`
Expected: 3 passing (a consent dialog or region wall can make this flaky - it's a canary for selector drift, never a merge gate).

- [ ] **Step 5: Commit**

```bash
git add extension/e2e extension/playwright.config.ts extension/package.json package-lock.json
git commit -m "test(extension): playwright smoke canary against live youtube"
```

---

### Task 16: README.md + AGENTS.md

**Files:**
- Create: `README.md`, `AGENTS.md`

**Interfaces:**
- Consumes: everything above (documents it)
- Produces: plain-language docs; keep both under ~120 lines

- [ ] **Step 1: Write `README.md`**

```markdown
# Learning Child

YouTube's algorithm optimizes for watch time. Its thumbnails are dopamine honeypots,
and kids are the easiest prey. This project flips who controls the feed.

A Chrome extension makes YouTube look and feel like normal YouTube - but every
recommendation is filled from a catalog **you** curate: science, music, space, maths,
exploration. The swap is invisible to the kid. The algorithm just… got better taste.

## What it does

- **Homepage & up-next**: fully replaced with your curated videos, styled like YouTube.
- **Search**: real results, filtered to channels you approve.
- **Shorts**: gone. Redirects to the homepage.
- **Also neutralized**: comments, autoplay, end-screen suggestions, notification bell, Trending.
- **Feels alive**: the feed reshuffles daily per kid profile, so it never looks frozen.

## How it works

```
catalog.yaml  ──(daily GitHub Action + YouTube API)──▶  catalog.json  ──▶  extension
(you edit this)                                        (static file)      (renders it)
```

No server. The "backend" is a cron job and a static file on GitHub Pages.

## Parent quick-start

1. **Fork/clone this repo.**
2. **Edit `catalog-pipeline/catalog.yaml`** - add channels, playlists, or single videos,
   tag them with topics and kid profiles. Push.
3. **One-time setup**: create a free YouTube Data API key
   ([console.cloud.google.com](https://console.cloud.google.com) → enable "YouTube Data API v3"
   → credentials → API key). Add it as the `YT_API_KEY` secret in your GitHub repo
   (Settings → Secrets → Actions). Enable GitHub Pages from the `gh-pages` branch.
4. **Install the extension**: `npm install && npm run build -w extension`, then
   `chrome://extensions` → Developer mode → Load unpacked → `extension/dist`.
5. **Open the extension's Options page**: paste your catalog URL
   (`https://YOURNAME.github.io/learning-child`) and pick the kid profile for this
   Chrome profile. One Chrome profile per kid works best.

Edits to `catalog.yaml` go live within minutes; the extension refreshes every 4 hours.

## Honest limits

- If YouTube changes its page structure, the extension **fails open** - real YouTube
  shows and the extension icon gets a red `!` badge so you notice. Fix is usually a
  one-line selector update in `extension/src/selectors.ts`.
- A kid with admin rights can disable the extension. Real lockdown needs Chrome's
  supervised accounts / managed policies - future work.
- The bundled `extension/seed-catalog.json` is a tiny sample used before your catalog
  loads. Replace it with a real `catalog.json` from your pipeline for better offline behavior.
```

- [ ] **Step 2: Write `AGENTS.md`**

```markdown
# AGENTS.md

Guide for AI agents working in this repo.

## What this is

Chrome MV3 extension + static catalog pipeline that replaces YouTube's recommendations
with a parent-curated video catalog for kids. Spec:
`docs/superpowers/specs/2026-07-26-kids-youtube-curation-design.md`.

## Map

- `shared/types.ts` - Catalog/AllowedChannels schema. THE contract between pipeline and
  extension. Change it only with both sides in the same commit.
- `catalog-pipeline/` - `catalog.yaml` (parent-edited) → `dist/catalog.json` +
  `dist/allowed-channels.json` via YouTube Data API. Entry: `src/build.ts` (needs
  `YT_API_KEY`). Published daily by `.github/workflows/catalog.yml` to GitHub Pages.
- `extension/` - `src/content.ts` (router; runs at `document_start`, injects hide-CSS
  pre-paint), `src/adapters/{home,watch,search}.ts`, `src/feed.ts` (pure feed logic),
  `src/ui.ts` (tile rendering), `src/catalog.ts` (storage + seed fallback),
  `src/background.ts` (4-hourly catalog refresh + failure badge).

## Invariants - do not break

1. **Every YouTube DOM selector lives in `extension/src/selectors.ts`.** Never inline one.
2. **Fail open**: if an adapter can't inject, call `reportFailure(surface)` - it unhides
   real YouTube and badges the toolbar icon. Never leave a blank page.
3. Adapters re-run on the `yt-navigate-finish` SPA event; an adapter may return a
   cleanup function, called before the next route.
4. Injected element ids are prefixed `lc-`.
5. Feed logic (`feed.ts`) is pure and deterministic (seeded by date+profile) - keep it
   testable without `chrome.*`.

## Commands

- `npm test` - all unit tests (vitest; DOM tests use `// @vitest-environment jsdom`)
- `npm run typecheck` - tsc over both workspaces
- `npm run build -w extension` - build unpacked extension into `extension/dist`
- `YT_API_KEY=... npm run build -w catalog-pipeline` - build catalog locally
- `npm run e2e -w extension` - Playwright canary vs live YouTube (flaky by nature; a
  selector-drift alarm, not a CI gate)

## When YouTube breaks the extension

Symptoms: red `!` badge, or real recommendations visible. Fix: update the drifted
selector in `selectors.ts`, run the e2e canary, done. Selectors are container-level on
purpose - prefer broad slow-churn selectors over deep brittle ones.
```

- [ ] **Step 3: Verify docs read correctly**

Run: `npx prettier --check README.md AGENTS.md || true` (formatting only; fix anything that looks broken in preview)

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: plain-language README and AGENTS guide"
```

---

## Done criteria

- `npm test` green; `npm run typecheck` green; `npm run build` green.
- Manual: homepage/watch/search/Shorts behave per spec with the unpacked extension.
- A push editing `catalog.yaml` triggers the Action and updates the published catalog.
- README quick-start is followable by a non-expert parent.
