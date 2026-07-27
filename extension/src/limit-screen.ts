// Full-page kawaii takeover shown once the kid hits the parent's daily
// screen-time limit. Unlike Task 22's soft per-adapter treatment (a calm
// panel swapped in on Home, autoplay left alone on Watch), the user's
// explicit decision is to block the ENTIRE YouTube surface - home, every
// watch page, every shorts page, search - the instant the limit is crossed,
// even mid-video. Enforcement itself lives in exactly one place
// (content.ts's route() prelude, plus the recorder's crossing check); this
// module only owns building/tearing down the overlay itself, so it's
// reusable and independently testable without touching chrome.* or routing.

const OVERLAY_ID = "lc-limit-screen";
const CSS_ID = "lc-limit-screen-css";

/** Ms remaining until the next LOCAL midnight - when the local-day watch-history bucket rolls. */
export function msUntilLocalMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // rolls over to 00:00:00 of the following local day
  return next.getTime() - now.getTime();
}

/** Formats a ms duration as zero-padded "HH:MM:SS"; negative values clamp to zero. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const LIMIT_SCREEN_CSS = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 20% 20%, #ffe3ef 0%, #ffe9f2 35%, #dff1ff 100%);
  font-family: "Nunito", "Baloo 2", ui-rounded, "SF Pro Rounded", "Segoe UI Rounded", system-ui, sans-serif;
}
#${OVERLAY_ID} .lc-limit-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
  opacity: 0.55;
  animation: lc-limit-float 6s ease-in-out infinite;
}
#${OVERLAY_ID} .lc-limit-blob-1 { width: 160px; height: 160px; background: #ffd3e6; top: 8%; left: 10%; animation-delay: 0s; }
#${OVERLAY_ID} .lc-limit-blob-2 { width: 220px; height: 220px; background: #cdeaff; bottom: 10%; right: 8%; animation-delay: 1.5s; }
#${OVERLAY_ID} .lc-limit-blob-3 { width: 120px; height: 120px; background: #fff3c4; top: 65%; left: 6%; animation-delay: 3s; }
#${OVERLAY_ID} .lc-limit-blob-4 { width: 100px; height: 100px; background: #d8ffe0; top: 15%; right: 18%; animation-delay: 0.8s; }
@keyframes lc-limit-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-18px) scale(1.05); }
}
#${OVERLAY_ID} .lc-limit-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  max-width: 560px;
  width: min(92vw, 560px);
  padding: 48px 36px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(6px);
}
#${OVERLAY_ID} .lc-limit-face {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: #fff4c2;
  position: relative;
  box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.04);
}
#${OVERLAY_ID} .lc-limit-face::before,
#${OVERLAY_ID} .lc-limit-face::after {
  content: "";
  position: absolute;
  top: 38px;
  width: 10px;
  height: 14px;
  border-radius: 50%;
  background: #4a3b2a;
}
#${OVERLAY_ID} .lc-limit-face::before { left: 28px; }
#${OVERLAY_ID} .lc-limit-face::after { right: 28px; }
#${OVERLAY_ID} .lc-limit-blush-l,
#${OVERLAY_ID} .lc-limit-blush-r {
  position: absolute;
  top: 54px;
  width: 16px;
  height: 9px;
  border-radius: 50%;
  background: #ffb3c6;
  opacity: 0.8;
}
#${OVERLAY_ID} .lc-limit-blush-l { left: 12px; }
#${OVERLAY_ID} .lc-limit-blush-r { right: 12px; }
#${OVERLAY_ID} .lc-limit-mouth {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 11px;
  border-radius: 0 0 22px 22px;
  border: 3px solid #4a3b2a;
  border-top: none;
}
#${OVERLAY_ID} h1 {
  margin: 4px 0 0;
  font-size: 28px;
  font-weight: 800;
  color: #5b4636;
}
#${OVERLAY_ID} .lc-limit-body {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: #6b5847;
}
#${OVERLAY_ID} .lc-limit-countdown-label {
  margin-top: 12px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9c7f68;
}
#${OVERLAY_ID} .lc-limit-countdown {
  font-size: 72px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  color: #5b4636;
  line-height: 1.1;
}
#${OVERLAY_ID} .lc-limit-footer {
  margin: 8px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: #6b5847;
}
`;

function injectLimitScreenCss(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = LIMIT_SCREEN_CSS;
  document.head?.appendChild(style) ?? document.documentElement.appendChild(style);
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="lc-limit-blob lc-limit-blob-1"></div>
    <div class="lc-limit-blob lc-limit-blob-2"></div>
    <div class="lc-limit-blob lc-limit-blob-3"></div>
    <div class="lc-limit-blob lc-limit-blob-4"></div>
    <div class="lc-limit-card">
      <div class="lc-limit-face">
        <div class="lc-limit-blush-l"></div>
        <div class="lc-limit-blush-r"></div>
        <div class="lc-limit-mouth"></div>
      </div>
      <h1>All done for today! ⭐</h1>
      <p class="lc-limit-body">You've used up today's watch time — and that's something to be proud of. Your eyes and brain deserve a rest.</p>
      <div class="lc-limit-countdown-label">New videos in</div>
      <div class="lc-limit-countdown" data-lc-countdown>00:00:00</div>
      <p class="lc-limit-footer">Go build, draw, jump, or dream something amazing. See you tomorrow! 🌈</p>
    </div>
  `;
  return overlay;
}

let activeCleanup: (() => void) | undefined;

/**
 * Injects the full-viewport kawaii takeover (idempotent while already shown -
 * returns the existing cleanup rather than double-injecting), pauses any
 * playing `<video>` and re-pauses it if a kid mashes play again, locks body
 * scroll, and ticks a live HH:MM:SS countdown to the next local midnight
 * every second. Returns a cleanup that removes the overlay, unlocks scroll,
 * stops the timer, and drops the play-event listener.
 */
export function showLimitScreen(): () => void {
  if (activeCleanup) return activeCleanup;

  injectLimitScreenCss();
  const overlay = buildOverlay();
  document.documentElement.appendChild(overlay);

  const countdownEl = overlay.querySelector<HTMLElement>("[data-lc-countdown]")!;
  const tick = () => {
    countdownEl.textContent = formatCountdown(msUntilLocalMidnight(new Date()));
  };
  tick();
  const timer = setInterval(tick, 1000);

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // Some environments (notably jsdom in tests) don't implement
  // HTMLMediaElement.pause() and throw "not implemented" - the overlay
  // itself already blocks interaction either way, so swallow that rather
  // than let it break the takeover's own setup/cleanup.
  const safePause = (video: HTMLVideoElement) => {
    try {
      if (!video.paused) video.pause();
    } catch {
      // ignore - see above
    }
  };
  const pauseAll = () => {
    document.querySelectorAll<HTMLVideoElement>("video").forEach(safePause);
  };
  pauseAll();
  // "play" does not bubble, so listen on the capture phase at the document
  // to catch it regardless of which <video> it fires on.
  const onPlay = (event: Event) => {
    safePause(event.target as HTMLVideoElement);
  };
  document.addEventListener("play", onPlay, true);

  const cleanup = () => {
    clearInterval(timer);
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    document.removeEventListener("play", onPlay, true);
    activeCleanup = undefined;
  };
  activeCleanup = cleanup;
  return cleanup;
}
