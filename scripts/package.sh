#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"

version="$(node -p "require('./manifest.json').version")"
build_dir="dist/build"
rm -rf "$build_dir"
mkdir -p "$build_dir/chrome" "$build_dir/firefox"

cp -R manifest.json src "$build_dir/chrome/"
cp -R manifest.json src "$build_dir/firefox/"
node scripts/prep-manifest.js "$build_dir/firefox/manifest.json"

if command -v zip >/dev/null 2>&1; then
  (cd "$build_dir/chrome" && zip -q -FS -r "../../simprler-${version}-chrome.zip" manifest.json src)
  (cd "$build_dir/firefox" && zip -q -FS -r "../../simprler-${version}-firefox.zip" manifest.json src)
  echo "dist/simprler-${version}-chrome.zip"
  echo "dist/simprler-${version}-firefox.zip"
else
  echo "zip not found; staged builds are ready at $build_dir"
fi