#!/usr/bin/env bash
set -euo pipefail

CF_WORKER_NAME="${CF_WORKER_NAME:-gg-fund}"
CF_VERIFY_BASE_URL="${CF_VERIFY_BASE_URL:-https://${CF_WORKER_NAME}.workers.dev}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

verify_endpoint() {
  local path="$1"
  local output="${TMP_DIR}/${path//\//_}.out"

  echo "==> Verify ${CF_VERIFY_BASE_URL}${path}"
  curl -fsS "${CF_VERIFY_BASE_URL}${path}" -o "${output}"
  test -s "${output}"
}

verify_json_array_min() {
  local path="$1"
  local min_count="$2"
  local label="$3"
  local output="${TMP_DIR}/${path//\//_}.json"

  echo "==> Verify ${label}: ${CF_VERIFY_BASE_URL}${path}"
  curl -fsS "${CF_VERIFY_BASE_URL}${path}" -o "${output}"
  node - "${output}" "${min_count}" "${label}" <<'NODE'
const [file, minCountRaw, label] = process.argv.slice(2);
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const minCount = Number(minCountRaw);
if (!Array.isArray(payload) || payload.length < minCount) {
  throw new Error(`${label} expected at least ${minCount} rows, got ${Array.isArray(payload) ? payload.length : typeof payload}`);
}
NODE
}

verify_endpoint "/"
verify_endpoint "/api/health"
verify_endpoint "/api/market/indices"
verify_endpoint "/api/funds/000001"
verify_json_array_min "/api/market/indices" 10 "global index quote list"
verify_json_array_min "/api/market/indices/DJIA.US/history?range=1m" 1 "Dow Jones history"
verify_json_array_min "/api/market/indices/SPX.US/history?range=1m" 1 "S&P 500 history"
verify_json_array_min "/api/market/indices/IXIC.US/history?range=1m" 1 "Nasdaq Composite history"
verify_json_array_min "/api/market/indices/N225.JP/history?range=1m" 1 "Nikkei 225 history"
verify_json_array_min "/api/market/indices/KS11.KR/history?range=1m" 1 "KOSPI history"
verify_json_array_min "/api/market/indices/HSI.HK/history?range=1m" 1 "Hang Seng history"
verify_json_array_min "/api/market/indices/FTSE.UK/history?range=1m" 1 "FTSE 100 history"
verify_json_array_min "/api/market/indices/GDAXI.DE/history?range=1m" 1 "DAX history"
verify_json_array_min "/api/market/indices/FCHI.FR/history?range=1m" 1 "CAC 40 history"

echo "==> Cloudflare verification completed"
