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

verify_market_indices_complete() {
  local output="${TMP_DIR}/market_indices.json"

  echo "==> Verify complete market index universe and histories"
  curl -fsS "${CF_VERIFY_BASE_URL}/api/market/indices" -o "${output}"
  node - "${CF_VERIFY_BASE_URL}" "${output}" <<'NODE'
const [baseUrl, file] = process.argv.slice(2);
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const required = [
  '000001.SH',
  '399001.SZ',
  '399006.SZ',
  '000300.SH',
  '000688.SH',
  '899050.BJ',
  'HSI.HK',
  'DJIA.US',
  'SPX.US',
  'IXIC.US',
  'NDX.US',
  'N225.JP',
  'KS11.KR',
  'FTSE.UK',
  'GDAXI.DE',
  'FCHI.FR',
];

const indices = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(indices)) throw new Error(`market index list expected array, got ${typeof indices}`);

const byCode = new Map(indices.map((index) => [index.code, index]));
const missing = required.filter((code) => !byCode.has(code));
if (missing.length > 0) throw new Error(`missing required market indices: ${missing.join(', ')}`);

for (const index of indices) {
  for (const field of ['code', 'name', 'value', 'change', 'changePercent', 'quoteTime']) {
    if (index[field] === undefined || index[field] === null || index[field] === '') {
      throw new Error(`${index.code ?? 'unknown index'} missing quote field ${field}`);
    }
  }
}

for (const code of required) {
  const url = `${baseUrl}/api/market/indices/${encodeURIComponent(code)}/history?range=all&v=20260607`;
  const body = execFileSync('curl', ['-fsS', url], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const history = JSON.parse(body);
  if (!Array.isArray(history) || history.length < 20) {
    throw new Error(`${code} history expected at least 20 rows, got ${Array.isArray(history) ? history.length : typeof history}`);
  }
  const latest = history.at(-1);
  if (!latest?.date || typeof latest.netValue !== 'number' || !Number.isFinite(latest.netValue)) {
    throw new Error(`${code} latest history point is invalid`);
  }
}
NODE
}

verify_endpoint "/"
verify_endpoint "/api/health"
verify_endpoint "/api/market/indices"
verify_endpoint "/api/funds/000001"
verify_json_array_min "/api/market/indices" 16 "global index quote list"
verify_market_indices_complete

echo "==> Cloudflare verification completed"
