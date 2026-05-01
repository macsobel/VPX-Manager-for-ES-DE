#!/bin/bash
set -e

APP_NAME="VPX_Manager"
# Script is located in scripts/build/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Project root is two levels up
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DIST_DIR="${ROOT_DIR}/dist"
VENV_DIR="${ROOT_DIR}/.venv"

echo "=== Building VPX Manager for ES-DE (Self-Contained) ==="
echo "Project Root: ${ROOT_DIR}"

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
    if ! python3 -m venv "${VENV_DIR}" --system-site-packages; then
        echo "Standard venv creation failed. Trying --without-pip..."
        python3 -m venv "${VENV_DIR}" --without-pip --system-site-packages
        echo "Installing pip manually..."
        curl -sS https://bootstrap.pypa.io/get-pip.py | "${VENV_DIR}/bin/python3"
    fi
fi

source "${VENV_DIR}/bin/activate"
echo "Updating dependencies..."
pip install --upgrade pip -q
pip install -r "${ROOT_DIR}/requirements.txt" -q
pip install pyinstaller -q

# 3. Load Local Environment Variables (Optional)
if [ -f "${ROOT_DIR}/.env" ]; then
    echo "Loading local .env file..."
    export $(grep -v '^#' "${ROOT_DIR}/.env" | xargs)
fi

# 4. Handle Credentials (Optional)
# If secrets are passed as env vars, generate the scrambled config.dat
if [[ -n "${SS_DEV_ID}" && -n "${SS_DEVPASS}" ]]; then
    echo "Secrets detected. Generating scrambled config..."
    # Run from ROOT_DIR so config.dat is created at the root
    cd "${ROOT_DIR}"
    python3 "${SCRIPT_DIR}/build_utils.py"
fi

# 5. Clean previous build files
echo "Cleaning old build files..."
rm -rf "${ROOT_DIR}/build"
# We don't rm -rf dist because it might contain artifacts we want to keep

# 6. Build with PyInstaller
echo "Running PyInstaller..."
cd "${ROOT_DIR}"
pyinstaller --clean --noconfirm "${SCRIPT_DIR}/VPX_Manager.spec"

# 7. Post-Build Actions
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
    echo "Creating AppImage (Linux specific)..."

    # Detect Architecture
    ARCH_RAW="$(uname -m)"
    case "${ARCH_RAW}" in
        x86_64)   ARCH="x86_64";;
        aarch64)  ARCH="aarch64";;
        arm64)    ARCH="aarch64";;
        *)        ARCH="x86_64";;
    esac
    echo "Detected Architecture: ${ARCH}"

    # Setup AppDir
    APPDIR="${DIST_DIR}/VPX_Manager.AppDir"
    rm -rf "${APPDIR}"
    mkdir -p "${APPDIR}/usr/bin"

    # Copy PyInstaller output
    cp -r "${DIST_DIR}/VPX_Manager/"* "${APPDIR}/usr/bin/"

    # Create .desktop file
    cat > "${APPDIR}/vpx-manager.desktop" <<EOF
[Desktop Entry]
Name=VPX Manager for ES-DE
Exec=VPX_Manager
Icon=icon
Type=Application
Categories=Utility;
EOF

    # Add icon
    cp "${ROOT_DIR}/resources/icon.png" "${APPDIR}/icon.png"

    # Create AppRun script
    cat > "${APPDIR}/AppRun" <<'EOF'
#!/bin/bash
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/usr/bin:${PATH}"
exec "${HERE}/usr/bin/VPX_Manager" "$@"
EOF
    chmod +x "${APPDIR}/AppRun"

    # Download architecture-appropriate appimagetool if not present
    APPIMAGETOOL="${DIST_DIR}/appimagetool-${ARCH}.AppImage"
    if [ ! -f "${APPIMAGETOOL}" ]; then
        echo "Downloading appimagetool for ${ARCH}..."
        curl -L "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCH}.AppImage" -o "${APPIMAGETOOL}"
        chmod +x "${APPIMAGETOOL}"
    fi

    # Generate AppImage
    echo "Generating AppImage..."
    ARCH="${ARCH}" "${APPIMAGETOOL}" --appimage-extract-and-run "${APPDIR}" "${DIST_DIR}/VPX_Manager-${ARCH}.AppImage"

    APPIMAGE_BUNDLE="${DIST_DIR}/VPX_Manager-${ARCH}.AppImage"

    echo ""
    echo "=== Build Complete ==="
    echo "AppImage: ${APPIMAGE_BUNDLE}"
    echo "Total Size: $(du -sh "${APPIMAGE_BUNDLE}" | awk '{print $1}')"
    echo ""
    echo "To launch:  ./${APPIMAGE_BUNDLE}"
fi

echo "Server URL: http://localhost:8746"
