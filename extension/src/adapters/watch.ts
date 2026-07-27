import { loadCatalog, getActiveProfile } from "../catalog";
import { upNext, todayStr } from "../feed";
import { renderList } from "../ui";
import { waitFor } from "../dom";
import { WATCH_SIDEBAR } from "../selectors";
import { applySafety, loadControls } from "../safety";

export async function runWatch(): Promise<void> {
  const currentId = new URLSearchParams(location.search).get("v");
  if (!currentId) return;
  const catalog = await loadCatalog();
  const profile = await getActiveProfile(catalog);
  const host = await waitFor(WATCH_SIDEBAR);
  document.getElementById("lc-upnext")?.remove();
  const videos = applySafety(upNext(catalog, profile, currentId, todayStr()), await loadControls());
  const list = renderList(videos);
  list.id = "lc-upnext";
  host.prepend(list);
}
