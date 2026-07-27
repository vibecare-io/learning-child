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
import { localDayStr, recordTick } from "../history";

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
  // jsdom's HTMLMediaElement.paused/.ended/.currentTime are read-only prototype
  // getters (play()/pause() aren't implemented) - override per-instance so tests
  // can drive playback state and advance the clock.
  Object.defineProperty(video, "paused", { value: paused, writable: true, configurable: true });
  Object.defineProperty(video, "ended", { value: ended, configurable: true });
  Object.defineProperty(video, "currentTime", { value: 0, writable: true, configurable: true });
  // jsdom doesn't implement pause() either (throws "not implemented"); stub it
  // so the limit-screen takeover's video-pausing behavior can be exercised
  // without noisy jsdom virtual-console errors.
  video.pause = () => {
    Object.defineProperty(video, "paused", { value: true, writable: true, configurable: true });
  };
  document.body.appendChild(video);
  return video;
}

const setTime = (v: HTMLVideoElement, t: number): void => {
  (v as unknown as { currentTime: number }).currentTime = t;
};

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
    // startRecorder's post-tick limit recheck reads prefs (and, when a limit
    // is set, history) via chrome.storage; these tests only exercise the
    // tick predicate, so an empty store (default prefs -> no limit) keeps
    // the recheck inert and the output free of swallowed-error noise.
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({})) } } });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("credits real elapsed playback (currentTime delta), not a flat interval", () => {
    const video = mountPlayer(false);
    startRecorder("v1", META);

    // First sample only establishes the cursor - nothing credited yet.
    setTime(video, 5);
    vi.advanceTimersByTime(5_000);
    expect(recordTick).not.toHaveBeenCalled();

    // Next interval credits the actual 5s of progress.
    setTime(video, 10);
    vi.advanceTimersByTime(5_000);
    expect(recordTick).toHaveBeenCalledWith("v1", META, 5, localDayStr());

    // A slow interval that only advanced 4s credits 4s, not 5.
    setTime(video, 14);
    vi.advanceTimersByTime(5_000);
    expect(recordTick).toHaveBeenLastCalledWith("v1", META, 4, localDayStr());
    expect(recordTick).toHaveBeenCalledTimes(2);
  });

  it("ignores a big forward jump (seek) beyond the per-tick cap", () => {
    const video = mountPlayer(false);
    startRecorder("v1", META);
    setTime(video, 5);
    vi.advanceTimersByTime(5_000); // cursor
    setTime(video, 100); // +95s seek
    vi.advanceTimersByTime(5_000);
    expect(recordTick).not.toHaveBeenCalled();
  });

  it("does not credit a paused interval (currentTime frozen)", () => {
    const video = mountPlayer(false);
    startRecorder("v1", META);
    setTime(video, 5);
    vi.advanceTimersByTime(5_000); // cursor at 5
    // currentTime does not advance (paused) - delta 0, nothing credited.
    vi.advanceTimersByTime(10_000);
    expect(recordTick).not.toHaveBeenCalled();
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

// The daily screen-time limit is no longer checked inside runWatch itself:
// it's enforced once, centrally, in content.ts's route() prelude, which
// shows the full-page kawaii takeover and never calls runWatch at all once
// the kid is over limit before a navigation. What runWatch's own recorder
// (startRecorder) *does* still need to handle is the mid-video case: the
// kid crosses the limit while a video that was already allowed keeps
// playing. That's covered directly below.
describe("startRecorder mid-video limit crossing", () => {
  const META = { title: "Calm nature walk", channel: "Nature Co" };
  let cancel: (() => void) | undefined;

  // The post-tick limit re-check chains several awaits (recordTick, then
  // Promise.all of two chrome.storage reads); advanceTimersByTimeAsync
  // drains the microtask queue for timer-driven callbacks, but give it a
  // few extra spins to be sure a multi-hop await chain fully settles before
  // the test's assertions (or the next test's afterEach) run.
  async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(recordTick).mockClear();
  });

  afterEach(async () => {
    cancel?.();
    cancel = undefined;
    await flush();
    vi.useRealTimers();
    document.body.innerHTML = "";
    document.getElementById("lc-limit-screen")?.remove();
    document.getElementById("lc-limit-screen-css")?.remove();
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
  });

  function stubPrefsAndHistory(screenTimeMinutes: number | null, dailySeconds: number): void {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({
            prefs: { screenTimeMinutes },
            watchHistory: { videos: {}, daily: { [localDayStr()]: dailySeconds } },
          })),
          set: vi.fn(async () => {}),
        },
      },
    });
  }

  it("shows the full-page takeover immediately once a tick pushes the kid over the limit", async () => {
    // recordTick is stubbed (see the module mock above) so it never actually
    // writes storage; stub chrome.storage.local.get to already reflect the
    // over-limit state that a real recordTick write would have produced, so
    // this exercises the recorder's post-tick re-check + takeover wiring.
    stubPrefsAndHistory(30, 30 * 60);
    const video = mountPlayer(false);
    cancel = startRecorder("v1", META);

    setTime(video, 5);
    await vi.advanceTimersByTimeAsync(5_000); // cursor sample, nothing credited yet
    await flush();
    setTime(video, 10); // +5s credited, crosses the 3s of remaining headroom
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();

    expect(document.getElementById("lc-limit-screen"), "takeover should be injected").not.toBeNull();
  });

  it("does not show the takeover while still under the limit", async () => {
    stubPrefsAndHistory(30, 0);
    const video = mountPlayer(false);
    cancel = startRecorder("v1", META);

    setTime(video, 5);
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    setTime(video, 10);
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();

    expect(document.getElementById("lc-limit-screen")).toBeNull();
  });

  it("tears down the takeover when the recorder's own cleanup runs", async () => {
    stubPrefsAndHistory(30, 30 * 60);
    const video = mountPlayer(false);
    cancel = startRecorder("v1", META);

    setTime(video, 5);
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    setTime(video, 10);
    await vi.advanceTimersByTimeAsync(5_000);
    await flush();
    expect(document.getElementById("lc-limit-screen")).not.toBeNull();

    cancel();
    expect(document.getElementById("lc-limit-screen")).toBeNull();
  });

  it("never shows the takeover when cancelled while the recheck is still in flight (orphaned-overlay race)", async () => {
    // Gate the storage read so the post-tick recheck chain is provably still
    // pending when cancel() runs - reproducing the race where a navigation
    // tears the recorder down between a tick and its async chain resolving.
    // Pre-fix, the late-resolving chain would call showLimitScreen() and
    // strand its cleanup in the dead closure (orphaned overlay after the
    // local-midnight rollover); the cancelled guard must make it a no-op.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => {
            await gate;
            return {
              prefs: { screenTimeMinutes: 30 },
              watchHistory: { videos: {}, daily: { [localDayStr()]: 30 * 60 } },
            };
          }),
          set: vi.fn(async () => {}),
        },
      },
    });
    const video = mountPlayer(false);
    cancel = startRecorder("v1", META);

    setTime(video, 5);
    await vi.advanceTimersByTimeAsync(5_000); // cursor sample
    await flush();
    setTime(video, 10);
    await vi.advanceTimersByTimeAsync(5_000); // credited tick -> recheck now awaiting the gated read
    await flush();
    expect(document.getElementById("lc-limit-screen")).toBeNull();

    cancel(); // navigation tears the recorder down while the chain is in flight
    cancel = undefined;
    release(); // storage read finally resolves - over limit, but cancelled
    await flush();

    expect(document.getElementById("lc-limit-screen"), "stale recheck must not inject the overlay").toBeNull();
  });
});
