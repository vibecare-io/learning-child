import { parse } from "yaml";

export interface Source {
  kind: "channel" | "playlist" | "video";
  ref: string;
  topics: string[];
  profiles: string[];
  maxVideos: number;
}

export interface Config {
  profiles: Record<string, { label: string }>;
  sources: Source[];
  searchOnlyChannels: string[];
  minDurationSec: number;
}

const DEFAULT_MAX_VIDEOS = 50;
const DEFAULT_MIN_DURATION_SEC = 120;

export function parseConfig(yamlText: string): Config {
  const raw = parse(yamlText) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") throw new Error("catalog.yaml is empty or not a mapping");

  const profilesRaw = raw.profiles as Record<string, { label?: string }> | undefined;
  if (!profilesRaw || Object.keys(profilesRaw).length === 0) {
    throw new Error("catalog.yaml must define at least one entry under 'profiles'");
  }
  const profiles: Record<string, { label: string }> = {};
  for (const [id, p] of Object.entries(profilesRaw)) {
    profiles[id] = { label: p?.label ?? id };
  }
  const allProfiles = Object.keys(profiles);

  if (raw.sources != null && !Array.isArray(raw.sources)) {
    throw new Error("'sources' must be a list");
  }
  const sourcesRaw = (raw.sources ?? []) as Record<string, unknown>[];
  const sources: Source[] = sourcesRaw.map((s, i) => {
    const kinds = (["channel", "playlist", "video"] as const).filter((k) => s[k] != null);
    if (kinds.length !== 1) {
      throw new Error(`sources[${i}]: must have exactly one of channel/playlist/video`);
    }
    const kind = kinds[0];
    const sourceProfiles = (s.profiles as string[] | undefined) ?? allProfiles;
    for (const p of sourceProfiles) {
      if (!profiles[p]) throw new Error(`sources[${i}]: unknown profile '${p}'`);
    }
    const maxVideosVal = s.max_videos;
    if (maxVideosVal != null) {
      if (typeof maxVideosVal !== "number" || !Number.isFinite(maxVideosVal) || maxVideosVal <= 0) {
        throw new Error(`sources[${i}]: 'max_videos' must be a positive number`);
      }
    }
    return {
      kind,
      ref: String(s[kind]),
      topics: (s.topics as string[] | undefined) ?? [],
      profiles: sourceProfiles,
      maxVideos: maxVideosVal as number | undefined ?? DEFAULT_MAX_VIDEOS,
    };
  });

  const minDurationSecVal = raw.min_duration_sec;
  if (minDurationSecVal != null) {
    if (typeof minDurationSecVal !== "number" || !Number.isFinite(minDurationSecVal) || minDurationSecVal <= 0) {
      throw new Error("'min_duration_sec' must be a positive number");
    }
  }

  return {
    profiles,
    sources,
    searchOnlyChannels: (raw.search_only_channels as string[] | undefined) ?? [],
    minDurationSec: minDurationSecVal as number | undefined ?? DEFAULT_MIN_DURATION_SEC,
  };
}
