# Auto-load .env (e.g. YT_API_KEY) into recipe environments
set dotenv-load := true

# List available recipes
default:
    just --list

# Install all workspace dependencies with bun
setup:
    bun install

# Run the vitest suite
test:
    bun run test

# Typecheck catalog-pipeline and extension with tsc
typecheck:
    bun run typecheck

# Build the extension into extension/dist and print how to load it
bundle:
    bun run --cwd extension build
    @echo "Load it: chrome://extensions -> Load unpacked -> extension/dist"

# Build the catalog locally (requires YT_API_KEY)
catalog:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${YT_API_KEY:-}" ]; then
        echo "YT_API_KEY is not set. Run: YT_API_KEY=xxx just catalog" >&2
        exit 1
    fi
    bun run --cwd catalog-pipeline build

# Build the full site (landing page + /api catalog) into public/ - same as Cloudflare
site:
    bash scripts/deploy.sh

# Serve the built site at http://localhost:{{port}} (run `just site` first)
serve port="8080":
    @echo "Serving ./public at http://localhost:{{port}}  -  Ctrl-C to stop"
    python3 -m http.server {{port}} --directory public

# Selector-drift canary against live YouTube (builds the extension, then loads
# it into real Chromium and pokes real youtube.com). NOT a CI gate - a consent
# dialog, region wall, or YouTube A/B test can make this flaky on its own;
# treat a failure as "go look", not "something broke".
e2e: bundle
    cd extension && bunx playwright test

# Full pre-commit gate: test, typecheck, bundle
check: test typecheck bundle
