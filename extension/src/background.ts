import { getPrefs, onPrefsChanged, PROD_CATALOG_URL } from "./prefs";

const REFRESH_ALARM = "refresh-catalog";
const REFRESH_MINUTES = 240;

/**
 * A fresh install has no catalogUrl in sync storage, so refreshCatalog()
 * above returns early forever and the extension is stuck on the bundled
 * seed catalog - whose sources have no channel handles, so a modern
 * YouTube search (which links channels by /@handle) filters out every
 * result. Default new installs to this project's hosted catalog so search
 * and the curated feeds work out of the box; a parent who wants a different
 * source can still change it from the settings panel at any time.
 *
 * Only sets it, doesn't fetch directly: writing catalogUrl fires the
 * chrome.storage.onChanged listener below, which calls refreshCatalog() once
 * the write is visible to storage reads - so ordering (set before the first
 * read) is guaranteed by the storage API itself, not by a manual sequence.
 */
async function ensureDefaultCatalogUrl(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  if (typeof catalogUrl === "string" && catalogUrl) return;
  await chrome.storage.sync.set({ catalogUrl: PROD_CATALOG_URL });
}

async function refreshCatalog(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  if (typeof catalogUrl !== "string" || !catalogUrl) return;
  const base = catalogUrl.replace(/\/+$/, "");
  try {
    const [catalog, allowed] = await Promise.all([
      fetch(`${base}/catalog.json`).then((r) => {
        if (!r.ok) throw new Error(`catalog.json ${r.status}`);
        return r.json();
      }),
      fetch(`${base}/allowed-channels.json`).then((r) => {
        if (!r.ok) throw new Error(`allowed-channels.json ${r.status}`);
        return r.json();
      }),
    ]);
    await chrome.storage.local.set({ catalog, allowed });
    await chrome.action.setBadgeText({ text: "" });
  } catch (err) {
    // Keep the cached catalog; kids never see an empty page.
    console.warn("[learning-child] catalog refresh failed", err);
  }
}

// The toolbar icon opens the side panel. Route it to onboarding until the
// parent finishes setup, then to the settings panel.
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function syncSidePanel(): Promise<void> {
  try {
    const { onboarded } = await getPrefs();
    await chrome.sidePanel.setOptions({ path: onboarded ? "settings.html" : "onboarding.html" });
  } catch {
    // sidePanel API unavailable on older Chrome; nothing to do.
  }
}
void syncSidePanel();
chrome.runtime.onStartup.addListener(() => void syncSidePanel());
onPrefsChanged(() => void syncSidePanel());

chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_MINUTES, delayInMinutes: 0 });
  // First install: walk the parent through onboarding (age, interests, screen time).
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    void ensureDefaultCatalogUrl();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void refreshCatalog();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.catalogUrl) void refreshCatalog();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "adapter-failure") {
    chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    chrome.action.setBadgeText({ text: "!" });
  }
});
