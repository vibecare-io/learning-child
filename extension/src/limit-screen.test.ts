// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCountdown, msUntilLocalMidnight, showLimitScreen } from "./limit-screen";

describe("msUntilLocalMidnight", () => {
  it("returns the ms remaining until the next local midnight, mid-day", () => {
    const now = new Date(2026, 6, 26, 14, 30, 0, 0); // 2026-07-26 14:30:00 local
    const expected =
      new Date(2026, 6, 27, 0, 0, 0, 0).getTime() - now.getTime();
    expect(msUntilLocalMidnight(now)).toBe(expected);
  });

  it("returns ~1000ms one second before midnight", () => {
    const now = new Date(2026, 6, 26, 23, 59, 59, 0);
    expect(msUntilLocalMidnight(now)).toBe(1000);
  });

  it("returns a full day exactly at midnight", () => {
    const now = new Date(2026, 6, 26, 0, 0, 0, 0);
    expect(msUntilLocalMidnight(now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe("formatCountdown", () => {
  it("formats zero as 00:00:00", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
  });

  it("formats 1h 1m 1s", () => {
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
  });

  it("clamps negative values to zero", () => {
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
});

describe("showLimitScreen", () => {
  afterEach(() => {
    document.getElementById("lc-limit-screen")?.remove();
    document.getElementById("lc-limit-screen-css")?.remove();
    document.body.style.overflow = "";
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("injects #lc-limit-screen as a direct child of documentElement", () => {
    const cleanup = showLimitScreen();
    const overlay = document.getElementById("lc-limit-screen");
    expect(overlay).not.toBeNull();
    expect(overlay!.parentElement).toBe(document.documentElement);
    cleanup();
  });

  it("is idempotent: a second call while shown returns the same cleanup and does not duplicate the overlay", () => {
    const cleanup1 = showLimitScreen();
    const cleanup2 = showLimitScreen();
    expect(cleanup2).toBe(cleanup1);
    expect(document.querySelectorAll("#lc-limit-screen")).toHaveLength(1);
    cleanup1();
  });

  it("pauses a playing <video> and re-pauses it if play is dispatched again", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "paused", { value: false, writable: true, configurable: true });
    const pauseSpy = vi.fn(() => {
      Object.defineProperty(video, "paused", { value: true, writable: true, configurable: true });
    });
    video.pause = pauseSpy;
    document.body.appendChild(video);

    const cleanup = showLimitScreen();
    expect(pauseSpy).toHaveBeenCalledTimes(1);

    // Kid presses play again - the takeover must slap it back down.
    Object.defineProperty(video, "paused", { value: false, writable: true, configurable: true });
    video.dispatchEvent(new Event("play"));
    expect(pauseSpy).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("locks body scroll while shown and restores the prior overflow on cleanup", () => {
    document.body.style.overflow = "auto";
    const cleanup = showLimitScreen();
    expect(document.body.style.overflow).toBe("hidden");
    cleanup();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("cleanup removes the overlay and stops the countdown timer", () => {
    vi.useFakeTimers();
    const cleanup = showLimitScreen();
    expect(document.getElementById("lc-limit-screen")).not.toBeNull();
    cleanup();
    expect(document.getElementById("lc-limit-screen")).toBeNull();
    // Advancing the clock after cleanup must not resurrect anything or throw.
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });

  it("ticks the visible countdown every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 26, 23, 59, 58, 0));
    const cleanup = showLimitScreen();
    const countdown = document.querySelector("#lc-limit-screen [data-lc-countdown]")!;
    expect(countdown.textContent).toBe("00:00:02");
    vi.advanceTimersByTime(1000);
    expect(countdown.textContent).toBe("00:00:01");
    cleanup();
  });

  it("allows a fresh overlay to be created again after cleanup", () => {
    const cleanup1 = showLimitScreen();
    cleanup1();
    const cleanup2 = showLimitScreen();
    expect(cleanup2).not.toBe(cleanup1);
    expect(document.getElementById("lc-limit-screen")).not.toBeNull();
    cleanup2();
  });
});
