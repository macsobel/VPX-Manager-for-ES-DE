#!/bin/bash
# ═══════════════════════════════════════════════════════════
# VPX Backglass Companion — Launcher
# Usage: ./run_backglass.sh [screen_index]
#   screen_index: 0 = primary, 1 = secondary (default), 2 = third
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
COMPANION="$SCRIPT_DIR/backglass_companion.py"
SCREEN="${1:-1}"

# Bootstrap venv if missing
if [ ! -f "$VENV/bin/python" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install --quiet watchdog pygame
    echo "✅ Dependencies installed."
fi

echo "🚀 Launching Backglass Companion on screen $SCREEN..."
exec "$VENV/bin/python" "$COMPANION" "$SCREEN"
