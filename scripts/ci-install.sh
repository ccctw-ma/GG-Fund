#!/usr/bin/env bash
set -euo pipefail

echo "==> Install dependencies with npm ci"
npm ci --ignore-scripts
