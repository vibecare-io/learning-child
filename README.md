# Learning Child

A Chrome extension (MV3) that replaces YouTube's algorithmic recommendations with a
parent-curated set of videos. A small pipeline turns a `catalog.yaml` of channels into
a static JSON catalog, which the extension consumes.

## Layout

| Path | What |
|---|---|
| `extension/` | The MV3 extension. `bun run build` bundles it into `extension/dist/`. |
| `catalog-pipeline/` | `catalog.yaml` → YouTube Data API → `dist/catalog.json` + `allowed-channels.json` (+ `_headers`). |
| `shared/` | Types shared by both. |

## Prerequisites

- [Bun](https://bun.sh)
- A `.env` at the repo root (auto-loaded by the Justfile):

  ```sh
  export YT_API_KEY=...   # YouTube Data API v3 key — builds the catalog
  ```

## Common commands (`just`)

```sh
just setup      # bun install
just test       # vitest
just typecheck  # tsc --noEmit across workspaces
just bundle     # build the extension into extension/dist
just catalog    # build the catalog into catalog-pipeline/dist (needs YT_API_KEY)
just check      # test + typecheck + bundle
```

Load the extension: `chrome://extensions` → enable Developer mode → **Load unpacked** →
`extension/dist`.

## Hosting the catalog on Cloudflare Pages (Git-integrated)

The catalog is two static JSON files. Cloudflare Pages is connected to this GitHub repo and
**rebuilds + redeploys automatically on every push to `main`** — no local deploy step. You
only configure the build once, in the Pages dashboard:

| Setting | Value |
|---|---|
| Framework preset | None |
| **Build command** | `bun run --cwd catalog-pipeline build` |
| **Build output directory** | `catalog-pipeline/dist` |
| Root directory | `/` (repo root) |
| **Environment variables** | `YT_API_KEY` = *your YouTube Data API key* |

Cloudflare auto-detects `bun.lock` and runs `bun install` before the build command. The build
writes `catalog.json`, `allowed-channels.json`, and a `_headers` file (CORS + cache) into the
output directory. Live URLs:

```
https://learning-child.pages.dev/catalog.json
https://learning-child.pages.dev/allowed-channels.json
```

A custom domain can be attached to the project in the dashboard; if you use one, add it to
`host_permissions` in `extension/manifest.json` (alongside `https://*.pages.dev/*`).

### Point the extension at it

The background service worker refreshes the catalog every 4h from a `catalogUrl` stored in
`chrome.storage.sync` (it fetches `<catalogUrl>/catalog.json` and
`<catalogUrl>/allowed-channels.json`). Set it to the **base** URL. Until an options UI lands,
set it from the service-worker console on `chrome://extensions`:

```js
chrome.storage.sync.set({ catalogUrl: "https://learning-child.pages.dev" })
```

Until a `catalogUrl` is configured, the extension falls back to the catalog bundled in
`extension/seed-catalog.json`.
