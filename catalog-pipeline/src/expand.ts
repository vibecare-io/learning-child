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
