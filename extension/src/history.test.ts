import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_HISTORY,
  accumulate,
  getHistory,
  isOverLimit,
  isWatched,
  pruneHistory,
  recordTick,
  secondsToday,
  type WatchHistory,
} from "./history";

const META = { title: "Calm nature walk", channel: "Nature Co" };

describe("accumulate", () => {
  it("adds seconds to a new video and records lastWatchedAt + daily bucket", () => {
    const next = accumulate(EMPTY_HISTORY, "v1", META, 30, "2026-07-01");
    expect(next.videos.v1).toEqual({
      title: "Calm nature walk",
      channel: "Nature Co",
      lastWatchedAt: "2026-07-01",
      totalSec: 30,
    });
    expect(next.daily["2026-07-01"]).toBe(30);
  });

  it("accumulates seconds for a video already in history and bumps lastWatchedAt", () => {
    const h: WatchHistory = {
      videos: { v1: { title: "Old title", channel: "Old", lastWatchedAt: "2026-06-01", totalSec: 20 } },
      daily: { "2026-06-01": 20 },
    };
    const next = accumulate(h, "v1", META, 15, "2026-07-01");
    expect(next.videos.v1).toEqual({
      title: "Calm nature walk",
      channel: "Nature Co",
      lastWatchedAt: "2026-07-01",
      totalSec: 35,
    });
    // Daily is bucketed per-day, not merged into the old day.
    expect(next.daily["2026-06-01"]).toBe(20);
    expect(next.daily["2026-07-01"]).toBe(15);
  });

  it("adds to the same daily bucket across multiple videos watched the same day", () => {
    const h = accumulate(EMPTY_HISTORY, "v1", META, 30, "2026-07-01");
    const next = accumulate(h, "v2", META, 10, "2026-07-01");
    expect(next.daily["2026-07-01"]).toBe(40);
  });

  it("does not mutate the history passed in", () => {
    const h = accumulate(EMPTY_HISTORY, "v1", META, 5, "2026-07-01");
    const frozenVideos = JSON.stringify(h.videos);
    const frozenDaily = JSON.stringify(h.daily);
    accumulate(h, "v1", META, 5, "2026-07-01");
    expect(JSON.stringify(h.videos)).toBe(frozenVideos);
    expect(JSON.stringify(h.daily)).toBe(frozenDaily);
  });
});

describe("pruneHistory", () => {
  it("drops video entries older than 90 days and keeps fresh ones", () => {
    const h: WatchHistory = {
      videos: {
        old: { title: "t", channel: "c", lastWatchedAt: "2026-01-01", totalSec: 100 },
        fresh: { title: "t", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100 },
      },
      daily: {},
    };
    const next = pruneHistory(h, "2026-07-26");
    expect(Object.keys(next.videos)).toEqual(["fresh"]);
  });

  it("drops daily buckets older than 90 days and keeps fresh ones", () => {
    const h: WatchHistory = {
      videos: {},
      daily: { "2026-01-01": 60, "2026-07-20": 60 },
    };
    const next = pruneHistory(h, "2026-07-26");
    expect(Object.keys(next.daily)).toEqual(["2026-07-20"]);
  });

  it("respects a custom maxAgeDays", () => {
    const h: WatchHistory = {
      videos: { v: { title: "t", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 10 } },
      daily: {},
    };
    expect(Object.keys(pruneHistory(h, "2026-07-26", 3).videos)).toEqual([]);
    expect(Object.keys(pruneHistory(h, "2026-07-26", 10).videos)).toEqual(["v"]);
  });
});

describe("isWatched", () => {
  const historyWith = (totalSec: number): WatchHistory => ({
    videos: { v: { title: "t", channel: "c", lastWatchedAt: "2026-07-26", totalSec } },
    daily: {},
  });

  it("59s of a 1000s video is not watched", () => {
    expect(isWatched(historyWith(59), "v", 1000)).toBe(false);
  });

  it("60s of any video is watched (absolute floor)", () => {
    expect(isWatched(historyWith(60), "v", 1000)).toBe(true);
  });

  it("30s of a 100s video is watched (25% threshold)", () => {
    expect(isWatched(historyWith(30), "v", 100)).toBe(true);
  });

  it("a video with no history is not watched", () => {
    expect(isWatched(EMPTY_HISTORY, "missing", 1000)).toBe(false);
  });
});

describe("secondsToday", () => {
  it("returns 0 for a day with no recorded seconds", () => {
    expect(secondsToday(EMPTY_HISTORY, "2026-07-26")).toBe(0);
  });

  it("returns the recorded seconds for a day that has them", () => {
    const h: WatchHistory = { videos: {}, daily: { "2026-07-26": 42 } };
    expect(secondsToday(h, "2026-07-26")).toBe(42);
  });
});

describe("isOverLimit", () => {
  it("is never over limit when screenTimeMinutes is null (no limit set)", () => {
    expect(isOverLimit(null, 999_999)).toBe(false);
  });

  it("is never over limit when screenTimeMinutes is 0 (treated as no limit)", () => {
    expect(isOverLimit(0, 999_999)).toBe(false);
  });

  it("is never over limit when screenTimeMinutes is negative", () => {
    expect(isOverLimit(-5, 999_999)).toBe(false);
  });

  it("is not over limit while under the threshold", () => {
    expect(isOverLimit(30, 30 * 60 - 1)).toBe(false);
  });

  it("is over limit exactly at the threshold", () => {
    expect(isOverLimit(30, 30 * 60)).toBe(true);
  });

  it("is over limit once past the threshold", () => {
    expect(isOverLimit(30, 30 * 60 + 1)).toBe(true);
  });
});

describe("getHistory", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns EMPTY_HISTORY when nothing is stored", async () => {
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({})) } } });
    expect(await getHistory()).toEqual(EMPTY_HISTORY);
  });

  it("merges stored watchHistory over the default", async () => {
    const stored: WatchHistory = {
      videos: { v1: { title: "t", channel: "c", lastWatchedAt: "2026-07-26", totalSec: 10 } },
      daily: { "2026-07-26": 10 },
    };
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({ watchHistory: stored })) } } });
    expect(await getHistory()).toEqual(stored);
  });
});

describe("recordTick", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads current history, accumulates + prunes, then writes the result back", async () => {
    const stored: WatchHistory = {
      videos: {
        v1: { title: "Old", channel: "c", lastWatchedAt: "2026-06-01", totalSec: 10 },
        stale: { title: "s", channel: "c", lastWatchedAt: "2026-01-01", totalSec: 500 },
      },
      daily: { "2026-06-01": 10, "2026-01-01": 500 },
    };
    const get = vi.fn(async () => ({ watchHistory: stored }));
    const set = vi.fn(async (_items: Record<string, unknown>) => {});
    vi.stubGlobal("chrome", { storage: { local: { get, set } } });

    await recordTick("v1", META, 5, "2026-07-26");

    expect(get).toHaveBeenCalledWith("watchHistory");
    expect(set).toHaveBeenCalledTimes(1);
    const written = set.mock.calls[0]![0]!.watchHistory as WatchHistory;
    expect(written.videos.v1).toEqual({
      title: "Calm nature walk",
      channel: "Nature Co",
      lastWatchedAt: "2026-07-26",
      totalSec: 15,
    });
    // stale (>90d before 2026-07-26) entry is pruned away on write.
    expect(written.videos.stale).toBeUndefined();
    expect(written.daily["2026-01-01"]).toBeUndefined();
  });
});
