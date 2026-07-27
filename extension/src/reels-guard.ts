// Reels/Shorts budget guardrail.
//
// Curation already hides Shorts shelves and nav entries, but a determined kid
// can still type /shorts or land there from an external link. Rather than a
// hard redirect (which teaches nothing and invites a workaround), we allow a
// small taste — REELS_LIMIT reels — then cut off with a cooldown that grows
// EXPONENTIALLY each time the limit is hit again, surfaced as a live countdown
// bar at the top of the page. Fail-open philosophy: this nudges, it doesn't jail.
//
// Pure decision logic lives up top (no chrome, no DOM) so it is fully unit
// testable; the storage + DOM glue is at the bottom.

export const REELS_LIMIT = 5; // default reels allowed before a cooldown kicks in
export const COOLDOWN_BASE_MS = 5 * 60_000; // default first lockout: 5 min
export const COOLDOWN_MAX_MS = 4 * 60 * 60_000; // cap escalation at 4 h
// A clean gap this long resets the escalation (strikes) and the running count,
// so an occasional peek tomorrow starts fresh instead of at the punishing tail.
export const STRIKE_DECAY_MS = 12 * 60 * 60_000;

const STORE_KEY = "reelsGuard";

/**
 * Parent-tunable knobs (from ParentControls). `limit <= 0` blocks Shorts
 * outright — no taste, no timed cooldown, just the old hard redirect.
 * The escalation cap and decay window stay internal (not worth a slider).
 */
export interface ReelsConfig {
  limit: number;
  baseCooldownMs: number;
}

export const DEFAULT_REELS_CONFIG: ReelsConfig = {
  limit: REELS_LIMIT,
  baseCooldownMs: COOLDOWN_BASE_MS,
};

export interface ReelsState {
  count: number; // reels consumed in the current allowance window
  strikes: number; // times the limit has been hit (drives exponential backoff)
  cooldownUntil: number; // epoch ms the cooldown ends; 0 = not in cooldown
  lastReelAt: number; // epoch ms of the last reel activity (drives decay)
}

export const INITIAL_STATE: ReelsState = { count: 0, strikes: 0, cooldownUntil: 0, lastReelAt: 0 };

export type ReelsDecision =
  | { allow: true; remaining: number; state: ReelsState }
  | { allow: false; cooldownUntil: number; state: ReelsState };

/** Exponential backoff: base, 2×, 4×, 8×, ... capped at COOLDOWN_MAX_MS. */
export function cooldownDuration(strikes: number, baseMs: number = COOLDOWN_BASE_MS): number {
  const raw = baseMs * 2 ** Math.max(0, strikes - 1);
  return Math.min(raw, COOLDOWN_MAX_MS);
}

/** Milliseconds left on the current cooldown at time `now` (0 if none). */
export function cooldownRemaining(state: ReelsState, now: number): number {
  return Math.max(0, state.cooldownUntil - now);
}

/**
 * Pure: given the stored state and the current time, decide whether this reel
 * view is permitted and return the next state to persist. Never mutates `prev`.
 */
export function evaluateReel(
  prev: ReelsState,
  now: number,
  config: ReelsConfig = DEFAULT_REELS_CONFIG,
): ReelsDecision {
  // Shorts disabled entirely: block every view, no timed cooldown to wait out.
  if (config.limit <= 0) {
    return { allow: false, cooldownUntil: 0, state: { ...prev } };
  }

  let { count, strikes, cooldownUntil, lastReelAt } = prev;

  // A long clean gap forgives the escalation and starts a fresh window.
  if (lastReelAt > 0 && now - lastReelAt >= STRIKE_DECAY_MS) {
    count = 0;
    strikes = 0;
    cooldownUntil = 0;
  }

  // Still serving a cooldown: block without touching the counters.
  if (cooldownUntil > now) {
    return { allow: false, cooldownUntil, state: { count, strikes, cooldownUntil, lastReelAt } };
  }

  // Cooldown has elapsed: open a fresh allowance window.
  if (cooldownUntil !== 0) {
    count = 0;
    cooldownUntil = 0;
  }

  // Would this view exceed the budget? Start the next (longer) cooldown.
  if (count + 1 > config.limit) {
    strikes += 1;
    cooldownUntil = now + cooldownDuration(strikes, config.baseCooldownMs);
    return {
      allow: false,
      cooldownUntil,
      state: { count: 0, strikes, cooldownUntil, lastReelAt: now },
    };
  }

  // Within budget: allow and count it.
  count += 1;
  return {
    allow: true,
    remaining: config.limit - count,
    state: { count, strikes, cooldownUntil: 0, lastReelAt: now },
  };
}

/** mm:ss, or h:mm:ss past an hour. Rounds up so the bar never shows 0:00 early. */
export function formatCooldown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------------------------------------------------------------------------
// Storage glue (chrome.storage.local, shared across contexts like prefs).
// ---------------------------------------------------------------------------

export async function loadReelsState(): Promise<ReelsState> {
  const { [STORE_KEY]: stored } = await chrome.storage.local.get(STORE_KEY);
  return { ...INITIAL_STATE, ...((stored as Partial<ReelsState> | undefined) ?? {}) };
}

export async function saveReelsState(state: ReelsState): Promise<void> {
  await chrome.storage.local.set({ [STORE_KEY]: state });
}

/**
 * Count one reel view and persist the outcome. Returns the decision so the
 * caller (content.ts) can redirect away when the budget is spent.
 */
