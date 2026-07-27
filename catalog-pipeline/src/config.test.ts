import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const VALID = `
profiles:
  little: { label: "Ages 3-7" }
  big:    { label: "Ages 8-12" }
sources:
  - channel: "@veritasium"
    topics: [science]
    profiles: [big]
  - playlist: "PLtest123"
    topics: [music]
  - video: "abc123xyz00"
    topics: [space]
    profiles: [big]
    max_videos: 1
search_only_channels:
  - "@scishowkids"
`;

describe("parseConfig", () => {
  it("parses sources with kind, defaults and profile fallback", () => {
    const config = parseConfig(VALID);
    expect(config.sources).toHaveLength(3);
    expect(config.sources[0]).toEqual({
      kind: "channel", ref: "@veritasium", topics: ["science"],
      profiles: ["big"], maxVideos: 50, supervision: false
    });
    // profiles omitted -> all profiles
    expect(config.sources[1].profiles).toEqual(["little", "big"]);
    expect(config.sources[2].maxVideos).toBe(1);
    expect(config.searchOnlyChannels).toEqual(["@scishowkids"]);
    expect(config.minDurationSec).toBe(120);
  });

  it("rejects a source with no channel/playlist/video key", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources:
  - topics: [science]
`)).toThrow(/exactly one of/i);
  });

  it("rejects unknown profile references", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources:
  - channel: "@a"
    profiles: [teenager]
`)).toThrow(/unknown profile/i);
  });

  it("rejects missing profiles section", () => {
    expect(() => parseConfig(`sources: []`)).toThrow(/profiles/i);
  });

  it("allows overriding min_duration_sec", () => {
    const config = parseConfig(`
profiles: { little: { label: "x" } }
min_duration_sec: 60
sources: []
`);
    expect(config.minDurationSec).toBe(60);
  });

  it("rejects non-array sources", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources: "not-an-array"
`)).toThrow(/must be a list/i);
  });

  it("rejects string max_videos", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
sources:
  - channel: "@a"
    max_videos: "ten"
`)).toThrow(/max_videos/i);
  });

  it("rejects string min_duration_sec", () => {
    expect(() => parseConfig(`
profiles: { little: { label: "x" } }
min_duration_sec: "sixty"
sources: []
`)).toThrow(/min_duration_sec/i);
  });

  it("parses safety block and per-source supervision", () => {
    const config = parseConfig(`
profiles: { big: { label: "x" } }
safety:
  blocked_keywords: [exploding, "do not try"]
  exclude_videos: [XZ6j5-nBFyc]
sources:
  - channel: "@markrober"
    supervision: true
`);
    expect(config.safety).toEqual({
      blockedKeywords: ["exploding", "do not try"],
      excludeVideos: ["XZ6j5-nBFyc"],
    });
    expect(config.sources[0].supervision).toBe(true);
  });

  it("defaults safety to empty lists and supervision to false", () => {
    const config = parseConfig(`
profiles: { big: { label: "x" } }
sources:
  - channel: "@a"
`);
    expect(config.safety).toEqual({ blockedKeywords: [], excludeVideos: [] });
    expect(config.sources[0].supervision).toBe(false);
  });

  it("rejects a non-list blocked_keywords", () => {
    expect(() => parseConfig(`
profiles: { big: { label: "x" } }
safety: { blocked_keywords: "exploding" }
sources: []
`)).toThrow(/blocked_keywords/);
  });
});
