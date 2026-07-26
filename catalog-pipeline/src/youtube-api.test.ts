import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIsoDuration, YouTubeApiClient } from "./youtube-api";

describe("parseIsoDuration", () => {
  it("parses hours/minutes/seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT12M")).toBe(720);
    expect(parseIsoDuration("P1DT2H")).toBe(93600);
    expect(parseIsoDuration("garbage")).toBe(0);
  });
});

function mockJsonFetch(payloads: unknown[]) {
  let call = 0;
  const fn = vi.fn(async (_input: unknown) => ({
    ok: true,
    json: async () => payloads[call++],
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("YouTubeApiClient", () => {
  it("resolveChannel uses forHandle for @refs and id for UC refs", async () => {
    const fetchMock = mockJsonFetch([
      {
        items: [{
          id: "UCabc",
          snippet: { customUrl: "@veritasium" },
          contentDetails: { relatedPlaylists: { uploads: "UUabc" } },
        }],
      },
    ]);
    const client = new YouTubeApiClient("KEY");
    const ch = await client.resolveChannel("@veritasium");
    expect(ch).toEqual({ channelId: "UCabc", uploadsPlaylistId: "UUabc", handle: "@veritasium" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("forHandle=%40veritasium");
  });

  it("listPlaylistVideoIds follows pages until max", async () => {
    mockJsonFetch([
      { items: [{ contentDetails: { videoId: "a" } }, { contentDetails: { videoId: "b" } }], nextPageToken: "T" },
      { items: [{ contentDetails: { videoId: "c" } }] },
    ]);
    const client = new YouTubeApiClient("KEY");
    expect(await client.listPlaylistVideoIds("UUabc", 10)).toEqual(["a", "b", "c"]);
  });

  it("getVideos maps snippet + contentDetails to VideoData", async () => {
    mockJsonFetch([
      {
        items: [{
          id: "vid1",
          snippet: {
            title: "Stars", channelTitle: "Space", channelId: "UC9",
            publishedAt: "2026-01-01T00:00:00Z",
          },
          contentDetails: { duration: "PT10M" },
        }],
      },
    ]);
    const client = new YouTubeApiClient("KEY");
    expect(await client.getVideos(["vid1"])).toEqual([{
      id: "vid1", title: "Stars", channelTitle: "Space", channelId: "UC9",
      durationSec: 600, publishedAt: "2026-01-01T00:00:00Z",
    }]);
  });
});
