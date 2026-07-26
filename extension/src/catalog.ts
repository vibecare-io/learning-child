import type { AllowedChannels, Catalog } from "../../shared/types";

export async function loadCatalog(): Promise<Catalog> {
  const { catalog } = await chrome.storage.local.get("catalog");
  if (catalog) return catalog as Catalog;
  const res = await fetch(chrome.runtime.getURL("seed-catalog.json"));
  return (await res.json()) as Catalog;
}

export async function loadAllowed(): Promise<AllowedChannels> {
  const { allowed } = await chrome.storage.local.get("allowed");
  if (allowed) return allowed as AllowedChannels;
  const catalog = await loadCatalog();
  return { channelIds: [...new Set(catalog.videos.map((v) => v.channelId))], handles: [] };
}

export async function getActiveProfile(catalog: Catalog): Promise<string> {
  const { profile } = await chrome.storage.sync.get("profile");
  if (typeof profile === "string" && catalog.profiles[profile]) return profile;
  return Object.keys(catalog.profiles)[0];
}
