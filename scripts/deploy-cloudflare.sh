#!/usr/bin/env bash
set -euo pipefail

# Build the OpenNext worker, apply remote D1 migrations, and deploy the worker.
# Optional overrides:
#   CF_WORKER_NAME        Cloudflare Worker name passed to wrangler deploy.
#                         Default: gg-fund
#   CF_D1_DATABASE        Remote D1 database name used for migration apply.
#                         Default: gg-fund-db
CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"
CF_D1_DATABASE="${CF_D1_DATABASE:-gg-fund-db}"

echo "==> Building Next.js app for Cloudflare Worker ${CF_WORKER_NAME}"
bun run build
bunx --package @opennextjs/cloudflare opennextjs-cloudflare build

echo "==> Applying remote D1 migrations for ${CF_D1_DATABASE}"
bunx wrangler d1 migrations apply "${CF_D1_DATABASE}" --remote --config wrangler.jsonc

echo "==> Deploying Cloudflare Worker ${CF_WORKER_NAME}"
bunx wrangler deploy --config wrangler.jsonc --name "${CF_WORKER_NAME}"
