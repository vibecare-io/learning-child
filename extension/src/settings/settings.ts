import type { AllowedChannels, Catalog } from "../../../shared/types";

const PROD = "https://kids.vibecare.io/api";
const LOCAL = "http://localhost:8080/api";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const statusEl = $("status");
const msgEl = $<HTMLParagraphElement>("msg");
const customEl = $<HTMLInputElement>("custom");

const norm = (u: string) => u.trim().replace(/\/+$/, "");

function setRadio(value: string): void {
  const el = document.querySelector<HTMLInputElement>(`input[name="src"][value="${value}"]`);
  if (el) el.checked = true;
  customEl.disabled = value !== "custom";
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

async function showStatus(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  const { catalog } = await chrome.storage.local.get("catalog");
  const count = (catalog as Catalog | undefined)?.videos?.length;
  const source = typeof catalogUrl === "string" && catalogUrl ? new URL(catalogUrl).host : "bundled seed";
  statusEl.innerHTML =
    count != null
      ? `Active: <b>${count} videos</b> from <b>${source}</b>`
      : `Active: <b>bundled seed catalog</b>`;
}

async function init(): Promise<void> {
  const { catalogUrl } = await chrome.storage.sync.get("catalogUrl");
  const u = typeof catalogUrl === "string" ? norm(catalogUrl) : "";
  if (u === PROD) setRadio("prod");
  else if (u === LOCAL) setRadio("local");
  else if (u) {
    setRadio("custom");
    customEl.value = u;
  } else setRadio("prod");
  await showStatus();
}

async function apply(e: Event): Promise<void> {
  e.preventDefault();
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
    await showStatus();
  } catch (err) {
    say(`Couldn't load: ${(err as Error).message}`, "err");
  }
}

async function reset(): Promise<void> {
  await chrome.storage.sync.set({ catalogUrl: "" });
  await chrome.storage.local.remove(["catalog", "allowed"]);
  setRadio("prod");
  say("Reset to the bundled seed catalog. Reload YouTube.", "ok");
  await showStatus();
}

async function fetchJson<T>(u: string): Promise<T> {
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(u).pathname} → ${r.status}`);
  return (await r.json()) as T;
}

document.querySelectorAll<HTMLInputElement>('input[name="src"]').forEach((el) =>
  el.addEventListener("change", () => (customEl.disabled = el.value !== "custom")),
);
$("form").addEventListener("submit", apply);
$("reset").addEventListener("click", reset);
void init();
