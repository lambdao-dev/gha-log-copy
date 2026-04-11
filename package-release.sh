#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -e "const fs=require('fs'); const path=require('path'); const manifest=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'manifest.json'), 'utf8')); process.stdout.write(manifest.version);" "$ROOT_DIR")"
PACKAGE_PATH="$DIST_DIR/github-actions-log-copy-$VERSION.zip"

mkdir -p "$DIST_DIR"
rm -f "$PACKAGE_PATH"

(
  cd "$ROOT_DIR"
  zip -r "$PACKAGE_PATH" manifest.json content.js content.css icons -x "*/.DS_Store" "icons/icon.svg"
)

printf 'Created %s\n' "$PACKAGE_PATH"
