import type { AllowedChannels, Catalog } from "../../../shared/types";
import { formatHours, getHistory, localDayStr, recentVideos, secondsToday, weekTotalSec } from "../history";
import { getPrefs, setPrefs, PROD_CATALOG_URL } from "../prefs";
import { DEFAULT_CONTROLS, type ParentControls } from "../safety";
import { extractVideoId } from "./video-id";
import { matchesQuery } from "./search";

const PROD = PROD_CATALOG_URL;
const LOCAL = "http://localhost:8080/api";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const norm = (u: string) => u.trim().replace(/\/+$/, "");

/** Parse an integer input, falling back to `fallback` and clamping to [min, max]. */
function clampInt(raw: string, fallback: number, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// --- Elements ---------------------------------------------------------------
const app = $("app");
const lockBtn = $<HTMLButtonElement>("lock");
const searchInput = $<HTMLInputElement>("search");
const noResults = $("noresults");
const nrq = $("nrq");
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));
const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
const settingEls = () => Array.from(document.querySelectorAll<HTMLElement>(".setting"));

// Lock gate (shown instead of the whole app while a PIN is set and unentered)
const gate = $("gate");
const gateTitle = $("gate-title");
const gateHint = $("gate-hint");
const gateInput = $<HTMLInputElement>("gate-input");
const gateMsg = $<HTMLParagraphElement>("gate-msg");
const gateOk = $<HTMLButtonElement>("gate-ok");

// Home tiles
const homeCatalog = $("home-catalog");
const homeProfile = $("home-profile");
const homeSupervised = $("home-supervised");
const homeReels = $("home-reels");
const homeScreen = $("home-screen");
const homeWords = $("home-words");
const homeVideos = $("home-videos");

// Settings (parent controls)
const pcSupervised = $<HTMLInputElement>("pc-supervised");
const pcReelsLimit = $<HTMLInputElement>("pc-reels-limit");
const pcReelsCooldown = $<HTMLInputElement>("pc-reels-cooldown");
const pcScreen = $<HTMLInputElement>("pc-screen");
const pcKeywords = $<HTMLTextAreaElement>("pc-keywords");
const pcBlocked = $<HTMLTextAreaElement>("pc-blocked");
const pcSave = $<HTMLButtonElement>("pc-save");
const pcStatus = $<HTMLParagraphElement>("pc-status");
const pcChangePin = $<HTMLButtonElement>("pc-change-pin");
const pinStateEl = $("pin-state");
const pcHoursToday = $("pc-hours-today");
const pcHoursWeek = $("pc-hours-week");
const pcRecent = $("pc-recent");
const pcRecentToggle = $<HTMLButtonElement>("pc-recent-toggle");

// Configuration (catalog source)
const customEl = $<HTMLInputElement>("custom");
const msgEl = $<HTMLParagraphElement>("msg");

// PIN modal
const pinModal = $("pin-modal");
const pinTitle = $("pin-title");
const pinHint = $("pin-hint");
const pinInput = $<HTMLInputElement>("pin-input");
const pinMsg = $<HTMLParagraphElement>("pin-msg");
const pinOk = $<HTMLButtonElement>("pin-ok");
const pinCancel = $<HTMLButtonElement>("pin-cancel");

// --- Lock gate --------------------------------------------------------------
// While locked, ONLY the PIN gate is shown; the app (tabs/search/content) is
// hidden entirely. Unlocking swaps them and loads fresh data.
let unlocked = false;

// The gate does double duty: "unlock" (a PIN already exists - check it) and
// "create" (no PIN yet - the kid must not land straight in the fully-
// unlocked app, or they could raise limits/clear blocklists/set their own
// PIN and lock the parent out). init() picks the mode; onLock() always
// re-enters via the "unlock" mode since a PIN necessarily exists by then.
let gateMode: "unlock" | "create" = "unlock";

function setUnlocked(v: boolean): void {
  unlocked = v;
  gate.hidden = v;
  app.hidden = !v;
}

