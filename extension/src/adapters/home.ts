import { loadCatalog, getActiveProfile } from "../catalog";
import { dailyFeed, todayStr } from "../feed";
import { renderGrid, renderChips } from "../ui";
import { waitFor } from "../dom";
import { HOME_GRID } from "../selectors";

/** Canonical topic order for the chip bar (only the ones present in the feed show). */
const TOPIC_ORDER = [
  "science", "maths", "space", "engineering", "making", "art", "music",
  "nature", "animals", "exploration", "coding", "tech", "reading", "history", "geography",
];

export async function runHome(): Promise<void> {
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(HOME_GRID);
  document.getElementById("lc-home")?.remove();

  const feed = dailyFeed(catalog, profile, todayStr());
  const present = TOPIC_ORDER.filter((t) => feed.some((v) => v.topics.includes(t)));
  const topics = ["all", ...present];

  const wrap = document.createElement("div");
  wrap.id = "lc-home";

  const gridHolder = document.createElement("div");
  gridHolder.id = "lc-grid-holder";
  const showGrid = (topic: string): void => {
    const videos = topic === "all" ? feed : feed.filter((v) => v.topics.includes(topic));
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
