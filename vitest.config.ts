import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // extension/e2e holds Playwright specs (live-YouTube smoke canary, run
    // via `just e2e`), not vitest unit tests - keep vitest from globbing them.
    exclude: [...configDefaults.exclude, "extension/e2e/**"],
  },
});