/** Reveal the app and (re)load its data from storage. */
async function enterApp(): Promise<void> {
  setUnlocked(true);
  await Promise.all([initConfig(), loadSettingsValues(), renderHome(), renderActivity()]);
}

/** Hide the app and show the PIN gate in "enter your PIN" mode. */
function lockToGate(): void {
  clearSearch();
  gateMode = "unlock";
  gateTitle.textContent = "Enter your PIN";
  gateHint.textContent = "Enter your PIN to open settings.";
  gateOk.textContent = "Unlock";
  gateMsg.textContent = "";
  gateInput.value = "";
  setUnlocked(false);
  gateInput.focus();
}

/** Show the PIN gate in "create a PIN" mode (no PIN exists yet). */
function showGateForCreate(): void {
  gateMode = "create";
  gateTitle.textContent = "Set a PIN";
  gateHint.textContent = "First visit - choose a 4+ digit PIN to protect these settings.";
  gateOk.textContent = "Set PIN";
  gateMsg.textContent = "";
  gateInput.value = "";
  setUnlocked(false);
  gateInput.focus();
}

async function gateSubmit(): Promise<void> {
  const entered = gateInput.value.trim();
  if (gateMode === "create") {
    if (!/^\d{4,}$/.test(entered)) {
      gateMsg.textContent = "PIN must be at least 4 digits";
      gateMsg.className = "msg err";
      gateInput.value = "";
      gateInput.focus();
      return;
    }
    await setPrefs({ parentPin: entered });
    await enterApp();
    return;
  }
  const { parentPin } = await getPrefs();
  if (!parentPin || entered === parentPin) {
    await enterApp();
    return;
  }
  gateMsg.textContent = "Wrong PIN";
  gateMsg.className = "msg err";
  gateInput.value = "";
  gateInput.focus();
}

// --- PIN modal --------------------------------------------------------------
let pinSubmit: (pin: string) => Promise<void> | void = () => {};

function openPin(opts: {
  title: string;
  hint: string;
  okLabel: string;
  onSubmit: (pin: string) => Promise<void> | void;
}): void {
  pinTitle.textContent = opts.title;
  pinHint.textContent = opts.hint;
  pinOk.textContent = opts.okLabel;
  pinMsg.textContent = "";
  pinInput.value = "";
  pinSubmit = opts.onSubmit;
  pinModal.hidden = false;
  pinInput.focus();
}

function closePin(): void {
  pinModal.hidden = true;
}

async function submitPin(): Promise<void> {
  try {
    await pinSubmit(pinInput.value.trim());
    closePin();
  } catch (err) {
    pinMsg.textContent = (err as Error).message;
    pinMsg.className = "msg err";
  }
}

async function onLock(): Promise<void> {
  // The header lock is only visible while unlocked, so this always means "lock".
  const { parentPin } = await getPrefs();
  if (parentPin) {
    lockToGate();
    return;
  }
  // No PIN yet — can't lock without one, so set it first, then lock.
  openPin({
    title: "Set a PIN",
    hint: "Create a 4+ digit PIN to lock settings.",
    okLabel: "Set & lock",
    onSubmit: async (pin) => {
      if (!/^\d{4,}$/.test(pin)) throw new Error("PIN must be at least 4 digits");
      await setPrefs({ parentPin: pin });
      pinStateEl.textContent = "PIN set";
      lockToGate();
    },
  });
}

function onChangePin(): void {
  if (!unlocked) return;
  openPin({
    title: "Change PIN",
    hint: "Enter a new 4+ digit PIN.",
    okLabel: "Save",
    onSubmit: async (pin) => {
      if (!/^\d{4,}$/.test(pin)) throw new Error("PIN must be at least 4 digits");
      await setPrefs({ parentPin: pin });
      pinStateEl.textContent = "PIN set";
    },
  });
}

