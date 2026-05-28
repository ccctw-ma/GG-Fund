#!/usr/bin/env bash
set -euo pipefail

CF_PAGES_PROJECT="${CF_PAGES_PROJECT:-gg-fund}"
CF_PAGES_BRANCH="${CF_PAGES_BRANCH:-${GITHUB_REF_NAME:-master}}"
CF_D1_DATABASE="${CF_D1_DATABASE:-gg-fund-db}"

if [[ -n "${CI:-}" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required in CI}"
  : "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required in CI}"
fi

echo "==> Build production assets"
bun run build

echo "==> Apply remote D1 migrations: ${CF_D1_DATABASE}"
bunx wrangler@3 d1 migrations apply "${CF_D1_DATABASE}" --remote

echo "==> Deploy Cloudflare Pages project: ${CF_PAGES_PROJECT}, branch: ${CF_PAGES_BRANCH}"
bunx wrangler@3 pages deploy dist \
  --project-name "${CF_PAGES_PROJECT}" \
  --branch "${CF_PAGES_BRANCH}"

echo "==> Cloudflare deployment completed"
