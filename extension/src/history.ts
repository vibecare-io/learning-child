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
  // Epoch ms of the last tick. lastWatchedAt is only day-granular, so it can't
  // order videos watched on the same day; this does. Optional for back-compat
  // with entries written before it existed (they fall back to lastWatchedAt).
  lastWatchedTs?: number;
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

/**
 * Fine-grained watch-time label for the live "watched today/this week" totals:
 * seconds under a minute, "M m S s" under an hour, "H h M m" beyond. Unlike
 * formatHours (whole minutes) this ticks every few-second recorder write, so
 * the stat visibly updates in real time instead of appearing frozen for up to
 * a minute. Seconds are dropped past an hour to avoid pointless jitter.
 */
export function formatWatch(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} s`;
  const totalMin = Math.floor(s / 60);
  if (totalMin < 60) return `${totalMin} m ${String(s % 60).padStart(2, "0")} s`;
  const hours = Math.floor(totalMin / 60);
  return `${hours} h ${String(totalMin % 60).padStart(2, "0")} m`;
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
 * The `limit` most-recently-watched videos, newest first. Orders by the
 * real-time lastWatchedTs so the video playing right now bubbles to the top
 * even against others watched earlier the same day; entries predating that
 * field fall back to lastWatchedAt (day-granular). Ties keep Object.entries'
 * insertion order via Array.prototype.sort's stability.
 */
export function recentVideos(h: WatchHistory, limit: number): RecentVideo[] {
  const recency = (v: VideoWatch): number => v.lastWatchedTs ?? (Date.parse(v.lastWatchedAt) || 0);
  return Object.entries(h.videos)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => recency(b) - recency(a))
    .slice(0, limit);
}

/** The only storage writer for history: read -> accumulate -> prune -> write. */
export async function recordTick(
  videoId: string,
  meta: { title: string; channel: string },
  seconds: number,
  dateStr: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const current = await getHistory();
  const acc = accumulate(current, videoId, meta, seconds, dateStr);
  // Stamp the real-time recency marker so recentVideos can order same-day
  // watches (see VideoWatch.lastWatchedTs / recentVideos).
  acc.videos[videoId] = { ...acc.videos[videoId]!, lastWatchedTs: nowMs };
  const next = pruneHistory(acc, dateStr);
  await chrome.storage.local.set({ [KEY]: next });
}
