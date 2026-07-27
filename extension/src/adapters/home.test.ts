// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalog, CatalogVideo } from "../../../shared/types";

function vid(over: Partial<CatalogVideo>): CatalogVideo {
  return {
    id: "v", title: "T", channel: "C", channelId: "UC1", durationSec: 300,
    publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"],
    thumbnail: "t", ...over,
  };
}
const catalog: Catalog = {
  version: 1, generatedAt: "x",
  profiles: { little: { label: "l" }, big: { label: "b" } },
  videos: [
    vid({ id: "s1", topics: ["science"] }),
    vid({ id: "m1", topics: ["maths"] }),
    vid({ id: "s2", topics: ["science", "space"] }),
  ],
};

vi.mock("../catalog", () => ({
  loadCatalog: async () => catalog,
  getActiveProfile: async () => "big",
}));
// waitFor just resolves the host that runHome inserts before
vi.mock("../dom", () => ({
  waitFor: async (sel: string) => document.querySelector(sel),
}));
// loadControls() reads prefs via chrome.storage.local; stub it so it
// resolves to the (empty-prefs -> default) parent controls.
beforeEach(() => {
  vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({})) } } });
});

afterEach(() => { document.body.innerHTML = ""; vi.resetModules(); vi.unstubAllGlobals(); });

describe("runHome chip bar", () => {
  it("injects our topic chips and filters the grid on click", async () => {
    // minimal home DOM the adapter looks for
    document.body.innerHTML =
      `<ytd-browse page-subtype="home"><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>`;
    const { runHome } = await import("./home");
    await runHome();

    const chips = document.getElementById("lc-chips");
    expect(chips, "lc-chips should be injected").not.toBeNull();
    const labels = [...chips!.querySelectorAll(".lc-chip")].map((c) => c.textContent);
    // "All" plus only the topics present in the feed, in canonical order
    expect(labels).toEqual(["All", "Science", "Maths", "Space"]);

    // full feed shows all 3 tiles
    expect(document.querySelectorAll("#lc-grid-holder .lc-tile")).toHaveLength(3);

    // click "Maths" -> only the maths video remains
    const maths = [...chips!.querySelectorAll<HTMLElement>(".lc-chip")]
      .find((c) => c.dataset.topic === "maths")!;
    maths.click();
    expect(document.querySelectorAll("#lc-grid-holder .lc-tile")).toHaveLength(1);
    expect(maths.classList.contains("lc-chip-on")).toBe(true);
  });
});
