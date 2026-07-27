import { defineConfig } from "@playwright/test";

// Selector-drift canary against live YouTube. NOT a CI gate: YouTube's DOM,
// consent walls, and region rollouts change out from under us, so this is
// meant to be run manually (`just e2e`) and read by a human, not enforced
// by a pipeline.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 1,
  use: { headless: false },
});
