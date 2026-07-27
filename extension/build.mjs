import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    settings: "src/settings/settings.ts",
    onboarding: "src/onboarding/onboarding.ts",
  },
  bundle: true,
  format: "iife",
  outdir: "dist",
  logLevel: "info",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("seed-catalog.json", "dist/seed-catalog.json");
if (existsSync("src/settings/settings.html")) cpSync("src/settings/settings.html", "dist/settings.html");
if (existsSync("src/onboarding/onboarding.html")) cpSync("src/onboarding/onboarding.html", "dist/onboarding.html");
