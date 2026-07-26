import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    options: "src/options/options.ts",
  },
  bundle: true,
  format: "iife",
  outdir: "dist",
  logLevel: "info",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("seed-catalog.json", "dist/seed-catalog.json");
if (existsSync("src/options/options.html")) cpSync("src/options/options.html", "dist/options.html");
