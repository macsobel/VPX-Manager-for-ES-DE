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

    # Bundle GObject Introspection typelibs and shared libraries for tray icon
    echo "Bundling GIR typelibs and shared libraries..."
    TYPELIB_SRC=""
    for candidate in "/usr/lib/${ARCH_RAW}-linux-gnu/girepository-1.0" "/usr/lib/girepository-1.0"; do
        if [ -d "$candidate" ]; then
            TYPELIB_SRC="$candidate"
            break
        fi
    done
    if [ -n "$TYPELIB_SRC" ]; then
        mkdir -p "${APPDIR}/usr/lib/girepository-1.0"
        for typelib in AyatanaAppIndicator3-0.1 AppIndicator3-0.1 Gtk-3.0 Gdk-3.0 \
                       GdkPixbuf-2.0 Pango-1.0 PangoCairo-1.0 cairo-1.0 \
                       GObject-2.0 GLib-2.0 Gio-2.0 Atk-1.0 \
                       Dbusmenu-0.4 DbusmenuGtk3-0.4 GModule-2.0 \
                       HarfBuzz-0.0 freetype2-2.0 xlib-2.0; do
            if [ -f "${TYPELIB_SRC}/${typelib}.typelib" ]; then
                cp "${TYPELIB_SRC}/${typelib}.typelib" "${APPDIR}/usr/lib/girepository-1.0/"
                echo "  Bundled ${typelib}.typelib"
            fi
        done
    else
        echo "WARNING: Could not find girepository-1.0 directory"
    fi

    # Bundle key shared libraries for AppIndicator
    mkdir -p "${APPDIR}/usr/lib/extra"
    for lib in libayatana-appindicator3 libayatana-indicator3 libayatana-ido3 \
               libdbusmenu-glib libdbusmenu-gtk3 libgtk-3 libgdk-3 \
               libgobject-2.0 libgio-2.0 libglib-2.0; do
        for so in /usr/lib/${ARCH_RAW}-linux-gnu/${lib}.so* /usr/lib/${ARCH_RAW}-linux-gnu/${lib}-*.so*; do
            if [ -f "$so" ]; then
                cp -n "$so" "${APPDIR}/usr/lib/extra/" 2>/dev/null || true
            fi
        done
    done
    echo "Bundled shared libraries for tray support."

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

    # Create AppRun script with GI_TYPELIB_PATH for tray icon support
    cat > "${APPDIR}/AppRun" <<'EOF'
#!/bin/bash
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/usr/bin:${PATH}"

# Make bundled GIR typelibs discoverable
if [ -d "${HERE}/usr/lib/girepository-1.0" ]; then
    export GI_TYPELIB_PATH="${HERE}/usr/lib/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
fi

# Make bundled shared libraries discoverable
if [ -d "${HERE}/usr/lib/extra" ]; then
    export LD_LIBRARY_PATH="${HERE}/usr/lib/extra${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

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
