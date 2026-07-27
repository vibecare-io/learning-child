// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROD_CATALOG_URL } from "./prefs";

// background.ts registers all its listeners as side effects of being
// imported, so the test fixture is a full chrome.* stub with every API it
// (and the prefs.ts it imports) touches at module load: sidePanel,
// runtime.onStartup/onInstalled/onMessage, storage (local + sync +
// onChanged), alarms, tabs, action. Each addListener call stashes its
// callback so the test can invoke it directly, the way Chrome would.
function makeChromeStub(initialSync: Record<string, unknown> = {}) {
  const listeners: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const on = (name: string) => (cb: (...args: unknown[]) => unknown) => {
    (listeners[name] ??= []).push(cb);
  };
  const syncStore = { ...initialSync };
  const syncSet = vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(syncStore, items);
  });
  const chromeStub = {
    sidePanel: {
      setPanelBehavior: vi.fn(async () => {}),
      setOptions: vi.fn(async () => {}),
    },
    runtime: {
      onStartup: { addListener: vi.fn(on("startup")) },
      onInstalled: { addListener: vi.fn(on("installed")) },
      onMessage: { addListener: vi.fn(on("message")) },
      getURL: vi.fn((p: string) => p),
    },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      sync: { get: vi.fn(async () => ({ ...syncStore })), set: syncSet },
      onChanged: { addListener: vi.fn(on("storageChanged")) },
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn(on("alarm")) },
    },
    tabs: { create: vi.fn() },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
  };
  return { chromeStub, listeners, syncSet, syncStore };
}

async function flush(): Promise<void> {
  // ensureDefaultCatalogUrl does two sequential awaits (get, then set) -
  // a couple of microtask turns is enough to drain both.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("background onInstalled - default catalog URL", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the prod catalog URL on a fresh install with no catalogUrl configured", async () => {
    const { chromeStub, listeners, syncSet } = makeChromeStub();
    vi.stubGlobal("chrome", chromeStub);
    await import("./background");

    const installedHandlers = listeners.installed;
    expect(installedHandlers, "onInstalled listener should be registered").toBeDefined();
    installedHandlers[0]({ reason: "install" });
    await flush();

    expect(syncSet).toHaveBeenCalledWith({ catalogUrl: PROD_CATALOG_URL });
  });

  it("leaves an existing catalogUrl untouched", async () => {
    const custom = "https://example.com/api";
    const { chromeStub, listeners, syncSet } = makeChromeStub({ catalogUrl: custom });
    vi.stubGlobal("chrome", chromeStub);
    await import("./background");

    listeners.installed[0]({ reason: "install" });
    await flush();

    expect(syncSet).not.toHaveBeenCalled();
  });

  it("does not set a default catalog URL on update (only on fresh install)", async () => {
    const { chromeStub, listeners, syncSet } = makeChromeStub();
    vi.stubGlobal("chrome", chromeStub);
    await import("./background");

    listeners.installed[0]({ reason: "update" });
    await flush();

    expect(syncSet).not.toHaveBeenCalled();
  });
});
