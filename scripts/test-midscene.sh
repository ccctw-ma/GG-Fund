#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

set -a
source "$HOME/.zshrc" >/dev/null 2>&1 || true
set +a

export MIDSCENE_LOCAL_SERVER=1

if [[ -z "${MIDSCENE_MODEL_NAME:-}" || -z "${MIDSCENE_MODEL_API_KEY:-}" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" && -z "${MIDSCENE_OPENAI_INIT_CONFIG_JSON:-}" ]]; then
    echo "Midscene model config is missing. Set MIDSCENE_MODEL_NAME and MIDSCENE_MODEL_API_KEY, or OPENAI_API_KEY, in ~/.zshrc." >&2
    exit 1
  fi
fi

cleanup() {
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

bun run dev >/tmp/gg-fund-midscene-web.log 2>&1 &
WEB_PID=$!

for _ in {1..120}; do
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    bunx vitest run tests/midscene-fund-flow.test.ts
    exit 0
  fi
  sleep 0.5
done

echo "Timed out waiting for the Next.js local server." >&2
tail -n 20 /tmp/gg-fund-midscene-web.log >&2 || true
exit 1
