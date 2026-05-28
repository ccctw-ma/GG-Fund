#!/usr/bin/env bash
set -euo pipefail

echo "==> Run lint"
bun run lint

echo "==> Run unit/API tests"
bun run test

echo "==> Run coverage"
bun run coverage

echo "==> Build frontend and Pages Functions bundle"
bun run build

echo "==> Run E2E tests"
bun run test:e2e

echo "==> CI test pipeline completed"
