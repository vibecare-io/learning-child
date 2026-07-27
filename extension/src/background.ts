import { getPrefs, onPrefsChanged } from "./prefs";

const REFRESH_ALARM = "refresh-catalog";
const REFRESH_MINUTES = 240;

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
