#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build-demo.sh
cd demo
./node_modules/.bin/playwright test
