import { describe, expect, it } from "vitest";
import { dailyFeed, seededShuffle, upNext } from "./feed";
import type { Catalog, CatalogVideo } from "../../shared/types";

function vid(over: Partial<CatalogVideo>): CatalogVideo {
  return {
    id: "v", title: "T", channel: "C", channelId: "UC1", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"],
    thumbnail: "t", ...over,
  };
}

function makeCatalog(videos: CatalogVideo[]): Catalog {
  return { version: 1, generatedAt: "x", profiles: { little: { label: "l" }, big: { label: "b" } }, videos };
}

const many = Array.from({ length: 30 }, (_, i) => vid({ id: `v${i}` }));

describe("seededShuffle", () => {
  it("is deterministic for the same seed and different for different seeds", () => {
    const a = seededShuffle(many, "2026-07-26:big");
    const b = seededShuffle(many, "2026-07-26:big");
    const c = seededShuffle(many, "2026-07-27:big");
    expect(a.map((v) => v.id)).toEqual(b.map((v) => v.id));
    expect(a.map((v) => v.id)).not.toEqual(c.map((v) => v.id));
    expect(a).toHaveLength(30);
  });

  it("does not mutate its input", () => {
    const input = [...many];
    seededShuffle(input, "s");
    expect(input.map((v) => v.id)).toEqual(many.map((v) => v.id));
  });
});

describe("dailyFeed", () => {
  it("only includes videos for the profile", () => {
    const catalog = makeCatalog([
      vid({ id: "forBig", profiles: ["big"] }),
      vid({ id: "forLittle", profiles: ["little"] }),
    ]);
    const feed = dailyFeed(catalog, "little", "2026-07-26");
    expect(feed.map((v) => v.id)).toEqual(["forLittle"]);
  });

  it("front-loads up to 4 videos published in the last 30 days", () => {
    const catalog = makeCatalog([
      ...many,
      vid({ id: "fresh1", publishedAt: "2026-07-20T00:00:00Z" }),
      vid({ id: "fresh2", publishedAt: "2026-07-10T00:00:00Z" }),
    ]);
    const feed = dailyFeed(catalog, "big", "2026-07-26");
    expect(feed.slice(0, 2).map((v) => v.id).sort()).toEqual(["fresh1", "fresh2"]);
    expect(feed).toHaveLength(32);
  });
});

describe("upNext", () => {
  it("excludes the current video and ranks topic overlap first", () => {
    const catalog = makeCatalog([
      vid({ id: "current", topics: ["space"] }),
      vid({ id: "same1", topics: ["space"] }),
      vid({ id: "same2", topics: ["space", "science"] }),
      ...Array.from({ length: 20 }, (_, i) => vid({ id: `other${i}`, topics: ["music"] })),
    ]);
    const next = upNext(catalog, "big", "current", "2026-07-26", 5);
    expect(next).toHaveLength(5);
    expect(next.map((v) => v.id)).not.toContain("current");
    expect(next.slice(0, 2).map((v) => v.id).sort()).toEqual(["same1", "same2"]);
  });

  it("falls back to a shuffle when the current video is unknown", () => {
    const catalog = makeCatalog(many);
    const next = upNext(catalog, "big", "notInCatalog", "2026-07-26");
    expect(next).toHaveLength(15);
  });
});
