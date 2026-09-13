#!/usr/bin/env bash
set -eu
ZIP=${1:?Usage: verify-release.sh path/to/release.zip}
unzip -t "$ZIP" >/dev/null
if unzip -Z1 "$ZIP" | grep -Eq '(^|/)(node_modules|dist|coverage|\.git)(/|$)|(^|/)data/.*\.(json|log)$|(^|/)\.env($|\.)'; then
  echo 'Forbidden release content detected.' >&2
  exit 1
fi
sha256sum "$ZIP"
echo 'Release ZIP structure verified.'
