#!/bin/bash
set -e

APP_NAME="VPX_Manager"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
VENV_DIR="${SCRIPT_DIR}/.venv"

echo "=== Building VPX Manager for ES-DE (Self-Contained) ==="

# 1. Detect Operating System
OS_TYPE="$(uname -s)"
case "${OS_TYPE}" in
    Darwin*)    PLATFORM="macOS";;
    Linux*)     PLATFORM="Linux";;
    *)          PLATFORM="Unknown";;
esac
echo "Detected Platform: ${PLATFORM}"

# 2. Ensure Dependencies and Virtual Env
if [ ! -d "${VENV_DIR}" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"
echo "Updating dependencies..."
pip install --upgrade pip -q
pip install -r "${SCRIPT_DIR}/requirements.txt" -q
pip install pyinstaller -q

# 3. Load Local Environment Variables (Optional)
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "Loading local .env file..."
    export $(grep -v '^#' "${SCRIPT_DIR}/.env" | xargs)
fi

# 4. Handle Credentials (Optional)
# If secrets are passed as env vars, generate the scrambled config.dat
if [[ -n "${SS_DEV_ID}" && -n "${SS_DEVPASS}" ]]; then
    echo "Secrets detected. Generating scrambled config..."
    python3 "${SCRIPT_DIR}/build_utils.py"
fi

# 4. Clean previous build files
echo "Cleaning old build files..."
rm -rf "${SCRIPT_DIR}/build"
# We don't rm -rf dist because it might contain artifacts we want to keep, 
# but PyInstaller will overwrite the app/binary anyway.

# 5. Build with PyInstaller
echo "Running PyInstaller (full bundle)..."
pyinstaller --clean --noconfirm "${SCRIPT_DIR}/VPX_Manager.spec"

# 6. Post-Build Actions
if [ "${PLATFORM}" == "macOS" ]; then
    APP_BUNDLE="${DIST_DIR}/VPX Manager for ES-DE.app"
    echo "Signing and clearing quarantine (macOS specific)..."
    xattr -rc "${APP_BUNDLE}"
    codesign --force --deep --sign - "${APP_BUNDLE}"
    
    echo ""
    echo "=== Build Complete ==="
    echo "App bundle: ${APP_BUNDLE}"
    echo "Total Size: $(du -sh "${APP_BUNDLE}" | awk '{print $1}')"
    echo ""
    echo "To launch:  open \"${APP_BUNDLE}\""
else
    # For Linux builds
    BINARY="${DIST_DIR}/VPX_Manager/VPX_Manager"
    echo ""
    echo "=== Build Complete ==="
    echo "Binary: ${BINARY}"
    echo ""
    echo "To launch:  ./${BINARY}"
fi

echo "Server URL: http://localhost:8746"
