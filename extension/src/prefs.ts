// Onboarding / parent preferences store.
//
// Backed by chrome.storage.local so every extension context (onboarding page,
// settings panel, background worker, and the content script on youtube.com)
// can read it — localStorage is per-origin and would not reach the content
// script. If this ever moves to React, this module maps 1:1 onto a Zustand store.

// Parent-controls shape lives here (prefs.ts owns the stored-prefs types) so
// the dependency stays one-directional: safety.ts -> prefs.ts. safety.ts
// re-exports these for its consumers.
export interface ParentControls {
  supervisedMode: boolean;
  blockedKeywords: string[];
  blockedVideoIds: string[];
}

export const DEFAULT_CONTROLS: ParentControls = {
  supervisedMode: false,
  blockedKeywords: [],
  blockedVideoIds: [],
};

export interface Prefs {
  onboarded: boolean;
  auth: { provider: "google"; email: string } | null;
  profile: string; // age profile id, e.g. "little" | "big"
  interests: string[]; // catalog topic ids, e.g. ["science", "space"]
  screenTimeMinutes: number | null; // daily limit; null = no limit
  parentControls: ParentControls;
  parentPin: string | null; // gates the Parent controls section in settings; null = not yet set
}

export const DEFAULT_PREFS: Prefs = {
  onboarded: false,
  auth: null,
  profile: "little",
  interests: [],
  screenTimeMinutes: null,
  parentControls: DEFAULT_CONTROLS,
  parentPin: null,
};

const KEY = "prefs";

export async function getPrefs(): Promise<Prefs> {
  const { prefs } = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_PREFS, ...(prefs as Partial<Prefs> | undefined) };
}

export async function setPrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  // Mirror the age profile into sync storage so the feed logic (getActiveProfile)
  // picks it up with no extra plumbing.
  if (patch.profile !== undefined) {
    await chrome.storage.sync.set({ profile: next.profile });
  }
  return next;
}

/** Subscribe to preference changes across contexts. Returns an unsubscribe fn. */
export function onPrefsChanged(cb: (prefs: Prefs) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === "local" && changes[KEY]) {
      cb({ ...DEFAULT_PREFS, ...(changes[KEY].newValue as Partial<Prefs>) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
