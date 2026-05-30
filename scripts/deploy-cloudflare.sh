#!/usr/bin/env bash
set -euo pipefail

CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"

echo "==> Building Next.js app for Cloudflare Worker ${CF_WORKER_NAME}"
bun run build
bunx --package @opennextjs/cloudflare opennextjs-cloudflare build
bunx --package @opennextjs/cloudflare opennextjs-cloudflare deploy
