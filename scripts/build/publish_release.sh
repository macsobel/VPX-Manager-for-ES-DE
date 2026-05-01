#!/bin/bash
# ═══════════════════════════════════════════════════════════
# VPX Manager Release Publisher
# ═══════════════════════════════════════════════════════════

set -e

# Script is located in scripts/build/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Project root is two levels up
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION_FILE="${ROOT_DIR}/backend/core/version.txt"

# 1. Read current version and increment
if [ ! -f "${VERSION_FILE}" ]; then
    echo "1" > "${VERSION_FILE}"
fi

CURRENT_VERSION=$(cat "${VERSION_FILE}" | xargs)
NEXT_VERSION=$((CURRENT_VERSION + 1))
TAG="v${NEXT_VERSION}"

echo "🚀 Preparing release ${TAG} (from v${CURRENT_VERSION})..."

# 2. Update version.txt
echo "${NEXT_VERSION}" > "${VERSION_FILE}"

# 3. Git operations
cd "${ROOT_DIR}"
git add "${VERSION_FILE}"
git commit -m "chore: bump version to ${TAG}"
git push origin main

# 4. Create GitHub Release
echo "📦 Creating GitHub release ${TAG}..."
gh release create "${TAG}" \
    --title "${TAG}" \
    --generate-notes

echo "✅ GitHub release created: https://github.com/macsobel/VPX-Manager-for-ES-DE/releases/tag/${TAG}"

# 5. Rebuild local app to match
echo "🔨 Rebuilding local application bundle..."
cd "${SCRIPT_DIR}"
bash ./build_app.sh

echo "🎉 Release ${TAG} published and local bundle updated!"
