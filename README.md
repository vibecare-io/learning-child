# Learning Child / VibeCare Kids

A Chrome extension (MV3) that replaces YouTube's algorithmic recommendations with a
parent-curated set of videos. A small pipeline turns a `catalog.yaml` of channels into
a static JSON catalog, and a kawaii landing page + that catalog are served together as a
Cloudflare Pages site at **kids.vibecare.io**.

## Layout

| Path | What |
|---|---|
| `extension/` | The MV3 extension. `bun run build` bundles it into `extension/dist/`. |
| `catalog-pipeline/` | `catalog.yaml` → YouTube Data API → `dist/catalog.json` + `allowed-channels.json`. |
| `public/` | The Cloudflare Pages site: `index.html` (landing) + `_headers`, plus a generated `api/` (gitignored). |
| `scripts/deploy.sh` | Build step Cloudflare runs: install → build catalog → assemble `public/api`. |
| `shared/` | Types shared by extension and pipeline. |

## Prerequisites

- [Bun](https://bun.sh)
- A `.env` at the repo root (auto-loaded by the Justfile):

  ```sh
  export YT_API_KEY=...   # YouTube Data API v3 key - builds the catalog
  ```

## Common commands (`just`)

```sh
just setup      # bun install
just test       # vitest
just typecheck  # tsc --noEmit across workspaces
just bundle     # build the extension into extension/dist
just catalog    # build the catalog into catalog-pipeline/dist
just site       # build the whole site into public/ (runs scripts/deploy.sh)
just serve      # serve public/ at http://localhost:8080 (run `just site` first)
just check      # test + typecheck + bundle
```

Load the extension: `chrome://extensions` → enable Developer mode → **Load unpacked** →
`extension/dist`.

## Hosting on Cloudflare Pages (Git-integrated)

Cloudflare Pages is connected to this repo and **rebuilds on every push to `main`**. The
build is driven by `scripts/deploy.sh`, so all the logic lives in the repo - the dashboard
only needs:

| Setting | Value |
|---|---|
| Framework preset | None |
| **Build command** | `bash scripts/deploy.sh` |
| **Build output directory** | `public` |
| **Environment variables** | `YT_API_KEY` = *your YouTube Data API key* |
| Custom domain | `kids.vibecare.io` (add under the project's **Custom domains** tab) |

The build produces:

```
https://kids.vibecare.io/                       ← landing page
https://kids.vibecare.io/api/catalog.json        ← the catalog the extension reads
https://kids.vibecare.io/api/allowed-channels.json
```

`public/_headers` sets `Access-Control-Allow-Origin: *` and edge caching on `/api/*`.

### Point the extension at it

The background service worker refreshes the catalog every 4h from a `catalogUrl` in
`chrome.storage.sync` (it fetches `<catalogUrl>/catalog.json` and
`<catalogUrl>/allowed-channels.json`). Set it to the **`/api` base**. Until an options UI
lands, set it from the service-worker console on `chrome://extensions`:

```js
chrome.storage.sync.set({ catalogUrl: "https://kids.vibecare.io/api" })
```

Until a `catalogUrl` is configured, the extension falls back to the catalog bundled in
`extension/seed-catalog.json`.
