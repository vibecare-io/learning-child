import { describe, expect, it } from "vitest";
import type { Catalog } from "./types";

describe("shared types", () => {
  it("catalog shape compiles and is usable", () => {
    const catalog: Catalog = {
      version: 1,
      generatedAt: "2026-07-26T00:00:00Z",
      profiles: { little: { label: "Ages 3-7" } },
      videos: [
        {
          id: "abc123xyz00",
          title: "How stars are born",
          channel: "Space Kids",
          channelId: "UC0000000000000000000000",
          durationSec: 300,
          publishedAt: "2026-07-01T00:00:00Z",
          topics: ["space"],
          profiles: ["little"],
          thumbnail: "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg"
        }
      ]
    };
    expect(catalog.videos[0].topics).toContain("space");
  });
});
