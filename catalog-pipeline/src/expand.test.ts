import { describe, expect, it } from "vitest";
import { expandCatalog, buildAllowed, type FetchedSource, type VideoData } from "./expand";
import type { Config, Source } from "./config";

const config: Config = {
  profiles: { little: { label: "Ages 3-7" }, big: { label: "Ages 8-12" } },
  sources: [],
  searchOnlyChannels: [],
  minDurationSec: 120,
};

function video(over: Partial<VideoData>): VideoData {
  return {
    id: "v1", title: "T", channelTitle: "Chan", channelId: "UC1",
    durationSec: 300, publishedAt: "2026-07-01T00:00:00Z", ...over,
  };
}

function source(over: Partial<Source>): Source {
  return { kind: "channel", ref: "@c", topics: [], profiles: ["big"], maxVideos: 50, ...over };
}

describe("expandCatalog", () => {
  it("tags videos with source topics/profiles and builds thumbnails", () => {
    const fetched: FetchedSource[] = [
      { source: source({ topics: ["science"] }), videos: [video({ id: "aaa" })] },
    ];
    const catalog = expandCatalog(config, fetched, "2026-07-26T00:00:00Z");
    expect(catalog.version).toBe(1);
    expect(catalog.videos).toHaveLength(1);
    expect(catalog.videos[0]).toMatchObject({
      id: "aaa", topics: ["science"], profiles: ["big"],
      thumbnail: "https://i.ytimg.com/vi/aaa/hqdefault.jpg",
    });
  });

  it("drops videos shorter than minDurationSec", () => {
    const fetched: FetchedSource[] = [
      { source: source({}), videos: [video({ id: "short1", durationSec: 45 }), video({ id: "ok1" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos.map((v) => v.id)).toEqual(["ok1"]);
  });

  it("caps videos per source at maxVideos", () => {
    const vids = Array.from({ length: 5 }, (_, i) => video({ id: `v${i}` }));
    const fetched: FetchedSource[] = [{ source: source({ maxVideos: 3 }), videos: vids }];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos).toHaveLength(3);
  });

  it("dedupes across sources keeping the union of topics and profiles", () => {
    const fetched: FetchedSource[] = [
      { source: source({ topics: ["science"], profiles: ["big"] }), videos: [video({ id: "dup" })] },
      { source: source({ kind: "playlist", topics: ["space"], profiles: ["little"] }), videos: [video({ id: "dup" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    expect(catalog.videos).toHaveLength(1);
    expect(catalog.videos[0].topics.sort()).toEqual(["science", "space"]);
    expect(catalog.videos[0].profiles.sort()).toEqual(["big", "little"]);
  });
});

describe("buildAllowed", () => {
  it("collects channel ids from catalog plus resolved extras, handles lowercased", () => {
    const fetched: FetchedSource[] = [
      { source: source({}), videos: [video({ id: "a", channelId: "UC1" }), video({ id: "b", channelId: "UC2" })] },
    ];
    const catalog = expandCatalog(config, fetched, "x");
    const allowed = buildAllowed(catalog, [
      { channelId: "UC1", handle: "@Veritasium" },
      { channelId: "UC9", handle: "@SciShowKids" },
    ]);
    expect(allowed.channelIds.sort()).toEqual(["UC1", "UC2", "UC9"]);
    expect(allowed.handles.sort()).toEqual(["@scishowkids", "@veritasium"]);
  });
});
