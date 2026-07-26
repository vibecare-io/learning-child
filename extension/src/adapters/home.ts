import { loadCatalog, getActiveProfile } from "../catalog";
import { dailyFeed, todayStr } from "../feed";
import { renderGrid } from "../ui";
import { waitFor } from "../dom";
import { HOME_GRID } from "../selectors";

export async function runHome(): Promise<void> {
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(HOME_GRID);
  document.getElementById("lc-home-grid")?.remove();
  const grid = renderGrid(dailyFeed(catalog, profile, todayStr()));
  grid.id = "lc-home-grid";
  if (!host.parentElement) return;
  host.parentElement.insertBefore(grid, host);
}