// --- Tabs -------------------------------------------------------------------
function showTab(name: string): void {
  for (const t of tabs) t.classList.toggle("active", t.dataset.tab === name);
  for (const p of panels) p.classList.toggle("active", p.dataset.tab === name);
}

// --- Search -----------------------------------------------------------------
function runSearch(query: string): void {
  const q = query.trim();
  document.body.classList.toggle("searching", q !== "");

  if (!q) {
    for (const s of settingEls()) s.style.display = "";
    for (const sec of document.querySelectorAll<HTMLElement>(".section")) sec.style.display = "";
    noResults.hidden = true;
    return;
  }

  let anyMatch = false;
  for (const s of settingEls()) {
    const hay = `${s.textContent ?? ""} ${s.dataset.keywords ?? ""}`;
    const match = matchesQuery(hay, q);
    s.style.display = match ? "" : "none";
    if (match) anyMatch = true;
  }
  // Collapse sections whose settings are all hidden (Home sections have none).
  for (const sec of document.querySelectorAll<HTMLElement>(".panel .section")) {
    const shown = Array.from(sec.querySelectorAll<HTMLElement>(".setting")).some(
      (s) => s.style.display !== "none",
    );
    sec.style.display = shown ? "" : "none";
  }
  nrq.textContent = q;
  noResults.hidden = anyMatch;
}

function clearSearch(): void {
  searchInput.value = "";
  runSearch("");
}

// --- Configuration (catalog source) ----------------------------------------
function setRadio(value: string): void {
  const el = document.querySelector<HTMLInputElement>(`input[name="src"][value="${value}"]`);
  if (el) el.checked = true;
  syncCustomEnabled();
}

function syncCustomEnabled(): void {
  const custom = document.querySelector<HTMLInputElement>('input[name="src"]:checked')?.value === "custom";
  customEl.disabled = !custom;
}

function selectedUrl(): string | null {
  const v = document.querySelector<HTMLInputElement>('input[name="src"]:checked')?.value;
  if (v === "prod") return PROD;
  if (v === "local") return LOCAL;
  if (v === "custom") return norm(customEl.value) || null;
  return null;
}

function say(text: string, kind: "ok" | "err" | "" = ""): void {
  msgEl.textContent = text;
  msgEl.className = `msg ${kind}`;
}

function sayPc(text: string, kind: "ok" | "err" | "" = ""): void {
  pcStatus.textContent = text;
  pcStatus.className = `msg ${kind}`;
}

async function fetchJson<T>(u: string): Promise<T> {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(u).pathname} → ${r.status}`);
  return (await r.json()) as T;
}

async function applyCatalog(): Promise<void> {
  if (!unlocked) return;
  const url = selectedUrl();
  if (!url) {
    say("Enter a custom URL first.", "err");
    return;
  }
  say("Loading…");
  try {
    const [catalog, allowed] = await Promise.all([
      fetchJson<Catalog>(`${url}/catalog.json`),
      fetchJson<AllowedChannels>(`${url}/allowed-channels.json`),
    ]);
    await chrome.storage.local.set({ catalog, allowed });
    await chrome.storage.sync.set({ catalogUrl: url });
    say(`✓ Loaded ${catalog.videos.length} videos from ${new URL(url).host}. Reload YouTube to see them.`, "ok");
    await renderHome();
  } catch (err) {
    say(`Couldn't load: ${(err as Error).message}`, "err");
  }
}

async function resetCatalog(): Promise<void> {
  if (!unlocked) return;
  await chrome.storage.sync.set({ catalogUrl: "" });
  await chrome.storage.local.remove(["catalog", "allowed"]);
  setRadio("prod");
  say("Reset to the bundled seed catalog. Reload YouTube.", "ok");
  await renderHome();
}