export async function guardReel(
  config: ReelsConfig = DEFAULT_REELS_CONFIG,
  now: number = Date.now(),
): Promise<ReelsDecision> {
  const decision = evaluateReel(await loadReelsState(), now, config);
  await saveReelsState(decision.state);
  return decision;
}

// ---------------------------------------------------------------------------
// Top-of-page bar (pure DOM builder + a self-managing ticking controller).
// ---------------------------------------------------------------------------

const BAR_ID = "lc-reels-bar";
const BAR_CSS_ID = "lc-reels-css";

// Positioned BELOW YouTube's masthead (not over it) as a centered, self-
// contained card so it never obscures the logo/search. The full-width wrapper
// is click-through (pointer-events:none); only the card catches events.
const BAR_CSS = `
#${BAR_ID} {
  position: fixed; top: var(--ytd-masthead-height, 56px); left: 0; right: 0;
  z-index: 2020; pointer-events: none; font-family: "Roboto", Arial, sans-serif;
}
#${BAR_ID} .lc-reels-inner {
  pointer-events: auto; box-sizing: border-box;
  margin: 10px auto 0; max-width: 560px; width: calc(100% - 32px);
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px 13px; border-radius: 12px;
  background: var(--yt-spec-base-background, #fff);
  color: var(--yt-spec-text-primary, #0f0f0f);
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(0,0,0,0.12));
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}
#${BAR_ID} .lc-reels-icon { flex: none; font-size: 20px; line-height: 1; }
#${BAR_ID} .lc-reels-label { flex: 1; font-size: 14px; font-weight: 600; line-height: 1.3; }
#${BAR_ID} .lc-reels-track {
  position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  background: var(--yt-spec-10-percent-layer, rgba(0,0,0,0.1));
}
#${BAR_ID} .lc-reels-fill {
  height: 100%; transition: width 1s linear;
  background: var(--yt-spec-text-primary, #0f0f0f);
}
#${BAR_ID}[data-tone="cooldown"] .lc-reels-fill { background: #e0700c; }
`;

function injectBarCss(doc: Document): void {
  if (doc.getElementById(BAR_CSS_ID)) return;
  const style = doc.createElement("style");
  style.id = BAR_CSS_ID;
  style.textContent = BAR_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

/**
 * Pure DOM: create-or-update the bar to show `text` with the fill at
 * `fillPct` (0-100). `tone` drives the accent colour. Returns the element.
 */
export function paintReelsBar(
  doc: Document,
  opts: { text: string; fillPct: number; tone: "reels" | "cooldown" },
): HTMLElement {
  injectBarCss(doc);
  let bar = doc.getElementById(BAR_ID);
  if (!bar) {
    bar = doc.createElement("div");
    bar.id = BAR_ID;
    bar.innerHTML =
      '<div class="lc-reels-inner">' +
      '<span class="lc-reels-icon" aria-hidden="true"></span>' +
      '<span class="lc-reels-label"></span>' +
      '<div class="lc-reels-track"><div class="lc-reels-fill"></div></div>' +
      "</div>";
    (doc.body ?? doc.documentElement).appendChild(bar);
  }
  bar.dataset.tone = opts.tone;
  const icon = bar.querySelector<HTMLElement>(".lc-reels-icon");
  if (icon) icon.textContent = opts.tone === "cooldown" ? "⏳" : "🎬";
  const label = bar.querySelector<HTMLElement>(".lc-reels-label");
  if (label) label.textContent = opts.text;
  const fill = bar.querySelector<HTMLElement>(".lc-reels-fill");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, opts.fillPct))}%`;
  return bar;
}

export function removeReelsBar(doc: Document = document): void {
  doc.getElementById(BAR_ID)?.remove();
}

let tick: ReturnType<typeof setInterval> | undefined;

function stopTick(): void {
  if (tick !== undefined) {
    clearInterval(tick);
    tick = undefined;
  }
}

/**
 * Reflect the current guard state in the top bar. In cooldown it shows a live
 * countdown that ticks every second and clears itself when time is up. On the
 * shorts page with budget partly spent it shows how many reels are left.
 * Anywhere else it removes the bar.
 */
export async function syncReelsBar(
  onShorts: boolean,
  config: ReelsConfig = DEFAULT_REELS_CONFIG,
): Promise<void> {
  const state = await loadReelsState();

  const drawCooldown = (): boolean => {
    const now = Date.now();
    const remaining = cooldownRemaining(state, now);
    if (remaining <= 0) return false;
    const total = cooldownDuration(state.strikes, config.baseCooldownMs) || 1;
    paintReelsBar(document, {
      text: `Reels break — back in ${formatCooldown(remaining)}`,
      fillPct: (remaining / total) * 100,
      tone: "cooldown",
    });
    return true;
  };

  if (drawCooldown()) {
    stopTick();
    tick = setInterval(() => {
      if (!drawCooldown()) {
        stopTick();
        removeReelsBar();
      }
    }, 1000);
    return;
  }

  stopTick();
  if (onShorts && config.limit > 0 && state.count > 0) {
    const left = Math.max(0, config.limit - state.count);
    paintReelsBar(document, {
      text: `${left} ${left === 1 ? "reel" : "reels"} left`,
      fillPct: (left / config.limit) * 100,
      tone: "reels",
    });
  } else {
    removeReelsBar();
  }
}
