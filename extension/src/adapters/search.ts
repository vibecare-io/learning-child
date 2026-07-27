import { loadAllowed, loadCatalog, getActiveProfile } from "../catalog";
import { dailyFeed, todayStr } from "../feed";
import { renderGrid } from "../ui";
import { waitFor } from "../dom";
import {
  SEARCH_RESULTS,
  SEARCH_RESULT_ITEM,
  SEARCH_SHELF_ITEMS,
  CHANNEL_LINK_IN_RESULT,
} from "../selectors";
import type { AllowedChannels } from "../../../shared/types";
import { isAllowed } from "../search-filter";
import { applySafety, loadControls } from "../safety";

const EMPTY_CHECK_DELAY_MS = 3000;
const EMPTY_SUGGESTION_COUNT = 8;

function filterResults(container: Element, allowed: AllowedChannels): number {
  let kept = 0;
  for (const item of container.querySelectorAll(SEARCH_RESULT_ITEM)) {
    const link = item.querySelector<HTMLAnchorElement>(CHANNEL_LINK_IN_RESULT);
    if (isAllowed(link?.getAttribute("href") ?? null, allowed)) kept++;
    else item.remove();
  }
  for (const shelf of container.querySelectorAll(SEARCH_SHELF_ITEMS)) shelf.remove();
  return kept;
}

async function showEmptyPanel(container: Element): Promise<void> {
  if (document.getElementById("lc-search-empty")) return;
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const suggestions = applySafety(dailyFeed(catalog, profile, todayStr()), await loadControls()).slice(
    0,
    EMPTY_SUGGESTION_COUNT,
  );
  const panel = document.createElement("div");
  panel.id = "lc-search-empty";
  const heading = document.createElement("h2");
  heading.textContent = "Nothing here for that search - try one of these!";
  heading.style.cssText = "padding: 24px 24px 0; font-family: Roboto, Arial, sans-serif;";
  panel.append(heading, renderGrid(suggestions));
  container.prepend(panel);
}

export async function runSearch(): Promise<() => void> {
  const allowed = await loadAllowed();
  const container = await waitFor(SEARCH_RESULTS);
  document.getElementById("lc-search-empty")?.remove();

  filterResults(container, allowed);
  const observer = new MutationObserver(() => filterResults(container, allowed));
  observer.observe(container, { childList: true, subtree: true });

  const emptyTimer = setTimeout(() => {
    if (filterResults(container, allowed) === 0 && !container.querySelector(SEARCH_RESULT_ITEM)) {
      void showEmptyPanel(container);
    }
  }, EMPTY_CHECK_DELAY_MS);

  return () => {
    observer.disconnect();
    clearTimeout(emptyTimer);
  };
}
