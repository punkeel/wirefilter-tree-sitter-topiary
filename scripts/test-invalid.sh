#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
while IFS= read -r source; do
  if printf '%s' "$source" | ./scripts/format.sh > /dev/null 2>&1; then
    printf 'FAIL formatter accepted invalid input: %s\n' "$source" >&2
    exit 1
  fi
done <<'CASES'
http.host eq
(http.host eq "example.com"
http.host eq "unterminated
ip.src in {1, 2}
a and
CASES
echo 'PASS invalid syntax is rejected by checked formatter'
