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

/**
 * Today's date as YYYY-MM-DD in the *viewer's local* timezone. Watch history
 * buckets (and the daily screen-time check) key off this so "today" lines up
 * with the parent's wall clock — an evening watch in the Americas must not
 * spill into tomorrow's UTC bucket. feed.ts's todayStr() stays UTC for
 * deterministic feed rotation; only history keys off the local day.
 */
export function localDayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

/**
 * Whether today's watch time has reached the parent's daily screen-time
 * limit. A null/0/negative limit means "no limit" (never over) - prefs.ts
 * uses null for "not set", and 0/negative are treated the same way rather
 * than trapping a kid at zero seconds from a bad/placeholder value.
 */
export function isOverLimit(screenTimeMinutes: number | null, secondsWatchedToday: number): boolean {
  if (screenTimeMinutes === null || screenTimeMinutes <= 0) return false;
  return secondsWatchedToday >= screenTimeMinutes * 60;
}

/**
 * Formats a seconds duration for the parent panel as "H h M m" (or just
 * "M m" under an hour) - minutes are floored, never rounded up, so the
 * display never claims more watch time than was actually recorded.
 */
export function formatHours(sec: number): string {
  const totalMin = Math.floor(sec / 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hours > 0 ? `${hours} h ${mins} m` : `${mins} m`;
}

/** ISO date `daysAgo` days before `dateStr` (both day-granular, UTC). */
function dateBefore(dateStr: string, daysAgo: number): string {
  const t = new Date(dateStr).getTime() - daysAgo * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Sum of the last 7 daily buckets ending on (and including) `dateStr`. */
export function weekTotalSec(h: WatchHistory, dateStr: string): number {
  let total = 0;
  for (let i = 0; i < 7; i++) total += h.daily[dateBefore(dateStr, i)] ?? 0;
  return total;
}

export interface RecentVideo extends VideoWatch {
  id: string;
}

/**
 * The `limit` most-recently-watched videos, newest first. Same ordering
 * rule as feed.ts's splitWatched: lastWatchedAt is day-granular, so
 * same-day entries tie, and Array.prototype.sort's stability keeps ties in
 * Object.entries' insertion order rather than needing a secondary key.
 */
export function recentVideos(h: WatchHistory, limit: number): RecentVideo[] {
  return Object.entries(h.videos)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (a.lastWatchedAt > b.lastWatchedAt ? -1 : a.lastWatchedAt < b.lastWatchedAt ? 1 : 0))
    .slice(0, limit);
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
