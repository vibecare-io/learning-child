import { matchesBlockedKeyword } from "../../shared/safety";
import type { CatalogVideo } from "../../shared/types";
import { getPrefs, DEFAULT_CONTROLS, type ParentControls } from "./prefs";

// Canonical import point for consumers (adapters, side panel): the shapes are
// defined in prefs.ts (which owns the stored-prefs types) and re-exported here.
export { DEFAULT_CONTROLS };
export type { ParentControls };

export function applySafety(videos: CatalogVideo[], controls: ParentControls): CatalogVideo[] {
  return videos.filter((v) => {
    if (controls.blockedVideoIds.includes(v.id)) return false;
    if (matchesBlockedKeyword(v.title, controls.blockedKeywords)) return false;
    if (!controls.supervisedMode && v.flags?.includes("supervision")) return false;
    return true;
  });
}

/**
 * Parent controls live in the shared prefs store (chrome.storage.local, key
 * "prefs") alongside onboarding/profile/interests. getPrefs() only shallow-
 * merges the top-level Prefs object, so a partial stored parentControls
 * (e.g. { supervisedMode: true } written before other fields existed) would
 * clobber the nested defaults for blockedKeywords/blockedVideoIds. Guard
 * against that with an explicit nested merge here.
 */
export async function loadControls(): Promise<ParentControls> {
  const { parentControls } = await getPrefs();
  return { ...DEFAULT_CONTROLS, ...((parentControls as Partial<ParentControls> | undefined) ?? {}) };
}
