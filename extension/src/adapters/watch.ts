import { loadCatalog, getActiveProfile } from "../catalog";
import { upNext, todayStr } from "../feed";
import { renderList } from "../ui";
import { waitFor } from "../dom";
import { WATCH_SIDEBAR, AUTONAV_TOGGLE, VIDEO_PLAYER } from "../selectors";
import { applySafety, loadControls } from "../safety";
import { getHistory, isOverLimit, localDayStr, recordTick, secondsToday } from "../history";
import { getPrefs } from "../prefs";

const AUTOPLAY_POLL_MS = 500;
const AUTOPLAY_GIVE_UP_MS = 15_000;
const RECORD_INTERVAL_MS = 5_000;
// Cap a single interval's credit so a seek, or a throttled/backgrounded gap,
// can't dump minutes into history in one tick.
const MAX_TICK_SEC = 15;

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

/**
 * Records watch time for the current video by sampling the player's
 * `currentTime` every RECORD_INTERVAL_MS and crediting the REAL elapsed
 * playback between samples (not a flat interval). Because it reads the
 * video's own clock, pauses, seeks and 2x speed are handled for free: a
 * pause freezes currentTime (delta ~0), a seek jumps it (delta clamped out).
 * Time is only credited across an interval where BOTH ends were eligible -
 * player present, playing (not paused/ended), tab visible - so tabbing away
 * or pausing never racks up seconds. Exported standalone (like
 * disableAutoplay) so it's unit-testable with fake timers without touching
 * chrome.* (recordTick is the only chrome.storage call, stubbed in tests).
 */
export function startRecorder(videoId: string, meta: { title: string; channel: string }): () => void {
  let lastTime: number | null = null;
  let lastEligible = false;
  const timer = setInterval(() => {
    const player = document.querySelector<HTMLVideoElement>(VIDEO_PLAYER);
    if (!player) {
      lastTime = null;
      lastEligible = false;
      return;
    }
    const now = player.currentTime;
    const eligible = !player.paused && !player.ended && document.visibilityState === "visible";
    if (eligible && lastEligible && lastTime !== null) {
      const delta = now - lastTime;
      if (delta > 0 && delta <= MAX_TICK_SEC) {
        void recordTick(videoId, meta, delta, localDayStr());
      }
    }
    lastTime = now;
    lastEligible = eligible;
  }, RECORD_INTERVAL_MS);
  return () => clearInterval(timer);
}

export async function runWatch(): Promise<() => void> {
  const cancelAutoplay = disableAutoplay();
  const currentId = new URLSearchParams(location.search).get("v");
  if (!currentId) return cancelAutoplay;
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const current = catalog.videos.find((v) => v.id === currentId);
  const meta = current
    ? { title: current.title, channel: current.channel }
    : { title: document.title, channel: "" };
  const cancelRecorder = startRecorder(currentId, meta);

  // Over the daily screen-time limit: never interrupt the video that's
  // already playing (autoplay-blocking and the recorder both keep running
  // above) - just skip handing the kid a fresh up-next list to click into.
  // Also clear out any list injected on a prior navigation, in case the kid
  // crossed the limit mid-session.
  const [history, prefs] = await Promise.all([getHistory(), getPrefs()]);
  if (isOverLimit(prefs.screenTimeMinutes, secondsToday(history, localDayStr()))) {
    document.getElementById("lc-upnext")?.remove();
    return () => {
      cancelAutoplay();
      cancelRecorder();
    };
  }

  const host = await waitFor(WATCH_SIDEBAR);
  document.getElementById("lc-upnext")?.remove();
  // Pull a larger pool before filtering so a few safety-blocked videos don't
  // shrink the final list below 15 - filter first, then slice to size.
  const pool = applySafety(upNext(catalog, profile, currentId, todayStr(), 50), await loadControls());
  const videos = pool.slice(0, 15);
  const list = renderList(videos);
  list.id = "lc-upnext";
  host.prepend(list);
  return () => {
    cancelAutoplay();
    cancelRecorder();
  };
}
