import { loadCatalog, getActiveProfile } from "../catalog";
import { upNext, todayStr } from "../feed";
import { renderList } from "../ui";
import { waitFor } from "../dom";
import { WATCH_SIDEBAR, AUTONAV_TOGGLE } from "../selectors";
import { applySafety, loadControls } from "../safety";

const AUTOPLAY_POLL_MS = 500;
const AUTOPLAY_GIVE_UP_MS = 15_000;

/**
 * YouTube's "Autoplay next video" toggle defaults to on. Left alone, the
 * moment a curated video ends the player hands the kid off to whatever
 * algorithmic video YouTube picks next - exactly the recommendation surface
 * this extension exists to replace. The player (and its toggle) mounts
 * asynchronously and isn't present on first paint, so poll for it rather
 * than querying once. Once found checked, click it off and stop polling.
 * Give up after AUTOPLAY_GIVE_UP_MS so a page that never gets a player
 * (or where the toggle starts already off) doesn't leak a live interval.
 *
 * Exported standalone (rather than folded into runWatch) so it can be unit
 * tested with fake timers without touching any chrome.* API.
 */
export function disableAutoplay(): () => void {
  let elapsed = 0;
  const timer = setInterval(() => {
    const toggle = document.querySelector<HTMLElement>(AUTONAV_TOGGLE);
    if (toggle?.getAttribute("aria-checked") === "true") {
      toggle.click();
      clearInterval(timer);
      return;
    }
    elapsed += AUTOPLAY_POLL_MS;
    if (elapsed >= AUTOPLAY_GIVE_UP_MS) clearInterval(timer);
  }, AUTOPLAY_POLL_MS);
  return () => clearInterval(timer);
}

export async function runWatch(): Promise<() => void> {
  const cancelAutoplay = disableAutoplay();
  const currentId = new URLSearchParams(location.search).get("v");
  if (!currentId) return cancelAutoplay;
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(WATCH_SIDEBAR);
  document.getElementById("lc-upnext")?.remove();
  // Pull a larger pool before filtering so a few safety-blocked videos don't
  // shrink the final list below 15 - filter first, then slice to size.
  const pool = applySafety(upNext(catalog, profile, currentId, todayStr(), 50), await loadControls());
  const videos = pool.slice(0, 15);
  const list = renderList(videos);
  list.id = "lc-upnext";
  host.prepend(list);
  return cancelAutoplay;
}
