import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Selector-drift canary: loads the built extension against live YouTube and
// checks that OUR injected elements show up. It is intentionally NOT a CI
// gate - a consent dialog, region wall, or A/B DOM change on YouTube's end
// can make this flaky without our code having broken at all. Run manually
// with `just e2e` (requires `just bundle` first) and read the result by eye.

const distPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// A real video id present in the seed catalog. Any real, curated video
// works here - the assertions are about our injected DOM, not this video.
const SAMPLE_VIDEO_ID = "4VinwOQkHGg";

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });
});

test.afterAll(async () => context.close());

test("homepage shows the curated grid, not YouTube's", async () => {
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/");
  await expect(page.locator("#lc-home")).toBeVisible({ timeout: 20_000 });
  const tiles = page.locator("#lc-home a.lc-tile");
  expect(await tiles.count()).toBeGreaterThan(0);
});

test("watch page shows curated up-next and hides comments", async () => {
  const page = await context.newPage();
  await page.goto(`https://www.youtube.com/watch?v=${SAMPLE_VIDEO_ID}`);
  await expect(page.locator("#lc-upnext")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("ytd-comments#comments")).toBeHidden();
});

test("shorts allowed taste shows the reels bar (no redirect)", async () => {
  // Reels guard now allows a small taste before cooldown kicks in - a fresh
  // profile's first /shorts visit should stay put and show the countdown
  // bar, not hard-redirect (that only happens once the budget is spent).
  const page = await context.newPage();
  await page.goto("https://www.youtube.com/shorts/anyid");
  await expect(page.locator("#lc-reels-bar")).toBeVisible({ timeout: 20_000 });
  expect(page.url()).toContain("/shorts/");
});
