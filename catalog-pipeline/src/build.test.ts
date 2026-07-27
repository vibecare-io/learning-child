import { describe, expect, it } from "vitest";
import { runBuild } from "./build";
import { parseConfig } from "./config";
import type { ResolvedChannel, YouTubeClient } from "./youtube-api";
import type { VideoData } from "./expand";

const fakeVideos: Record<string, VideoData> = {
  s1: { id: "s1", title: "Science 1", channelTitle: "Veritasium", channelId: "UCver", durationSec: 600, publishedAt: "2026-06-01T00:00:00Z" },
  m1: { id: "m1", title: "Music 1", channelTitle: "MusicKids", channelId: "UCmus", durationSec: 240, publishedAt: "2026-05-01T00:00:00Z" },
  one: { id: "one", title: "One-off", channelTitle: "Solo", channelId: "UCsol", durationSec: 400, publishedAt: "2026-04-01T00:00:00Z" },
};

const fakeClient: YouTubeClient = {
  async resolveChannel(ref: string): Promise<ResolvedChannel> {
    if (ref === "@veritasium") return { channelId: "UCver", uploadsPlaylistId: "UUver", handle: "@veritasium" };
    if (ref === "@scishowkids") return { channelId: "UCsci", uploadsPlaylistId: "UUsci", handle: "@SciShowKids" };
    throw new Error(`unexpected ref ${ref}`);
  },
  async listPlaylistVideoIds(playlistId: string): Promise<string[]> {
    if (playlistId === "UUver") return ["s1"];
    if (playlistId === "PLmusic") return ["m1"];
    throw new Error(`unexpected playlist ${playlistId}`);
  },
  async getVideos(ids: string[]): Promise<VideoData[]> {
    return ids.map((id) => fakeVideos[id]).filter(Boolean);
  },
};

describe("runBuild", () => {
  it("assembles catalog and allowed channels from all source kinds", async () => {
    const config = parseConfig(`
profiles:
  big: { label: "Ages 8-12" }
sources:
  - channel: "@veritasium"
    topics: [science]
  - playlist: "PLmusic"
    topics: [music]
  - video: "one"
    topics: [space]
search_only_channels:
  - "@scishowkids"
`);
    const { catalog, allowed, dropped } = await runBuild(config, fakeClient, "2026-07-26T00:00:00Z");
    expect(catalog.videos.map((v) => v.id).sort()).toEqual(["m1", "one", "s1"]);
    expect(catalog.generatedAt).toBe("2026-07-26T00:00:00Z");
    expect(allowed.channelIds.sort()).toEqual(["UCmus", "UCsci", "UCsol", "UCver"]);
    expect(allowed.handles.sort()).toEqual(["@scishowkids", "@veritasium"]);
    expect(dropped).toEqual([]);
  });
});
