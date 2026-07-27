#!/usr/bin/env bash
#
# Cloudflare Pages build — assembles the static site into ./public.
#
# Steps: install deps -> build the catalog from catalog.yaml -> copy the
# resulting JSON into public/api (served at /api/*). The landing page and
# _headers are committed under public/ and served as-is.
#
# Cloudflare Pages settings:
#   Build command:            bash scripts/deploy.sh
#   Build output directory:   public
#   Environment variable:     YT_API_KEY = <YouTube Data API v3 key>
#
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root, regardless of caller's CWD

if [ -z "${YT_API_KEY:-}" ]; then
  echo "error: YT_API_KEY is not set (needed to build the catalog)" >&2
  exit 1
fi

echo "==> Installing dependencies"
bun install --frozen-lockfile

echo "==> Building catalog from catalog-pipeline/catalog.yaml"
bun run --cwd catalog-pipeline build

echo "==> Publishing catalog to public/api"
mkdir -p public/api
cp catalog-pipeline/dist/catalog.json          public/api/catalog.json
cp catalog-pipeline/dist/allowed-channels.json public/api/allowed-channels.json

echo "==> Done. public/ now contains:"
ls -R public
