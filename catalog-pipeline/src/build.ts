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

  for (const source of config.sources) {
    if (source.kind === "channel") {
      const ch = await client.resolveChannel(source.ref);
      resolved.push(ch);
      const ids = await client.listPlaylistVideoIds(ch.uploadsPlaylistId, source.maxVideos);
      fetched.push({ source, videos: await client.getVideos(ids) });
    } else if (source.kind === "playlist") {
      const ids = await client.listPlaylistVideoIds(source.ref, source.maxVideos);
      fetched.push({ source, videos: await client.getVideos(ids) });
    } else {
      fetched.push({ source, videos: await client.getVideos([source.ref]) });
    }
  }

  for (const ref of config.searchOnlyChannels) {
    resolved.push(await client.resolveChannel(ref));
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
