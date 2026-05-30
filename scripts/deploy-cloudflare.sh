#!/usr/bin/env bash
set -euo pipefail

CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"
CF_D1_DATABASE="${CF_D1_DATABASE:-gg-fund-db}"

if [[ -n "${CI:-}" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required in CI}"
  : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required in CI}"
fi

echo "==> Build OpenNext Cloudflare bundle"
bunx opennextjs-cloudflare build

echo "==> Apply remote D1 migrations: ${CF_D1_DATABASE}"
bunx wrangler d1 migrations apply "${CF_D1_DATABASE}" --remote

echo "==> Deploy Cloudflare Worker: ${CF_WORKER_NAME}"
bunx wrangler deploy --config wrangler.jsonc

echo "==> Cloudflare deployment completed"
