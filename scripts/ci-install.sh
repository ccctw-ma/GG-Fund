#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${NPM_INSTALL_REGISTRY:-https://registry.npmjs.org/}"
ATTEMPTS="${NPM_INSTALL_ATTEMPTS:-5}"

# 让 npm 自身在每个 tarball 下载上做指数退避重试，
# 而不是只依赖外层循环。
export npm_config_registry="${REGISTRY}"
export npm_config_fetch_retries="${npm_config_fetch_retries:-5}"
export npm_config_fetch_retry_factor="${npm_config_fetch_retry_factor:-2}"
export npm_config_fetch_retry_mintimeout="${npm_config_fetch_retry_mintimeout:-10000}"
export npm_config_fetch_retry_maxtimeout="${npm_config_fetch_retry_maxtimeout:-120000}"
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-300000}"
export npm_config_maxsockets="${npm_config_maxsockets:-8}"
export npm_config_audit="${npm_config_audit:-false}"
export npm_config_fund="${npm_config_fund:-false}"

for attempt in $(seq 1 "${ATTEMPTS}"); do
  echo "npm ci attempt ${attempt}/${ATTEMPTS}"

  if command -v curl >/dev/null 2>&1; then
    curl -fsS \
      --retry 3 \
      --retry-delay 5 \
      --retry-all-errors \
      --connect-timeout 10 \
      --max-time 30 \
      "${REGISTRY%/}/-/ping" >/dev/null || true
  fi

  if npm ci --no-audit --no-fund --prefer-offline; then
    exit 0
  fi

  if [ "${attempt}" = "${ATTEMPTS}" ]; then
    echo "npm ci failed after ${ATTEMPTS} attempts"
    exit 1
  fi

  sleep $((attempt * 30))
done
