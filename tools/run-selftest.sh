#!/usr/bin/env bash
# Compile every mapping fixture with the real Tailwind package, on v3 and v4.
# Usage: bash tools/run-selftest.sh          (override versions with TAILWIND_V3 / TAILWIND_V4)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="$ROOT/skills/css-to-tailwind"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

V3="${TAILWIND_V3:-3.4.19}"
V4="${TAILWIND_V4:-4.3.3}"

for spec in "v3:$V3" "v4:$V4"; do
  tag="${spec%%:*}"
  ver="${spec#*:}"
  mkdir -p "$WORK/$tag"
  (cd "$WORK/$tag" && npm init -y >/dev/null && npm install --no-save --silent "tailwindcss@$ver" postcss)
  echo "== Tailwind $ver ($tag): mapping fixtures =="
  node "$SKILL/scripts/verify_classes.mjs" "$SKILL/scripts/selftest/$tag.json" --tailwind-dir "$WORK/$tag"
done

echo "== Verifier regression tests (it must keep flagging known problems) =="
(cd "$ROOT" && TW_V3_DIR="$WORK/v3" TW_V4_DIR="$WORK/v4" python3 -m unittest tests.test_verifier_negative -v)

echo "All self-tests passed."
