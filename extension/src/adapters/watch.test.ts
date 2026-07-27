// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disableAutoplay, runWatch, startRecorder } from "./watch";
import { AUTONAV_TOGGLE, VIDEO_PLAYER, WATCH_SIDEBAR } from "../selectors";
import type { Catalog } from "../../../shared/types";

// recordTick is the only chrome.storage writer history.ts exposes; stub it
// so the recorder tests exercise only the tick predicate (player present,
// playing, tab visible) with fake timers, not the storage round-trip
// (covered by history.test.ts). isOverLimit/secondsToday/getHistory stay
// real (pure / trivially chrome-stubbed) so runWatch's screen-time-limit
// wiring is exercised for real below.
vi.mock("../history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../history")>();
  return { ...actual, recordTick: vi.fn() };
});
import { recordTick } from "../history";

const CATALOG: Catalog = {
  version: 1, generatedAt: "x",
  profiles: { little: { label: "l" }, big: { label: "b" } },
  videos: [
    {
      id: "cur", title: "Current video", channel: "C", channelId: "UC1", durationSec: 300,
      publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"], thumbnail: "t",
    },
    {
      id: "next1", title: "Next video", channel: "C", channelId: "UC1", durationSec: 300,
      publishedAt: "2020-01-01T00:00:00Z", topics: [], profiles: ["big"], thumbnail: "t",
    },
  ],
};

vi.mock("../catalog", () => ({
  loadCatalog: async () => CATALOG,
  getActiveProfile: async () => "big",
}));
// waitFor just resolves the sidebar runWatch prepends the up-next list into.
vi.mock("../dom", () => ({
  waitFor: async (sel: string) => document.querySelector(sel),
}));

function mountToggle(checked: boolean): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.className = AUTONAV_TOGGLE.replace(/^\./, "");
  toggle.setAttribute("aria-checked", String(checked));
  toggle.addEventListener("click", () => toggle.setAttribute("aria-checked", "false"));
  document.body.appendChild(toggle);
  return toggle;
}

function mountPlayer(paused: boolean, ended = false): HTMLVideoElement {
  const video = document.createElement("video");
  video.className = VIDEO_PLAYER.replace(/^video\./, "");
  // jsdom's HTMLMediaElement.paused/.ended are read-only prototype getters
  // (play()/pause() are not implemented) - override per-instance for tests.
  Object.defineProperty(video, "paused", { value: paused, configurable: true });
  Object.defineProperty(video, "ended", { value: ended, configurable: true });
  document.body.appendChild(video);
  return video;
}

describe("disableAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("clicks the checked toggle off within a tick and then stops polling", () => {
    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);

    disableAutoplay();
    vi.advanceTimersByTime(500);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    // Interval must be cleared after the click - advancing further should
    // not click again even though the poll function would still find the
    // element (it's just no longer checked).
    vi.advanceTimersByTime(10_000);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing if the toggle is already unchecked", () => {
    const toggle = mountToggle(false);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);

    disableAutoplay();
    vi.advanceTimersByTime(20_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("gives up polling after 15s if the toggle never appears", () => {
    disableAutoplay();
    vi.advanceTimersByTime(15_000);

    // Toggle finally appears after the give-up window - should not be clicked.
    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);
    vi.advanceTimersByTime(5_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("cancel() stops the poller before it ever finds the toggle", () => {
    const cancel = disableAutoplay();
    cancel();

    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);
    vi.advanceTimersByTime(20_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe("startRecorder", () => {
  const META = { title: "Calm nature walk", channel: "Nature Co" };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(recordTick).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("records a tick every 5s while the player exists and is playing", () => {
    mountPlayer(false);
    startRecorder("v1", META);

    vi.advanceTimersByTime(5_000);
    expect(recordTick).toHaveBeenCalledTimes(1);
    expect(recordTick).toHaveBeenCalledWith("v1", META, 5, expect.any(String));

    vi.advanceTimersByTime(10_000);
    expect(recordTick).toHaveBeenCalledTimes(3);
  });

  it("does not tick while the player is paused", () => {
    mountPlayer(true);
    startRecorder("v1", META);

    vi.advanceTimersByTime(20_000);
    expect(recordTick).not.toHaveBeenCalled();
  });

  it("does not tick once the player has ended", () => {
    mountPlayer(false, true);
    startRecorder("v1", META);

    vi.advanceTimersByTime(10_000);
    expect(recordTick).not.toHaveBeenCalled();
  });

  it("does not tick when the tab is hidden", () => {
    mountPlayer(false);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    startRecorder("v1", META);

    vi.advanceTimersByTime(10_000);
    expect(recordTick).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not tick when no player element is present", () => {
    startRecorder("v1", META);

    vi.advanceTimersByTime(10_000);
    expect(recordTick).not.toHaveBeenCalled();
  });

  it("cancel() stops the interval", () => {
    mountPlayer(false);
    const cancel = startRecorder("v1", META);
    cancel();

    vi.advanceTimersByTime(20_000);
    expect(recordTick).not.toHaveBeenCalled();
  });
});

describe("runWatch over the daily screen-time limit", () => {
  let cleanup: () => void = () => {};

  function stubPrefsAndHistory(screenTimeMinutes: number | null, dailySeconds: number): void {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({
            prefs: { screenTimeMinutes },
            watchHistory: { videos: {}, daily: { [new Date().toISOString().slice(0, 10)]: dailySeconds } },
          })),
        },
      },
    });
  }

  beforeEach(() => {
    window.history.pushState({}, "", "/watch?v=cur");
    document.body.innerHTML = `<div id="secondary" class="ytd-watch-flexy"></div>`;
  });

  afterEach(() => {
    cleanup();
    cleanup = () => {};
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.mocked(recordTick).mockClear();
  });

  it("skips injecting the up-next list once the daily limit is reached", async () => {
    stubPrefsAndHistory(30, 30 * 60);

    cleanup = await runWatch();

    expect(document.getElementById("lc-upnext")).toBeNull();
  });

  it("removes a stale up-next list left over from before the limit was hit", async () => {
    stubPrefsAndHistory(30, 30 * 60);
    document.querySelector(WATCH_SIDEBAR)!.appendChild(document.createElement("div")).id = "lc-upnext";

    cleanup = await runWatch();

    expect(document.getElementById("lc-upnext")).toBeNull();
  });

  it("still injects the up-next list while under the limit", async () => {
    stubPrefsAndHistory(30, 30 * 60 - 1);

    cleanup = await runWatch();

    expect(document.getElementById("lc-upnext")).not.toBeNull();
  });

  it("never applies the limit when screenTimeMinutes is null", async () => {
    stubPrefsAndHistory(null, 999_999);

    cleanup = await runWatch();

    expect(document.getElementById("lc-upnext")).not.toBeNull();
  });
});
