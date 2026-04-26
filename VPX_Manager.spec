# -*- mode: python ; coding: utf-8 -*-
import sys

block_cipher = None

import os
datas = [('frontend', 'frontend'), ('resources', 'resources')]
if os.path.exists('config.dat'):
    datas.append(('config.dat', '.'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=['uvicorn', 'fastapi', 'aiosqlite', 'pydantic', 'httpx', 'olefile', 'PIL', 'setproctitle', 'rumps'],
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
)
