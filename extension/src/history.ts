// Per-video and per-day watch-history store.
//
// Backed by chrome.storage.local (key "watchHistory") - same storage-module
// shape as prefs.ts: a single key, merged over an EMPTY_HISTORY default, so
// it's readable from every extension context (content script recorder now,
// a future parent-panel activity view later). accumulate/pruneHistory/
// isWatched/secondsToday stay chrome-free and pure so they're trivially
// unit-testable and reusable by other adapters (e.g. a "hide watched" filter
// or a daily screen-time limit) without touching storage.

export interface VideoWatch {
  title: string;
  channel: string;
  lastWatchedAt: string;
  totalSec: number;
}

export interface WatchHistory {
  videos: Record<string, VideoWatch>;
  daily: Record<string, number>;
}

export const EMPTY_HISTORY: WatchHistory = { videos: {}, daily: {} };

const KEY = "watchHistory";
const MAX_AGE_DAYS = 90;

// A video counts as "watched" once the kid has spent at least a minute on it,
// or a quarter of its runtime - whichever is easier to clear for short videos.
const WATCHED_MIN_SEC = 60;
const WATCHED_FRACTION = 0.25;

export async function getHistory(): Promise<WatchHistory> {
  const { watchHistory } = await chrome.storage.local.get(KEY);
  return { ...EMPTY_HISTORY, ...(watchHistory as Partial<WatchHistory> | undefined) };
}

/**
 * Pure core of recordTick: folds `seconds` of watch time for `videoId` into
 * its per-video total (title/channel refreshed from `meta` each call) and
 * the per-day bucket for `dateStr`.
 */
export function accumulate(
  h: WatchHistory,
  videoId: string,
  meta: { title: string; channel: string },
  seconds: number,
  dateStr: string,
): WatchHistory {
  const priorTotal = h.videos[videoId]?.totalSec ?? 0;
  const video: VideoWatch = {
    title: meta.title,
    channel: meta.channel,
    lastWatchedAt: dateStr,
    totalSec: priorTotal + seconds,
  };
  return {
    videos: { ...h.videos, [videoId]: video },
    daily: { ...h.daily, [dateStr]: (h.daily[dateStr] ?? 0) + seconds },
  };
}

/**
 * Drops video entries whose lastWatchedAt, and daily buckets whose date key,
 * fall more than maxAgeDays before todayStr - keeps the store from growing
 * unbounded across months of use.
 */
export function pruneHistory(h: WatchHistory, todayStr: string, maxAgeDays = MAX_AGE_DAYS): WatchHistory {
  const cutoff = new Date(todayStr).getTime() - maxAgeDays * 86_400_000;
  const videos = Object.fromEntries(
    Object.entries(h.videos).filter(([, v]) => new Date(v.lastWatchedAt).getTime() >= cutoff),
  );
  const daily = Object.fromEntries(
    Object.entries(h.daily).filter(([day]) => new Date(day).getTime() >= cutoff),
  );
  return { videos, daily };
}

export function isWatched(h: WatchHistory, videoId: string, durationSec: number): boolean {
  const totalSec = h.videos[videoId]?.totalSec ?? 0;
  return totalSec >= WATCHED_MIN_SEC || totalSec >= WATCHED_FRACTION * durationSec;
}

export function secondsToday(h: WatchHistory, dateStr: string): number {
  return h.daily[dateStr] ?? 0;
}

/** The only storage writer for history: read -> accumulate -> prune -> write. */
export async function recordTick(
  videoId: string,
  meta: { title: string; channel: string },
  seconds: number,
  dateStr: string,
): Promise<void> {
  const current = await getHistory();
  const next = pruneHistory(accumulate(current, videoId, meta, seconds, dateStr), dateStr);
  await chrome.storage.local.set({ [KEY]: next });
}
