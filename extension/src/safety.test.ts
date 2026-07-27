import { afterEach, describe, expect, it, vi } from "vitest";
import { applySafety, DEFAULT_CONTROLS } from "./safety";
import type { CatalogVideo } from "../../shared/types";

function vid(over: Partial<CatalogVideo>): CatalogVideo {
  return {
    id: "v", title: "Calm nature walk", channel: "C", channelId: "UC1", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"], thumbnail: "t", ...over,
  };
}

describe("applySafety", () => {
  it("hides supervision-flagged videos unless supervised mode is on", () => {
    const videos = [vid({ id: "diy", flags: ["supervision"] }), vid({ id: "calm" })];
    expect(applySafety(videos, DEFAULT_CONTROLS).map((v) => v.id)).toEqual(["calm"]);
    expect(applySafety(videos, { ...DEFAULT_CONTROLS, supervisedMode: true }).map((v) => v.id))
      .toEqual(["diy", "calm"]);
  });
  it("drops blocked video ids and keyword-matched titles", () => {
    const videos = [vid({ id: "a" }), vid({ id: "b", title: "Exploding barrel" }), vid({ id: "c" })];
    const controls = { ...DEFAULT_CONTROLS, blockedVideoIds: ["a"], blockedKeywords: ["exploding"] };
    expect(applySafety(videos, controls).map((v) => v.id)).toEqual(["c"]);
  });
});

describe("loadControls", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("merges stored partial parentControls (from prefs) over defaults", async () => {
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn(async () => ({ prefs: { parentControls: { supervisedMode: true } } })) } },
    });
    const { loadControls } = await import("./safety");
    expect(await loadControls()).toEqual({ supervisedMode: true, blockedKeywords: [], blockedVideoIds: [] });
  });
  it("returns defaults when no prefs are stored", async () => {
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({})) } } });
    const { loadControls } = await import("./safety");
    expect(await loadControls()).toEqual(DEFAULT_CONTROLS);
  });
});
