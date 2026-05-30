#!/usr/bin/env bash
set -euo pipefail

echo "==> Run lint"
bun run lint

echo "==> Run unit/API tests"
bun run test

echo "==> Run coverage"
bun run coverage

echo "==> Build Next.js app"
bun run build

echo "==> Run Next.js E2E smoke tests"
bun run test:e2e

echo "==> CI test pipeline completed"
