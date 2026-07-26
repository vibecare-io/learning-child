export interface CatalogVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  durationSec: number;
  publishedAt: string;
  topics: string[];
  profiles: string[];
  thumbnail: string;
}

export interface Catalog {
  version: 1;
  generatedAt: string;
  profiles: Record<string, { label: string }>;
  videos: CatalogVideo[];
}

export interface AllowedChannels {
  channelIds: string[];
  /** lowercase, including the leading "@" */
  handles: string[];
}
