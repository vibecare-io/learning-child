import { afterEach, describe, expect, it, vi } from "vitest";
import type { Catalog } from "../../shared/types";

const seedCatalog: Catalog = {
  version: 1, generatedAt: "x",
  profiles: { little: { label: "l" }, big: { label: "b" } },
  videos: [{
    id: "seed1", title: "T", channel: "C", channelId: "UCseed", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"], thumbnail: "t",
  }],
};

function stubChrome(localData: Record<string, unknown>, syncData: Record<string, unknown>) {
  vi.stubGlobal("chrome", {
    storage: {
      local: { get: vi.fn(async (k: string) => ({ [k]: localData[k] })) },
      sync: { get: vi.fn(async (k: string) => ({ [k]: syncData[k] })) },
    },
    runtime: { getURL: (p: string) => `chrome-extension://x/${p}` },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("loadCatalog", () => {
  it("returns the cached catalog when present", async () => {
    stubChrome({ catalog: seedCatalog }, {});
    const { loadCatalog } = await import("./catalog");
    expect((await loadCatalog()).videos[0].id).toBe("seed1");
  });

  it("falls back to the bundled seed when cache is empty", async () => {
    stubChrome({}, {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => seedCatalog })));
    const { loadCatalog } = await import("./catalog");
    const catalog = await loadCatalog();
    expect(catalog.videos[0].id).toBe("seed1");
    expect(fetch).toHaveBeenCalledWith("chrome-extension://x/seed-catalog.json");
  });
});

describe("loadAllowed", () => {
  it("derives allowed channels from the catalog when no allowed cache", async () => {
    stubChrome({ catalog: seedCatalog }, {});
    const { loadAllowed } = await import("./catalog");
    expect(await loadAllowed()).toEqual({ channelIds: ["UCseed"], handles: [] });
  });
});

describe("getActiveProfile", () => {
  it("uses the synced profile when valid, else the first catalog profile", async () => {
    stubChrome({}, { profile: "big" });
    const { getActiveProfile } = await import("./catalog");
    expect(await getActiveProfile(seedCatalog)).toBe("big");

    stubChrome({}, { profile: "ghost" });
    expect(await getActiveProfile(seedCatalog)).toBe("little");
  });
});
