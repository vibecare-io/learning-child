import type { AllowedChannels, Catalog } from "../../shared/types";

export async function loadCatalog(): Promise<Catalog> {
  const { catalog } = await chrome.storage.local.get("catalog");
  if (catalog) return catalog as Catalog;
  const url = chrome.runtime.getURL("seed-catalog.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`loadCatalog: fetch ${url} failed (${res.status})`);
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
  const profiles = Object.keys(catalog.profiles);
  // Default to the first profile that actually has videos so a catalog whose
  // content is tagged for only some profiles never renders a blank feed.
  const withVideos = profiles.find((p) => catalog.videos.some((v) => v.profiles.includes(p)));
  return withVideos ?? profiles[0];
}
