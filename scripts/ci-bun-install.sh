#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${BUN_INSTALL_REGISTRY:-https://registry.npmjs.org/}"
CACHE_DIR="${BUN_INSTALL_CACHE_DIR:-${HOME}/.bun/install/cache}"
NETWORK_CONCURRENCY="${BUN_INSTALL_NETWORK_CONCURRENCY:-8}"
ATTEMPTS="${BUN_INSTALL_ATTEMPTS:-5}"

mkdir -p "${CACHE_DIR}"

for attempt in $(seq 1 "${ATTEMPTS}"); do
  echo "bun install attempt ${attempt}/${ATTEMPTS}"

  if command -v curl >/dev/null 2>&1; then
    curl -fsS \
      --retry 3 \
      --retry-delay 5 \
      --retry-all-errors \
      --connect-timeout 10 \
      --max-time 30 \
      "${REGISTRY%/}/-/ping" >/dev/null
  fi

  if bun install \
    --frozen-lockfile \
    --registry "${REGISTRY}" \
    --cache-dir "${CACHE_DIR}" \
    --network-concurrency "${NETWORK_CONCURRENCY}"; then
    exit 0
  fi

  if [ "${attempt}" = "${ATTEMPTS}" ]; then
    echo "bun install failed after ${ATTEMPTS} attempts"
    exit 1
  fi

  sleep $((attempt * 30))
done
