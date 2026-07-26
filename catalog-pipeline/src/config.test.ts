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
      profiles: ["big"], maxVideos: 50
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
});
