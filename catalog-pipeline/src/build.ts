import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConfig, type Config } from "./config";
import { buildAllowed, expandCatalog, type FetchedSource } from "./expand";
import { YouTubeApiClient, type ResolvedChannel, type YouTubeClient } from "./youtube-api";
import type { AllowedChannels, Catalog } from "../../shared/types";

export async function runBuild(
  config: Config,
  client: YouTubeClient,
  now: string,
): Promise<{ catalog: Catalog; allowed: AllowedChannels }> {
  const fetched: FetchedSource[] = [];
  const resolved: ResolvedChannel[] = [];
  const skipped: string[] = [];

  // Fail-soft: one bad handle/playlist must never abort the whole catalog build.
  // Skip it with a named warning and keep going ("fail open").
  for (const source of config.sources) {
    try {
      if (source.kind === "channel") {
        const ch = await client.resolveChannel(source.ref);
        if (!ch.uploadsPlaylistId) throw new Error("channel has no uploads playlist");
        resolved.push(ch);
        const ids = await client.listPlaylistVideoIds(ch.uploadsPlaylistId, source.maxVideos);
        fetched.push({ source, videos: await client.getVideos(ids) });
      } else if (source.kind === "playlist") {
        const ids = await client.listPlaylistVideoIds(source.ref, source.maxVideos);
        fetched.push({ source, videos: await client.getVideos(ids) });
      } else {
        fetched.push({ source, videos: await client.getVideos([source.ref]) });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skipped.push(`${source.kind} ${source.ref}`);
      console.warn(`⚠︎ skipped ${source.kind} ${source.ref}: ${reason}`);
    }
  }

  for (const ref of config.searchOnlyChannels) {
    try {
      resolved.push(await client.resolveChannel(ref));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skipped.push(`search-only ${ref}`);
      console.warn(`⚠︎ skipped search-only ${ref}: ${reason}`);
    }
  }

  if (skipped.length) {
    console.warn(`\n${skipped.length} source(s) skipped — prune these from catalog.yaml:\n  ${skipped.join("\n  ")}`);
  }

  const catalog = expandCatalog(config, fetched, now);
  return { catalog, allowed: buildAllowed(catalog, resolved) };
}

async function main() {
  const apiKey = process.env.YT_API_KEY;
  if (!apiKey) throw new Error("Set YT_API_KEY environment variable");
  const root = dirname(fileURLToPath(import.meta.url));
  const config = parseConfig(readFileSync(join(root, "..", "catalog.yaml"), "utf8"));
  const { catalog, allowed } = await runBuild(config, new YouTubeApiClient(apiKey), new Date().toISOString());
  const dist = join(root, "..", "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "catalog.json"), JSON.stringify(catalog, null, 2));
  writeFileSync(join(dist, "allowed-channels.json"), JSON.stringify(allowed, null, 2));
  console.log(`Wrote ${catalog.videos.length} videos across ${new Set(catalog.videos.map((v) => v.channelId)).size} channels`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
