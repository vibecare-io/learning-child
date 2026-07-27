import { describe, expect, it } from "vitest";
import { MIN_GRID, backfill, dailyFeed, seededShuffle, splitWatched, upNext } from "./feed";
import type { Catalog, CatalogVideo } from "../../shared/types";
import { EMPTY_HISTORY, type WatchHistory } from "./history";

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

function historyWith(entries: Record<string, { lastWatchedAt: string; totalSec: number }>): WatchHistory {
  const videos = Object.fromEntries(
    Object.entries(entries).map(([id, e]) => [id, { title: "t", channel: "c", ...e }]),
  );
  return { ...EMPTY_HISTORY, videos };
}

describe("splitWatched", () => {
  it("keeps unwatched videos in their original input order", () => {
    const videos = [vid({ id: "v1" }), vid({ id: "v2" }), vid({ id: "v3" })];
    const { unwatched, watched } = splitWatched(videos, EMPTY_HISTORY);
    expect(unwatched.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
    expect(watched).toEqual([]);
  });

  it("sorts watched videos by lastWatchedAt descending (newest-watched first)", () => {
    const videos = [vid({ id: "old" }), vid({ id: "new" }), vid({ id: "mid" }), vid({ id: "unwatched" })];
    const history = historyWith({
      old: { lastWatchedAt: "2026-07-01", totalSec: 200 },
      new: { lastWatchedAt: "2026-07-25", totalSec: 200 },
      mid: { lastWatchedAt: "2026-07-15", totalSec: 200 },
    });
    const { unwatched, watched } = splitWatched(videos, history);
    expect(watched.map((v) => v.id)).toEqual(["new", "mid", "old"]);
    expect(unwatched.map((v) => v.id)).toEqual(["unwatched"]);
  });

  it("keeps relative input order for same-day (tie) lastWatchedAt entries", () => {
    // lastWatchedAt is day-granular, so two videos watched the same day tie -
    // splitWatched must not reorder them; it keeps their relative input order.
    const videos = [vid({ id: "b" }), vid({ id: "a" }), vid({ id: "c" })];
    const history = historyWith({
      b: { lastWatchedAt: "2026-07-20", totalSec: 200 },
      a: { lastWatchedAt: "2026-07-20", totalSec: 200 },
      c: { lastWatchedAt: "2026-07-20", totalSec: 200 },
    });
    const { watched } = splitWatched(videos, history);
    expect(watched.map((v) => v.id)).toEqual(["b", "a", "c"]);
  });

  it("uses isWatched's duration-relative threshold, not just presence in history", () => {
    const videos = [vid({ id: "barely", durationSec: 1000 })];
    // 59s of a 1000s video: below both the 60s floor and the 25% fraction -> not watched.
    const history = historyWith({ barely: { lastWatchedAt: "2026-07-20", totalSec: 59 } });
    const { unwatched, watched } = splitWatched(videos, history);
    expect(unwatched.map((v) => v.id)).toEqual(["barely"]);
    expect(watched).toEqual([]);
  });
});

describe("MIN_GRID", () => {
  it("is 12", () => {
    expect(MIN_GRID).toBe(12);
  });
});

describe("backfill", () => {
  it("returns unwatched unchanged when it already meets the minimum", () => {
    const unwatched = Array.from({ length: 12 }, (_, i) => vid({ id: `u${i}` }));
    const watched = [vid({ id: "w1" })];
    const { grid, watchedRest } = backfill(unwatched, watched);
    expect(grid.map((v) => v.id)).toEqual(unwatched.map((v) => v.id));
    expect(watchedRest).toEqual(watched);
  });

  it("appends the least-recently-watched (tail of watched) until the minimum is reached", () => {
    const unwatched = [vid({ id: "u1" }), vid({ id: "u2" })];
    // watched is sorted newest-watched-first by convention; tail = least-recently-watched.
    const watched = Array.from({ length: 5 }, (_, i) => vid({ id: `w${i}` })); // w0 newest .. w4 oldest
    const { grid, watchedRest } = backfill(unwatched, watched, 5);
    // needs 3 more; takes the 3 least-recently-watched (tail): w2, w3, w4
    expect(grid.map((v) => v.id)).toEqual(["u1", "u2", "w2", "w3", "w4"]);
    expect(watchedRest.map((v) => v.id)).toEqual(["w0", "w1"]);
  });

  it("never leaves the grid empty when the catalog has videos, even below the minimum", () => {
    const unwatched: CatalogVideo[] = [];
    const watched = [vid({ id: "w1" }), vid({ id: "w2" })];
    const { grid, watchedRest } = backfill(unwatched, watched, 12);
    expect(grid.map((v) => v.id)).toEqual(["w1", "w2"]);
    expect(watchedRest).toEqual([]);
  });

  it("returns an empty grid only when there are truly no videos at all", () => {
    const { grid } = backfill([], [], 12);
    expect(grid).toEqual([]);
  });

  it("respects a custom min", () => {
    const unwatched = [vid({ id: "u1" })];
    const watched = Array.from({ length: 5 }, (_, i) => vid({ id: `w${i}` }));
    const { grid } = backfill(unwatched, watched, 3);
    expect(grid.map((v) => v.id)).toEqual(["u1", "w3", "w4"]);
  });
});
