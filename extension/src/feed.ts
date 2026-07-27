import type { Catalog, CatalogVideo } from "../../shared/types";
import { isWatched, type WatchHistory } from "./history";

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

/**
 * Splits `videos` into unwatched (kept in input order) and watched
 * (per `isWatched`), the latter sorted newest-watched-first by
 * `lastWatchedAt`. `lastWatchedAt` is only day-granular, so same-day
 * entries tie; Array.prototype.sort is a stable sort (guaranteed since
 * ES2019), so ties keep their relative input order rather than needing
 * an explicit secondary key.
 */
export function splitWatched(
  videos: CatalogVideo[],
  history: WatchHistory,
): { unwatched: CatalogVideo[]; watched: CatalogVideo[] } {
  const unwatched: CatalogVideo[] = [];
  const watched: CatalogVideo[] = [];
  for (const v of videos) {
    (isWatched(history, v.id, v.durationSec) ? watched : unwatched).push(v);
  }
  watched.sort((a, b) => {
    const aDate = history.videos[a.id]!.lastWatchedAt;
    const bDate = history.videos[b.id]!.lastWatchedAt;
    if (aDate > bDate) return -1;
    if (aDate < bDate) return 1;
    return 0;
  });
  return { unwatched, watched };
}

/** Floor for the main grid: it must never look empty while the catalog has videos. */
export const MIN_GRID = 12;

/**
 * Tops `unwatched` up to `min` by pulling from the tail of `watched` (the
 * least-recently-watched videos, since `watched` is sorted newest-first) -
 * so freshly rewatched videos are held back longest. If `watched` can't
 * cover the shortfall, the grid just ends up shorter than `min`; it's only
 * ever empty when both lists are empty (i.e. the catalog itself is empty).
 */
export function backfill(
  unwatched: CatalogVideo[],
  watched: CatalogVideo[],
  min: number = MIN_GRID,
): { grid: CatalogVideo[]; watchedRest: CatalogVideo[] } {
  const needed = min - unwatched.length;
  if (needed <= 0) return { grid: unwatched, watchedRest: watched };
  const takeCount = Math.min(needed, watched.length);
  const splitAt = watched.length - takeCount;
  const toBackfill = watched.slice(splitAt);
  const watchedRest = watched.slice(0, splitAt);
  return { grid: [...unwatched, ...toBackfill], watchedRest };
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
