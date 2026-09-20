#!/usr/bin/env bash
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -p "require('$ROOT/package.json').version")
OUT="$ROOT/release"
NAME="modbus-workflow-studio-v$VERSION.zip"
mkdir -p "$OUT"
rm -f "$OUT/$NAME"
cd "$ROOT/.."
zip -qr "$OUT/$NAME" "$(basename "$ROOT")" \
  -x '*/node_modules/*' '*/dist/*' '*/coverage/*' '*/release/*' \
     '*/data/*.json' '*/data/*.log' '*/data/workflows/*' \
     '*/.git/*' '*/.env' '*/.env.*' '*.tmp' '*.zip'
sha256sum "$OUT/$NAME"
unzip -t "$OUT/$NAME" | tail -n 2
