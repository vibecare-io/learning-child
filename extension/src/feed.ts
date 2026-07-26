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
