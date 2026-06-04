#!/usr/bin/env bash
set -e

echo ">>> Clearing stale EAS temp dirs..."
if [ -d /tmp/runner/eas-cli-nodejs ]; then
  chmod -R u+w /tmp/runner/eas-cli-nodejs 2>/dev/null || true
  rm -rf /tmp/runner/eas-cli-nodejs
fi

echo ">>> Setting up DotSlash cache outside EAS shallow-clone..."
export DOTSLASH_CACHE=/tmp/dotslash-persistent
mkdir -p "$DOTSLASH_CACHE"
chmod -R 755 "$DOTSLASH_CACHE" 2>/dev/null || true

echo ">>> Suppressing known non-fatal warnings..."
export EAS_BUILD_NO_EXPO_GO_WARNING=true
export EAS_NO_VCS=0

echo ">>> Starting EAS build (Android production)..."
pnpm exec eas build --platform android --profile production --non-interactive