// --- Parent controls (Settings tab) -----------------------------------------
async function saveParentControls(): Promise<void> {
  if (!unlocked) return;
  const ids = pcBlocked.value
    .split("\n")
    .map((line) => extractVideoId(line))
    .filter((id): id is string => id !== null);
  const controls: ParentControls = {
    supervisedMode: pcSupervised.checked,
    reelsLimit: clampInt(pcReelsLimit.value, DEFAULT_CONTROLS.reelsLimit, 0, 50),
    reelsCooldownMinutes: clampInt(pcReelsCooldown.value, DEFAULT_CONTROLS.reelsCooldownMinutes, 1, 240),
    blockedKeywords: pcKeywords.value.split("\n").map((k) => k.trim().toLowerCase()).filter(Boolean),
    blockedVideoIds: [...new Set(ids)],
  };
  const screenRaw = pcScreen.value.trim();
  const screenTimeMinutes = screenRaw === "" ? null : clampInt(screenRaw, 0, 0, 1440);
  // Reflect any clamping/normalization back into the inputs.
  pcReelsLimit.value = String(controls.reelsLimit);
  pcReelsCooldown.value = String(controls.reelsCooldownMinutes);
  pcScreen.value = screenTimeMinutes == null ? "" : String(screenTimeMinutes);
  pcBlocked.value = controls.blockedVideoIds.join("\n");
  await setPrefs({ parentControls: controls, screenTimeMinutes });
  sayPc("Saved — takes effect on next page load", "ok");
  setTimeout(() => sayPc(""), 3000);
  await renderHome();
}

// --- Load / render ----------------------------------------------------------
async function loadSettingsValues(): Promise<void> {
  const prefs = await getPrefs();
  const c: ParentControls = { ...DEFAULT_CONTROLS, ...(prefs.parentControls ?? {}) };
  pcSupervised.checked = c.supervisedMode;
  pcReelsLimit.value = String(c.reelsLimit);
  pcReelsCooldown.value = String(c.reelsCooldownMinutes);
  pcScreen.value = prefs.screenTimeMinutes != null ? String(prefs.screenTimeMinutes) : "";
  pcKeywords.value = c.blockedKeywords.join("\n");
  pcBlocked.value = c.blockedVideoIds.join("\n");
  pinStateEl.textContent = prefs.parentPin ? "PIN set" : "No PIN yet — set one to lock";
  pcChangePin.textContent = prefs.parentPin ? "Change" : "Set";
}

async function initConfig(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  const u = typeof catalogUrl === "string" ? norm(catalogUrl) : "";
  if (u === PROD) setRadio("prod");
  else if (u === LOCAL) setRadio("local");
  else if (u) {
    setRadio("custom");
    customEl.value = u;
  } else setRadio("prod");
}

async function renderHome(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  const { catalog } = await chrome.storage.local.get("catalog");
  const count = (catalog as Catalog | undefined)?.videos?.length;
  const source = typeof catalogUrl === "string" && catalogUrl ? new URL(catalogUrl).host : "bundled seed";
  homeCatalog.textContent = count != null ? `${count} videos · ${source}` : "Bundled seed catalog";

  const prefs = await getPrefs();
  const c: ParentControls = { ...DEFAULT_CONTROLS, ...(prefs.parentControls ?? {}) };
  homeProfile.textContent = cap(prefs.profile);
  homeSupervised.textContent = c.supervisedMode ? "On" : "Off";
  homeReels.textContent = c.reelsLimit === 0 ? "Blocked" : String(c.reelsLimit);
  homeScreen.textContent = prefs.screenTimeMinutes ? `${prefs.screenTimeMinutes}m` : "None";
  homeWords.textContent = String(c.blockedKeywords.length);
  homeVideos.textContent = String(c.blockedVideoIds.length);
}

/** Builds a plain "setting" row with a single italic/muted line of text. */
function noteRow(text: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "setting";
  row.innerHTML = `<div class="txt"><small></small></div>`;
  row.querySelector("small")!.textContent = text;
  return row;
}

