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
    chrome.runtime.sendMessage({ type: "adapter-failure", surface });
  } catch {
    // extension context gone (e.g. reloaded) — nothing to do
  }
}

type Cleanup = void | (() => void);
let cleanup: Cleanup;

const routes: [RegExp, string, () => Promise<Cleanup>][] = [
  [/^\/$/, "home", runHome],
  // watch (Task 12) and search (Task 13) adapters register here
];

async function route(): Promise<void> {
  if (typeof cleanup === "function") cleanup();
  cleanup = undefined;

  const path = location.pathname;
  if (path.startsWith("/shorts")) {
    location.replace("https://www.youtube.com/");
    return;
  }
  for (const [pattern, surface, run] of routes) {
    if (pattern.test(path)) {
      try {
        cleanup = await run();
      } catch {
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
