#!/bin/bash
# ═══════════════════════════════════════════════════════════
# VPX Manager Release Publisher
# ═══════════════════════════════════════════════════════════

set -e

# 1. Read current version and increment
if [ ! -f "version.txt" ]; then
    echo "1" > version.txt
fi

CURRENT_VERSION=$(cat version.txt | xargs)
NEXT_VERSION=$((CURRENT_VERSION + 1))
TAG="v${NEXT_VERSION}"

echo "🚀 Preparing release ${TAG} (from v${CURRENT_VERSION})..."

# 2. Update version.txt
echo "${NEXT_VERSION}" > version.txt

# 3. Git operations
git add version.txt
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
bash build_app.sh

echo "🎉 Release ${TAG} published and local bundle updated!"
