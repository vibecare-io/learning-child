import { matchesBlockedKeyword } from "../../shared/safety";
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

export interface DroppedVideo {
  id: string;
  title: string;
  reason: string;
}

export function expandCatalog(
  config: Config,
  fetched: FetchedSource[],
  generatedAt: string,
): { catalog: Catalog; dropped: DroppedVideo[] } {
  const byId = new Map<string, CatalogVideo>();
  const dropped: DroppedVideo[] = [];
  const droppedIds = new Set<string>();
  for (const { source, videos } of fetched) {
    const kept: VideoData[] = [];
    for (const v of videos) {
      if (v.durationSec < config.minDurationSec) continue;
      if (config.safety.excludeVideos.includes(v.id)) {
        if (!droppedIds.has(v.id)) {
          droppedIds.add(v.id);
          dropped.push({ id: v.id, title: v.title, reason: "excluded by exclude_videos" });
        }
        continue;
      }
      const keyword = matchesBlockedKeyword(v.title, config.safety.blockedKeywords);
      if (keyword) {
        if (!droppedIds.has(v.id)) {
          droppedIds.add(v.id);
          dropped.push({ id: v.id, title: v.title, reason: `blocked keyword "${keyword}"` });
        }
        continue;
      }
      kept.push(v);
      if (kept.length >= source.maxVideos) break;
    }
    for (const v of kept) {
      const existing = byId.get(v.id);
      if (existing) {
        existing.topics = [...new Set([...existing.topics, ...source.topics])];
        existing.profiles = [...new Set([...existing.profiles, ...source.profiles])];
        if (source.supervision && !existing.flags) existing.flags = ["supervision"];
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
        ...(source.supervision ? { flags: ["supervision"] } : {}),
        thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      });
    }
  }
  return {
    catalog: { version: 1, generatedAt, profiles: config.profiles, videos: [...byId.values()] },
    dropped,
  };
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
