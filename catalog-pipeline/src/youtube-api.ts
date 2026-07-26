import type { VideoData } from "./expand";

const API = "https://www.googleapis.com/youtube/v3";

export interface ResolvedChannel {
  channelId: string;
  uploadsPlaylistId: string;
  handle?: string;
}

export interface YouTubeClient {
  resolveChannel(ref: string): Promise<ResolvedChannel>;
  listPlaylistVideoIds(playlistId: string, max: number): Promise<string[]>;
  getVideos(ids: string[]): Promise<VideoData[]>;
}

export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => (x ? parseInt(x, 10) : 0)) as unknown as number[];
  return d * 86400 + h * 3600 + min * 60 + s;
}

export class YouTubeApiClient implements YouTubeClient {
  constructor(private apiKey: string) {}

  private async get(path: string, params: Record<string, string>): Promise<any> {
    const url = new URL(`${API}/${path}`);
    for (const [k, v] of Object.entries({ ...params, key: this.apiKey })) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${path} failed: ${res.status ?? "network error"}`);
    return res.json();
  }

  async resolveChannel(ref: string): Promise<ResolvedChannel> {
    const params: Record<string, string> = { part: "snippet,contentDetails" };
    if (ref.startsWith("@")) params.forHandle = ref;
    else params.id = ref;
    const data = await this.get("channels", params);
    const item = data.items?.[0];
    if (!item) throw new Error(`Channel not found: ${ref}`);
    return {
      channelId: item.id,
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      handle: item.snippet?.customUrl,
    };
  }

  async listPlaylistVideoIds(playlistId: string, max: number): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < max) {
      const data = await this.get("playlistItems", {
        part: "contentDetails",
        playlistId,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const item of data.items ?? []) ids.push(item.contentDetails.videoId);
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return ids.slice(0, max);
  }

  async getVideos(ids: string[]): Promise<VideoData[]> {
    const out: VideoData[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const data = await this.get("videos", {
        part: "snippet,contentDetails",
        id: chunk.join(","),
      });
      for (const item of data.items ?? []) {
        out.push({
          id: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          durationSec: parseIsoDuration(item.contentDetails.duration),
          publishedAt: item.snippet.publishedAt,
        });
      }
    }
    return out;
  }
}
