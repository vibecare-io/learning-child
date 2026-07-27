import { HIDE_SELECTORS } from "./selectors";
import { runHome } from "./adapters/home";
import { runWatch } from "./adapters/watch";
import { runSearch } from "./adapters/search";
import { guardReel, syncReelsBar, type ReelsConfig } from "./reels-guard";
import { loadControls } from "./safety";

export function installHideStyle(): void {
  if (document.getElementById("lc-hide")) return;
  const style = document.createElement("style");
  style.id = "lc-hide";
  style.textContent = `${HIDE_SELECTORS.join(",\n")} { display: none !important; }`;
  document.documentElement.appendChild(style);
}

/** Fail OPEN: unhide real YouTube and flag the parent via the toolbar badge. */
export function reportFailure(surface: string): void {
  console.warn(`[learning-child] adapter failed: ${surface}`);
  document.getElementById("lc-hide")?.remove();
  try {
    void Promise.resolve(
      chrome.runtime.sendMessage({ type: "adapter-failure", surface }),
    ).catch(() => {});
  } catch {
    // extension context gone (e.g. reloaded) - nothing to do
  }
}

type Cleanup = void | (() => void);
let cleanup: Cleanup;

// Navigation generation token: serializes route() runs so a stale in-flight
// navigation can't insert into the wrong page's DOM or clobber the cleanup
// left behind by a newer navigation.
let nav = 0;

// route() fires on both DOMContentLoaded and yt-navigate-finish for the same
// hard-loaded navigation, so a naive counter (guardReel) would burn 2 budget
// units for one reel view. Track the last shorts URL that was actually
// counted and skip re-counting it if location.href hasn't changed since.
let lastCountedShortsHref: string | undefined;

const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  [/^\/watch$/, "watch", runWatch],
  [/^\/results$/, "search", runSearch],
];

async function route(): Promise<void> {
  const myNav = ++nav;
  installHideStyle();

  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.warn("[learning-child] cleanup failed", err);
    }
  }
  cleanup = undefined;

  const path = location.pathname;
  const onShorts = path === "/shorts" || path.startsWith("/shorts/");

  // The whole reels/shorts prelude (storage reads + the shorts guard) must
  // fail OPEN: if chrome.storage rejects (e.g. extension context invalidated
  // mid-navigation), the kid must not be left on a blank hidden page with no
  // adapter and no badge. Any throw in here unhides the page and flags the
  // toolbar instead of leaving route() to reject before the routes loop runs.
  try {
    const controls = await loadControls();
    if (myNav !== nav) return; // a newer navigation started; abandon quietly
    const reelsConfig: ReelsConfig = {
      limit: controls.reelsLimit,
      baseCooldownMs: controls.reelsCooldownMinutes * 60_000,
    };
    if (onShorts) {
      const href = location.href;
      if (href !== lastCountedShortsHref) {
        // Allow a small taste (reelsLimit), then redirect away and start the
        // exponential cooldown. The bar (synced below) shows the countdown.
        const decision = await guardReel(reelsConfig);
        if (myNav !== nav) return;
        if (!decision.allow) {
          location.replace("https://www.youtube.com/");
          return;
        }
        lastCountedShortsHref = href;
      }
    }
    // Reflect the reels budget / cooldown in the top-of-page bar on every
    // page. Best-effort: a failure here shouldn't fail the whole prelude.
    void syncReelsBar(onShorts, reelsConfig).catch(() => {});
    if (onShorts) return; // shorts is not one of our curated adapter surfaces
  } catch {
    if (myNav !== nav) return;
    reportFailure("reels-guard");
    return;
  }

  for (const [pattern, surface, run] of routes) {
    if (pattern.test(path)) {
      try {
        const result = await run();
        if (myNav !== nav) {
          // A newer navigation started while this route was in flight;
          // discard this result instead of applying it to the wrong page.
          if (typeof result === "function") {
            try {
              result();
            } catch (err) {
              console.warn("[learning-child] cleanup failed", err);
            }
          }
          return;
        }
        cleanup = result;
      } catch {
        if (myNav !== nav) return;
        reportFailure(surface);
      }
      return;
    }
  }
}

installHideStyle();
window.addEventListener("yt-navigate-finish", () => void route());
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void route());
} else {
  void route();
}
