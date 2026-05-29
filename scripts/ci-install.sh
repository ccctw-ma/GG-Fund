#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${NPM_INSTALL_REGISTRY:-https://registry.npmjs.org/}"
ATTEMPTS="${NPM_INSTALL_ATTEMPTS:-5}"

# 关键：actions/setup-node 在配置 registry-url 后，会写一份带 always-auth 的
# /home/runner/work/_temp/.npmrc 并要求 NODE_AUTH_TOKEN。我们的依赖全是公共包，
# 不需要鉴权，这份 .npmrc 反而会让 npm 在启动阶段就崩 (`Exit handler never called!`)。
# 这里强制使用一份干净的 npmrc，彻底绕开 setup-node 注入的 user config。
export NPM_CONFIG_USERCONFIG="${NPM_CONFIG_USERCONFIG_OVERRIDE:-/dev/null}"
unset NODE_AUTH_TOKEN

# CI 安装阶段不允许跑任何 postinstall（Playwright/puppeteer/native binary 下载
# CDN 是过去这条流水线最不稳定的环节）。浏览器装在独立步骤里，
# 由 Playwright 自己处理重试。
export PUPPETEER_SKIP_DOWNLOAD=1
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_GC=1
export ADBLOCK=1
export DISABLE_OPENCOLLECTIVE=1
export OPEN_SOURCE_CONTRIBUTOR=true
export CI=1

# 让 npm 自身在每个 tarball 下载上做指数退避重试。
export npm_config_registry="${REGISTRY}"
export npm_config_fetch_retries="${npm_config_fetch_retries:-5}"
export npm_config_fetch_retry_factor="${npm_config_fetch_retry_factor:-2}"
export npm_config_fetch_retry_mintimeout="${npm_config_fetch_retry_mintimeout:-10000}"
export npm_config_fetch_retry_maxtimeout="${npm_config_fetch_retry_maxtimeout:-120000}"
export npm_config_fetch_timeout="${npm_config_fetch_timeout:-600000}"
export npm_config_maxsockets="${npm_config_maxsockets:-8}"
export npm_config_audit="${npm_config_audit:-false}"
export npm_config_fund="${npm_config_fund:-false}"
export npm_config_progress="${npm_config_progress:-false}"
export npm_config_loglevel="${npm_config_loglevel:-error}"
export npm_config_ignore_scripts="${npm_config_ignore_scripts:-true}"

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

  # --ignore-scripts 关掉所有 postinstall，避免安装阶段下载 CDN 二进制；
  # --no-audit / --no-fund 减少安装尾端阻塞；--prefer-offline 优先用 npm cache。
  if npm ci --no-audit --no-fund --prefer-offline --ignore-scripts; then
    exit 0
  fi

  if [ "${attempt}" = "${ATTEMPTS}" ]; then
    echo "npm ci failed after ${ATTEMPTS} attempts"
    exit 1
  fi

  sleep $((attempt * 30))
done
