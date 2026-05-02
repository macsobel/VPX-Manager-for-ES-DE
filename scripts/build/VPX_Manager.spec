# -*- mode: python ; coding: utf-8 -*-
import sys

block_cipher = None

import os

# Helper to read VERSION without importing the whole module
def get_version():
    v_file = os.path.join('backend', 'core', 'version.txt')
    if os.path.exists(v_file):
        with open(v_file, 'r') as f:
            return f.read().strip()
    
    cfg_file = os.path.join('backend', 'core', 'config.py')
    if os.path.exists(cfg_file):
        with open(cfg_file, 'r') as f:
            for line in f:
                if 'VERSION = ' in line:
                    val = line.split('=')[1].strip().replace('"', '').replace("'", "")
                    if '(' not in val:
                        return val
    return "Dev Build"

VERSION = get_version()

# PyInstaller is invoked from the project ROOT, so paths are relative to ROOT
datas = [('frontend', 'frontend'), ('resources', 'resources'), ('backend', 'backend')]
# config.dat is generated at the project root by build_utils.py
if os.path.exists('config.dat'):
    print(f"[SPEC] Found config.dat at project root — bundling credentials.")
    datas.append(('config.dat', '.'))
else:
    print(f"[SPEC] WARNING: config.dat not found — dev credentials will NOT be bundled!")
if os.path.exists('backend/core/version.txt'):
    datas.append(('backend/core/version.txt', 'backend/core'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=['uvicorn', 'fastapi', 'aiosqlite', 'pydantic', 'httpx', 'olefile', 'PIL', 'setproctitle', 'rumps', 'pystray', 'pygame', 'gi', 'jaraco'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='VPX_Manager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='resources/icon.png' if sys.platform != 'darwin' else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='VPX_Manager',
)

app = BUNDLE(
    coll,
    name='VPX Manager for ES-DE.app',
    icon='resources/icon.icns' if sys.platform == 'darwin' else 'resources/icon.png',
    bundle_identifier='com.macsobel.vpxmanager',
    info_plist={
        'CFBundleShortVersionString': VERSION,
        'CFBundleVersion': VERSION,
        'NSHumanReadableCopyright': 'Aaron Sobel, 2026',
        'LSUIElement': True,
    },
)
