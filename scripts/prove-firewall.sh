#!/usr/bin/env bash
# Fail if the working tree includes forbidden household / product tokens.
# Needles are hex so plaintext never appears in this repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

decode_hex() {
  python3 -c 'import sys; print(bytes.fromhex(sys.argv[1]).decode("utf-8"))' "$1"
}

EXCLUDE=(
  --exclude-dir=.git
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=.fixture-work
)

NEEDLES_HEX=(
  416c6578616e647261
  4f7274697a
  504c4c43
  4d657263757279
  6c6173743473
  4348524953544f50484552204a
  44726f707a6f6e65
  417373756d61626c65
  52617465626f7373
  5368616d73
  4167656e74506978656c73
)

fail=0
hits="$(mktemp)"
trap 'rm -f "$hits"' EXIT

for hex in "${NEEDLES_HEX[@]}"; do
  needle="$(decode_hex "$hex")"
  if grep -RInI "${EXCLUDE[@]}" -e "$needle" . >"$hits" 2>/dev/null; then
    echo "FIREWALL FAIL: forbidden token (${hex})"
    cat "$hits"
    fail=1
  fi
  if git log --all --format='%s%n%b' | grep -F -n -- "$needle" >"$hits" 2>/dev/null; then
    echo "FIREWALL FAIL: forbidden token in commit messages (${hex})"
    cat "$hits"
    fail=1
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "FIREWALL FAIL"
  exit 1
fi

echo "FIREWALL OK"
exit 0
