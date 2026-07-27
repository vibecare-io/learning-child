import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_HISTORY,
  accumulate,
  formatHours,
  formatWatch,
  getHistory,
  isOverLimit,
  isWatched,
  localDayStr,
  pruneHistory,
  recentVideos,
  recordTick,
  secondsToday,
  weekTotalSec,
  type WatchHistory,
} from "./history";

const META = { title: "Calm nature walk", channel: "Nature Co" };

describe("formatWatch", () => {
  it("shows seconds under a minute so the live total visibly ticks", () => {
    expect(formatWatch(0)).toBe("0 s");
    expect(formatWatch(45)).toBe("45 s");
  });
  it("shows M m S s under an hour", () => {
    expect(formatWatch(60)).toBe("1 m 00 s");
    expect(formatWatch(380)).toBe("6 m 20 s");
  });
  it("drops seconds past an hour", () => {
    expect(formatWatch(3600)).toBe("1 h 00 m");
    expect(formatWatch(3600 + 5 * 60 + 30)).toBe("1 h 05 m");
  });
});

describe("localDayStr", () => {
  it("formats the local calendar day as YYYY-MM-DD (not UTC)", () => {
    // Late evening local time — a UTC slice could roll to the next day, but
    // localDayStr must stay on the local date.
    expect(localDayStr(new Date(2026, 6, 27, 22, 30))).toBe("2026-07-27");
    expect(localDayStr(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });
});

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

    await recordTick("v1", META, 5, "2026-07-26", 1_700_000_000_000);

    expect(get).toHaveBeenCalledWith("watchHistory");
    expect(set).toHaveBeenCalledTimes(1);
    const written = set.mock.calls[0]![0]!.watchHistory as WatchHistory;
    expect(written.videos.v1).toEqual({
      title: "Calm nature walk",
      channel: "Nature Co",
      lastWatchedAt: "2026-07-26",
      totalSec: 15,
      lastWatchedTs: 1_700_000_000_000,
    });
    // stale (>90d before 2026-07-26) entry is pruned away on write.
    expect(written.videos.stale).toBeUndefined();
    expect(written.daily["2026-01-01"]).toBeUndefined();
  });
});

describe("formatHours", () => {
  it("formats 0 seconds as 0 m", () => {
    expect(formatHours(0)).toBe("0 m");
  });

  it("floors seconds under a minute to 0 m", () => {
    expect(formatHours(59)).toBe("0 m");
  });

  it("floors partial minutes rather than rounding up", () => {
    expect(formatHours(125)).toBe("2 m");
  });

  it("formats a whole number of minutes under an hour", () => {
    expect(formatHours(1440)).toBe("24 m");
  });

  it("formats hours and minutes together", () => {
    expect(formatHours(5040)).toBe("1 h 24 m");
  });

  it("formats an exact hour with a trailing 0 m", () => {
    expect(formatHours(3600)).toBe("1 h 0 m");
  });
});

describe("weekTotalSec", () => {
  it("sums the last 7 daily keys including today", () => {
    const h: WatchHistory = {
      videos: {},
      daily: {
        "2026-07-26": 100, // today
        "2026-07-25": 200, // 1 day ago
        "2026-07-20": 300, // 6 days ago - last day still in the window
        "2026-07-19": 999, // 7 days ago - just outside the window
      },
    };
    expect(weekTotalSec(h, "2026-07-26")).toBe(600);
  });

  it("returns 0 when there's no history in the window", () => {
    expect(weekTotalSec(EMPTY_HISTORY, "2026-07-26")).toBe(0);
  });
});

describe("recentVideos", () => {
  it("returns videos newest-watched first, limited to the given count", () => {
    const h: WatchHistory = {
      videos: {
        old: { title: "Old", channel: "c", lastWatchedAt: "2026-07-01", totalSec: 100 },
        newest: { title: "Newest", channel: "c", lastWatchedAt: "2026-07-25", totalSec: 100 },
        mid: { title: "Mid", channel: "c", lastWatchedAt: "2026-07-15", totalSec: 100 },
      },
      daily: {},
    };
    expect(recentVideos(h, 2).map((v) => v.id)).toEqual(["newest", "mid"]);
  });

  it("orders same-day entries by lastWatchedTs (real recency), newest first", () => {
    const h: WatchHistory = {
      videos: {
        first: { title: "First", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100, lastWatchedTs: 1000 },
        latest: { title: "Latest", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100, lastWatchedTs: 3000 },
        mid: { title: "Mid", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100, lastWatchedTs: 2000 },
      },
      daily: {},
    };
    expect(recentVideos(h, 10).map((v) => v.id)).toEqual(["latest", "mid", "first"]);
  });

  it("keeps relative input (insertion) order for same-day (tie) entries", () => {
    const h: WatchHistory = {
      videos: {
        b: { title: "B", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100 },
        a: { title: "A", channel: "c", lastWatchedAt: "2026-07-20", totalSec: 100 },
      },
      daily: {},
    };
    expect(recentVideos(h, 10).map((v) => v.id)).toEqual(["b", "a"]);
  });

  it("carries the video id and full VideoWatch fields through", () => {
    const h: WatchHistory = {
      videos: { v1: { title: "T", channel: "C", lastWatchedAt: "2026-07-20", totalSec: 42 } },
      daily: {},
    };
    expect(recentVideos(h, 10)).toEqual([{ id: "v1", title: "T", channel: "C", lastWatchedAt: "2026-07-20", totalSec: 42 }]);
  });

  it("returns an empty array when there's no history", () => {
    expect(recentVideos(EMPTY_HISTORY, 10)).toEqual([]);
  });
});
