// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  COOLDOWN_BASE_MS,
  COOLDOWN_MAX_MS,
  INITIAL_STATE,
  REELS_LIMIT,
  STRIKE_DECAY_MS,
  cooldownDuration,
  cooldownRemaining,
  evaluateReel,
  formatCooldown,
  paintReelsBar,
  removeReelsBar,
  type ReelsState,
} from "./reels-guard";

const MIN = 60_000;

describe("cooldownDuration", () => {
  it("doubles each strike and caps at the max", () => {
    expect(cooldownDuration(1)).toBe(COOLDOWN_BASE_MS); // 5m
    expect(cooldownDuration(2)).toBe(COOLDOWN_BASE_MS * 2); // 10m
    expect(cooldownDuration(3)).toBe(COOLDOWN_BASE_MS * 4); // 20m
    expect(cooldownDuration(20)).toBe(COOLDOWN_MAX_MS); // capped
    expect(cooldownDuration(0)).toBe(COOLDOWN_BASE_MS); // floor at 1x
  });
});

describe("evaluateReel", () => {
  it("allows exactly REELS_LIMIT reels then blocks and starts a cooldown", () => {
    let state: ReelsState = INITIAL_STATE;
    for (let i = 1; i <= REELS_LIMIT; i++) {
      const d = evaluateReel(state, i * 1000);
      expect(d.allow).toBe(true);
      if (d.allow) expect(d.remaining).toBe(REELS_LIMIT - i);
      state = d.state;
    }
    // The (LIMIT+1)th is blocked and opens the first (5 min) cooldown.
    const blocked = evaluateReel(state, 6000);
    expect(blocked.allow).toBe(false);
    expect(blocked.state.strikes).toBe(1);
    expect(blocked.state.count).toBe(0);
    if (!blocked.allow) expect(blocked.cooldownUntil).toBe(6000 + COOLDOWN_BASE_MS);
  });

  it("keeps blocking while the cooldown is active without changing counters", () => {
    const state: ReelsState = { count: 0, strikes: 1, cooldownUntil: 10 * MIN, lastReelAt: 5 * MIN };
    const d = evaluateReel(state, 7 * MIN);
    expect(d.allow).toBe(false);
    expect(d.state.strikes).toBe(1);
    expect(d.state.cooldownUntil).toBe(10 * MIN);
  });

  it("opens a fresh window once the cooldown elapses", () => {
    const state: ReelsState = { count: 0, strikes: 2, cooldownUntil: 10 * MIN, lastReelAt: 9 * MIN };
    const d = evaluateReel(state, 11 * MIN); // just past cooldown
    expect(d.allow).toBe(true);
    if (d.allow) expect(d.remaining).toBe(REELS_LIMIT - 1);
    expect(d.state.count).toBe(1);
    expect(d.state.strikes).toBe(2); // escalation persists across the gap
    expect(d.state.cooldownUntil).toBe(0);
  });

  it("escalates exponentially across repeated lockouts", () => {
    // Second lockout should be twice the first.
    const afterFirst: ReelsState = { count: REELS_LIMIT, strikes: 1, cooldownUntil: 0, lastReelAt: 100 };
    const second = evaluateReel(afterFirst, 200);
    expect(second.allow).toBe(false);
    expect(second.state.strikes).toBe(2);
    if (!second.allow) expect(second.cooldownUntil - 200).toBe(cooldownDuration(2));
  });

  it("forgives escalation after a long clean gap", () => {
    const state: ReelsState = { count: REELS_LIMIT, strikes: 4, cooldownUntil: 0, lastReelAt: 1000 };
    const d = evaluateReel(state, 1000 + STRIKE_DECAY_MS);
    expect(d.allow).toBe(true); // count reset, so this is reel #1 again
    expect(d.state.strikes).toBe(0);
    if (d.allow) expect(d.remaining).toBe(REELS_LIMIT - 1);
  });

  it("honours a parent-set limit and base cooldown", () => {
    const config = { limit: 2, baseCooldownMs: 3 * MIN };
    let state: ReelsState = INITIAL_STATE;
    state = evaluateReel(state, 1000, config).state; // reel 1
    const second = evaluateReel(state, 2000, config);
    expect(second.allow).toBe(true);
    if (second.allow) expect(second.remaining).toBe(0);
    const third = evaluateReel(second.state, 3000, config);
    expect(third.allow).toBe(false);
    if (!third.allow) expect(third.cooldownUntil).toBe(3000 + 3 * MIN); // base honoured
  });

  it("blocks Shorts outright when limit is 0, with no timed cooldown", () => {
    const d = evaluateReel(INITIAL_STATE, 5000, { limit: 0, baseCooldownMs: COOLDOWN_BASE_MS });
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.cooldownUntil).toBe(0); // permanent block, nothing to wait out
    expect(d.state).toEqual(INITIAL_STATE); // counters untouched
  });
});

describe("cooldownRemaining", () => {
  it("returns time left, clamped to zero", () => {
    const state: ReelsState = { ...INITIAL_STATE, cooldownUntil: 5000 };
    expect(cooldownRemaining(state, 2000)).toBe(3000);
    expect(cooldownRemaining(state, 9000)).toBe(0);
  });
});

describe("formatCooldown", () => {
  it("formats mm:ss and rounds up", () => {
    expect(formatCooldown(0)).toBe("0:00");
    expect(formatCooldown(1)).toBe("0:01"); // ceil
    expect(formatCooldown(90_000)).toBe("1:30");
    expect(formatCooldown(2 * 3600_000 + 5_000)).toBe("2:00:05");
  });
});

describe("paintReelsBar", () => {
  it("creates the bar, sets tone/text, and clamps the fill", () => {
    removeReelsBar();
    paintReelsBar(document, { text: "Reels break — back in 4:59", fillPct: 150, tone: "cooldown" });
    const bar = document.getElementById("lc-reels-bar")!;
    expect(bar.dataset.tone).toBe("cooldown");
    expect(bar.querySelector(".lc-reels-label")!.textContent).toBe("Reels break — back in 4:59");
    expect((bar.querySelector(".lc-reels-fill") as HTMLElement).style.width).toBe("100%");
    // Second paint updates in place (no duplicate bars).
    paintReelsBar(document, { text: "2 reels left", fillPct: 40, tone: "reels" });
    expect(document.querySelectorAll("#lc-reels-bar").length).toBe(1);
    expect(bar.dataset.tone).toBe("reels");
    expect((bar.querySelector(".lc-reels-fill") as HTMLElement).style.width).toBe("40%");
  });
});
