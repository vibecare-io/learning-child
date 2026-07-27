// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalog, CatalogVideo } from "../../../shared/types";
import type { WatchHistory } from "../history";

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

describe("runHome watched chip", () => {
  // 12 unwatched (>= MIN_GRID, so no backfill kicks in) + 3 watched, so the
  // default grid cleanly hides the watched ones without also demonstrating
  // the backfill floor (that's covered directly in feed.test.ts).
  const unwatchedVideos = Array.from({ length: 12 }, (_, i) => vid({ id: `u${i}` }));
  const watchedVideos = [
    vid({ id: "w-old", title: "Old watch" }),
    vid({ id: "w-mid", title: "Mid watch" }),
    vid({ id: "w-new", title: "New watch" }),
  ];
  const bigCatalog: Catalog = {
    version: 1, generatedAt: "x",
    profiles: { little: { label: "l" }, big: { label: "b" } },
    videos: [...unwatchedVideos, ...watchedVideos],
  };
  const history: WatchHistory = {
    videos: {
      "w-old": { title: "t", channel: "c", lastWatchedAt: "2026-07-01", totalSec: 200 },
      "w-mid": { title: "t", channel: "c", lastWatchedAt: "2026-07-15", totalSec: 200 },
      "w-new": { title: "t", channel: "c", lastWatchedAt: "2026-07-25", totalSec: 200 },
    },
    daily: {},
  };

  it("hides watched videos from the default grid and lists them newest-watched-first behind a Watched chip", async () => {
    document.body.innerHTML =
      `<ytd-browse page-subtype="home"><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>`;
    vi.doMock("../catalog", () => ({
      loadCatalog: async () => bigCatalog,
      getActiveProfile: async () => "big",
    }));
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn(async () => ({ watchHistory: history })) } },
    });

    const { runHome } = await import("./home");
    await runHome();

    const chips = document.getElementById("lc-chips")!;
    const labels = [...chips.querySelectorAll(".lc-chip")].map((c) => c.textContent);
    // Watched is prepended, ahead of "All".
    expect(labels[0]).toBe("Watched");
    expect(labels).toContain("All");

    // Default ("All") grid: only the 12 unwatched videos - watched ones are hidden.
    expect(document.querySelectorAll("#lc-grid-holder .lc-tile")).toHaveLength(12);

    // Click the Watched chip: grid swaps to the 3 watched videos, newest-watched first.
    const watchedChip = [...chips.querySelectorAll<HTMLElement>(".lc-chip")]
      .find((c) => c.dataset.topic === "watched")!;
    watchedChip.click();
    const titles = [...document.querySelectorAll("#lc-grid-holder .lc-title")].map((el) => el.textContent);
    expect(titles).toEqual(["New watch", "Mid watch", "Old watch"]);
    expect(watchedChip.classList.contains("lc-chip-on")).toBe(true);
  });
});
