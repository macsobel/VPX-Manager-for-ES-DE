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

# Define absolute path to project root relative to this spec file
spec_dir = os.path.dirname(os.path.abspath(SPEC))
root_dir = os.path.abspath(os.path.join(spec_dir, '../..'))

# PyInstaller is invoked from the project ROOT, but we use absolute paths for robustness
datas = [
    (os.path.join(root_dir, 'frontend'), 'frontend'),
    (os.path.join(root_dir, 'resources'), 'resources'),
    (os.path.join(root_dir, 'backend'), 'backend'),
]

# config.dat is generated at the project root by build_utils.py
config_dat = os.path.join(root_dir, 'config.dat')
if os.path.exists(config_dat):
    print(f"[SPEC] Found config.dat at {config_dat} — bundling credentials.")
    datas.append((config_dat, '.'))
else:
    print(f"[SPEC] WARNING: config.dat not found at {config_dat} — dev credentials will NOT be bundled!")

version_txt = os.path.join(root_dir, 'backend/core/version.txt')
if os.path.exists(version_txt):
    datas.append((version_txt, 'backend/core'))

a = Analysis(
    [os.path.join(root_dir, 'main.py')],
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
    icon=os.path.join(root_dir, 'resources/icon.png') if sys.platform != 'darwin' else None,
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
    icon=os.path.join(root_dir, 'resources/icon.icns') if sys.platform == 'darwin' else os.path.join(root_dir, 'resources/icon.png'),
    bundle_identifier='com.macsobel.vpxmanager',
    info_plist={
        'CFBundleShortVersionString': VERSION,
        'CFBundleVersion': VERSION,
        'NSHumanReadableCopyright': 'Aaron Sobel, 2026',
        'LSUIElement': True,
    },
)
