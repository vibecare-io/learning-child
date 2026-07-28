import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";

// A release build (RELEASE=1 or --release) is the artifact we upload to the
// Chrome Web Store. It drops the localhost host permissions we only need while
// developing against a locally-served catalog — shipping those broad hosts
// triggers Google's in-depth permission review for no user-facing benefit.
const RELEASE = process.env.RELEASE === "1" || process.argv.includes("--release");
const DEV_ONLY_HOSTS = ["http://localhost/*", "http://127.0.0.1/*"];

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

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
if (RELEASE) {
  manifest.host_permissions = manifest.host_permissions.filter((h) => !DEV_ONLY_HOSTS.includes(h));
}
writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(RELEASE ? "→ release manifest (dev hosts stripped)" : "→ dev manifest (all hosts)");
cpSync("seed-catalog.json", "dist/seed-catalog.json");
if (existsSync("src/settings/settings.html")) cpSync("src/settings/settings.html", "dist/settings.html");
if (existsSync("src/onboarding/onboarding.html")) cpSync("src/onboarding/onboarding.html", "dist/onboarding.html");
