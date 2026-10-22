#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --locked -p wirefilter-format
./demo/build.sh
cd demo
./node_modules/.bin/playwright test
