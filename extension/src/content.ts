import { HIDE_SELECTORS } from "./selectors";
import { runHome } from "./adapters/home";

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
    // extension context gone (e.g. reloaded) — nothing to do
  }
}

type Cleanup = void | (() => void);
let cleanup: Cleanup;

// Navigation generation token: serializes route() runs so a stale in-flight
// navigation can't insert into the wrong page's DOM or clobber the cleanup
// left behind by a newer navigation.
let nav = 0;

const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  // watch (Task 12) and search (Task 13) adapters register here
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
  if (path === "/shorts" || path.startsWith("/shorts/")) {
    location.replace("https://www.youtube.com/");
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
