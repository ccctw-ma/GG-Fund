#!/usr/bin/env bash
set -euo pipefail

CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"
CF_VERIFY_BASE_URL="${CF_VERIFY_BASE_URL:-https://${CF_WORKER_NAME}.workers.dev}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

verify_endpoint() {
  local path="$1"
  local output="${TMP_DIR}/${path//\//_}.json"

  echo "==> Verify ${CF_VERIFY_BASE_URL}${path}"
  curl -fsS "${CF_VERIFY_BASE_URL}${path}" -o "${output}"
  test -s "${output}"
}

verify_endpoint "/api/health"
verify_endpoint "/api/market/indices"
verify_endpoint "/api/funds/000001"

echo "==> Cloudflare verification completed"
