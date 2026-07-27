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
  function makeCatalog(videos: CatalogVideo[]): Catalog {
    return {
      version: 1, generatedAt: "x",
      profiles: { little: { label: "l" }, big: { label: "b" } },
      videos,
    };
  }
  /** Builds a history where each id was watched (200s) on the given day. */
  function makeHistory(days: Record<string, string>): WatchHistory {
    return {
      videos: Object.fromEntries(
        Object.entries(days).map(([id, day]) => [id, { title: "t", channel: "c", lastWatchedAt: day, totalSec: 200 }]),
      ),
      daily: {},
    };
  }

  async function boot(catalog: Catalog, history: WatchHistory): Promise<void> {
    document.body.innerHTML =
      `<ytd-browse page-subtype="home"><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>`;
    vi.doMock("../catalog", () => ({
      loadCatalog: async () => catalog,
      getActiveProfile: async () => "big",
    }));
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn(async () => ({ watchHistory: history })) } },
    });
    const { runHome } = await import("./home");
    await runHome();
  }

  const gridIds = (): string[] =>
    [...document.querySelectorAll<HTMLAnchorElement>("#lc-grid-holder .lc-tile")]
      .map((a) => new URL(a.href, "https://www.youtube.com").searchParams.get("v")!);

  it("hides watched videos from the default grid and lists them newest-watched-first behind a trailing Watched chip", async () => {
    // 12 unwatched (>= MIN_GRID, so no backfill kicks in) + 3 watched, so the
    // default grid cleanly hides the watched ones without also demonstrating
    // the backfill floor (that's covered directly in feed.test.ts).
    const catalog = makeCatalog([
      ...Array.from({ length: 12 }, (_, i) => vid({ id: `u${i}` })),
      vid({ id: "w-old", title: "Old watch" }),
      vid({ id: "w-mid", title: "Mid watch" }),
      vid({ id: "w-new", title: "New watch" }),
    ]);
    await boot(catalog, makeHistory({ "w-old": "2026-07-01", "w-mid": "2026-07-15", "w-new": "2026-07-25" }));

    const chips = document.getElementById("lc-chips")!;
    const labels = [...chips.querySelectorAll(".lc-chip")].map((c) => c.textContent);
    // Stealth: like real YouTube, the bar starts with a highlighted "All";
    // our special Watched chip goes last.
    expect(labels[0]).toBe("All");
    expect(labels[labels.length - 1]).toBe("Watched");

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

  it("does not duplicate backfilled videos between the default grid and the Watched tab", async () => {
    // 8 unwatched + 5 watched: backfill pulls the 4 least-recently-watched
    // into the grid to hit MIN_GRID = 12; the Watched tab must show only the
    // 1 remaining (newest) watched video, with no id in both places.
    const catalog = makeCatalog([
      ...Array.from({ length: 8 }, (_, i) => vid({ id: `u${i}` })),
      ...Array.from({ length: 5 }, (_, i) => vid({ id: `w${i}` })),
    ]);
    // w0 oldest .. w4 newest
    await boot(catalog, makeHistory({
      w0: "2026-07-01", w1: "2026-07-05", w2: "2026-07-10", w3: "2026-07-15", w4: "2026-07-20",
    }));

    const defaultIds = gridIds();
    expect(defaultIds).toHaveLength(12); // 8 unwatched + 4 backfilled

    const watchedChip = document.querySelector<HTMLElement>('.lc-chip[data-topic="watched"]')!;
    watchedChip.click();
    const watchedIds = gridIds();
    expect(watchedIds).toEqual(["w4"]); // only the newest-watched remains hidden

    // No video appears in both the default grid and the Watched tab.
    expect(defaultIds.filter((id) => watchedIds.includes(id))).toEqual([]);
  });

  it("hides the Watched chip entirely when every watched video was backfilled into the grid", async () => {
    // 8 unwatched + 2 watched: both watched videos get backfilled (grid still
    // short of MIN_GRID), leaving watchedRest empty - no Watched chip.
    const catalog = makeCatalog([
      ...Array.from({ length: 8 }, (_, i) => vid({ id: `u${i}` })),
      vid({ id: "w0" }), vid({ id: "w1" }),
    ]);
    await boot(catalog, makeHistory({ w0: "2026-07-01", w1: "2026-07-05" }));

    expect(document.querySelector('.lc-chip[data-topic="watched"]')).toBeNull();
    expect(document.querySelectorAll("#lc-grid-holder .lc-tile")).toHaveLength(10);
  });
});

// The daily screen-time limit is no longer checked inside runHome: it's
// enforced once, centrally, in content.ts's route() prelude (which shows
// the full-page kawaii takeover and never calls runHome at all once the kid
// is over limit). See limit-screen.test.ts and content.ts for that behavior;
// runHome itself has no over-limit branch left to test.
