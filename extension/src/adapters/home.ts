import { loadCatalog, getActiveProfile } from "../catalog";
import { backfill, dailyFeed, splitWatched, todayStr } from "../feed";
import { renderGrid, renderChips, renderDoneToday } from "../ui";
import { waitFor } from "../dom";
import { HOME_GRID } from "../selectors";
import { applySafety, loadControls } from "../safety";
import { getHistory, isOverLimit, secondsToday } from "../history";
import { getPrefs } from "../prefs";

/** Canonical topic order for the chip bar (only the ones present in the feed show). */
const TOPIC_ORDER = [
  "science", "maths", "space", "engineering", "making", "art", "music",
  "nature", "animals", "exploration", "coding", "tech", "reading", "history", "geography",
];

/** Special chip id (not a real topic) that swaps the grid to the hidden watched list. */
const WATCHED_CHIP = "watched";

export async function runHome(): Promise<void> {
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(HOME_GRID);
  document.getElementById("lc-home")?.remove();

  const [history, prefs] = await Promise.all([getHistory(), getPrefs()]);
  const wrap = document.createElement("div");
  wrap.id = "lc-home";

  // Over the parent's daily screen-time limit: swap the whole grid+chips UI
  // for a calm, non-shaming panel instead - no thumbnails, no chips, no
  // Watched tab. Checked before touching the feed since there's nothing to
  // build in this branch.
  if (isOverLimit(prefs.screenTimeMinutes, secondsToday(history, todayStr()))) {
    wrap.append(renderDoneToday());
    if (!host.parentElement) return;
    host.parentElement.insertBefore(wrap, host);
    return;
  }

  const feed = applySafety(dailyFeed(catalog, profile, todayStr()), await loadControls());
  // Watched videos are hidden from the default grid (behind the Watched chip);
  // backfill tops the grid back up to MIN_GRID from the least-recently-watched
  // so it's never empty while the catalog has videos. The Watched chip shows
  // watchedRest (not the full watched list) so a backfilled video never appears
  // both in the default grid and under Watched.
  const { unwatched, watched } = splitWatched(feed, history);
  const { grid, watchedRest } = backfill(unwatched, watched);

  const present = TOPIC_ORDER.filter((t) => grid.some((v) => v.topics.includes(t)));
  // Real YouTube's chip bar always starts with a highlighted "All", so ours must
  // too - the Watched chip goes last, and only when it has something to show
  // (every watched video may have been backfilled into the grid).
  const topics = ["all", ...present, ...(watchedRest.length > 0 ? [WATCHED_CHIP] : [])];

  const gridHolder = document.createElement("div");
  gridHolder.id = "lc-grid-holder";
  const showGrid = (topic: string): void => {
    const videos =
      topic === WATCHED_CHIP ? watchedRest : topic === "all" ? grid : grid.filter((v) => v.topics.includes(topic));
    gridHolder.replaceChildren(renderGrid(videos));
  };

  let active = "all";
  const chips = renderChips(topics, active, (topic) => {
    active = topic;
    wrap
      .querySelectorAll<HTMLElement>(".lc-chip")
      .forEach((el) => el.classList.toggle("lc-chip-on", el.dataset.topic === active));
    showGrid(active);
  });

  showGrid(active);
  wrap.append(chips, gridHolder);
  if (!host.parentElement) return;
  host.parentElement.insertBefore(wrap, host);
}
