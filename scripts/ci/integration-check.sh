#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WEB_DIR="$REPO_ROOT/hushh-webapp"

cd "$WEB_DIR"

npm --version

if [ -f scripts/verify-route-contracts.cjs ]; then
  npm run verify:routes
else
  echo "⚠ WARNING: verify-route-contracts.cjs not found, skipping"
fi