/** Builds one read-only "recently watched" row (title/channel/minutes). */
function recentRow(v: { title: string; channel: string; totalSec: number }): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "setting";
  row.innerHTML = `<div class="head"><span class="txt"><b class="title"></b><small></small></span><span class="mins"></span></div>`;
  row.querySelector("b")!.textContent = v.title;
  row.querySelector("small")!.textContent = v.channel;
  row.querySelector(".mins")!.textContent = `${Math.floor(v.totalSec / 60)} m`;
  return row;
}

// The recent-watched list starts collapsed to this many rows; the toggle
// (or tapping the list) expands it to show everything.
const RECENT_COLLAPSED = 4;
const RECENT_MAX = 60;
let recentExpanded = false;

function applyRecentCollapse(): void {
  pcRecent.classList.toggle("collapsed", !recentExpanded);
  pcRecentToggle.textContent = recentExpanded ? "Show less" : "Show all";
}

/**
 * Read-only "Watch activity" stats on the Home tab — today's/this-week's watch
 * time (bucketed by the parent's LOCAL day) and the most-recently-watched
 * videos, collapsed to RECENT_COLLAPSED until expanded. Derived entirely from
 * getHistory(); no storage is written here. Re-run on unlock and live whenever
 * the content script writes new watch history (see the storage listener).
 */
async function renderActivity(): Promise<void> {
  const history = await getHistory();
  const today = localDayStr();
  pcHoursToday.textContent = formatHours(secondsToday(history, today));
  pcHoursWeek.textContent = formatHours(weekTotalSec(history, today));

  const recent = recentVideos(history, RECENT_MAX);
  pcRecent.replaceChildren(...(recent.length ? recent.map(recentRow) : [noteRow("No videos watched yet.")]));
  pcRecentToggle.hidden = recent.length <= RECENT_COLLAPSED;
  applyRecentCollapse();
}

function toggleRecent(): void {
  if (pcRecentToggle.hidden) return; // nothing hidden to reveal
  recentExpanded = !recentExpanded;
  applyRecentCollapse();
}

// --- Wiring -----------------------------------------------------------------
gateOk.addEventListener("click", () => void gateSubmit());
pcRecentToggle.addEventListener("click", toggleRecent);
pcRecent.addEventListener("click", toggleRecent); // tapping the list expands it too

// Live-refresh the activity view whenever the content script records new watch
// time — without this the panel is a stale snapshot from the moment it opened.
chrome.storage.onChanged.addListener((changes, area) => {
  if (unlocked && area === "local" && changes.watchHistory) void renderActivity();
});
gateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void gateSubmit();
});
lockBtn.addEventListener("click", () => void onLock());
pcChangePin.addEventListener("click", onChangePin);
pinOk.addEventListener("click", () => void submitPin());
pinCancel.addEventListener("click", closePin);
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void submitPin();
  if (e.key === "Escape") closePin();
});
pinModal.addEventListener("click", (e) => {
  if (e.target === pinModal) closePin();
});

for (const t of tabs) {
  t.addEventListener("click", () => {
    clearSearch();
    showTab(t.dataset.tab ?? "home");
  });
}

searchInput.addEventListener("input", () => runSearch(searchInput.value));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") clearSearch();
});

document.querySelectorAll<HTMLInputElement>('input[name="src"]').forEach((el) =>
  el.addEventListener("change", syncCustomEnabled),
);
$<HTMLButtonElement>("apply").addEventListener("click", () => void applyCatalog());
$<HTMLButtonElement>("reset").addEventListener("click", () => void resetCatalog());
pcSave.addEventListener("click", () => void saveParentControls());

async function init(): Promise<void> {
  const { parentPin } = await getPrefs();
  if (parentPin) {
    // Locked: the gate is already the only visible surface (app starts hidden).
    gateMode = "unlock";
    gateInput.focus();
  } else {
    // No PIN yet - require creating one before entering the app; the app
    // stays hidden (see #app[hidden] in settings.html) until it's set.
    showGateForCreate();
  }
}

void init();
