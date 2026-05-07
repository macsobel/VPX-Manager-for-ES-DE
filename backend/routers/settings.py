import os

"""
Settings and system status API router.
Includes macOS native folder picker via osascript.
"""

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

import backend.core.database as db
from backend.core.config import VERSION, AppConfig, config, save_config

router = APIRouter(prefix="/api", tags=["settings"])


def check_is_local(request: Request) -> bool:
    """Check if the request originated from the same computer as the server."""
    client_host = request.client.host
    # Direct loopback
    if client_host in ("127.0.0.1", "::1", "localhost"):
        return True

    # Check against server's own LAN IPs
    import socket

    try:
        hostname = socket.gethostname()
        local_ips = socket.gethostbyname_ex(hostname)[2]
        if client_host in local_ips:
            return True
    except Exception:
        pass
    return False


class SettingsUpdate(BaseModel):
    tables_dir: Optional[str] = None
    vpx_standalone_app_path: Optional[str] = None
    vpx_use_flavor: Optional[str] = None
    vpx_display_mode: Optional[str] = None
    master_orientation: Optional[str] = None
    esde_app_path: Optional[str] = None
    media_storage_mode: Optional[str] = None
    esde_media_dir: Optional[str] = None
    esde_gamelists_dir: Optional[str] = None
    screenscraper_username: Optional[str] = None
    screenscraper_password: Optional[str] = None
    screenscraper_devid: Optional[str] = None
    screenscraper_devpassword: Optional[str] = None
    media_preferences: Optional[dict] = None
    display_count: Optional[int] = None
    displays: Optional[list] = None


@router.get("/settings")
async def get_settings(request: Request):
    # Return model data + dynamic properties
    data = config.model_dump()

    data.update(
        {
            "support_dir": config.support_dir,
            "vps_db_path": config.vps_db_path,
            "db_path": config.db_path,
            "is_local": check_is_local(request),
        }
    )
    return data


@router.get("/settings/defaults")
async def get_defaults():
    """Return hardcoded defaults from AppConfig."""
    return AppConfig().model_dump()


@router.put("/settings")
async def update_settings(update: SettingsUpdate):
    update_dict = update.model_dump(exclude_none=True)
    current = config.model_dump()
    current.update(update_dict)

    new_config = AppConfig(**current)
    # Update global and persist
    for key, val in new_config.model_dump().items():
        setattr(config, key, val)
    save_config(new_config)

    # Invalidate cache so ScreenScraper auth is re-checked immediately
    from backend.services.screenscraper import clear_quota_cache

    clear_quota_cache()

    return config.model_dump()


@router.post("/settings/pick-path")
async def pick_path(prompt: str = "Select a path", pick_files: bool = False):
    """
    Open a native picker dialog. Uses osascript on macOS and tkinter on Linux.
    Can pick folders or files (including .app bundles).
    """
    if sys.platform == "linux":
        try:
            from backend.services.linux_dialogs import pick_folder, pick_file

            if pick_files:
                picked_path = pick_file(prompt)
            else:
                picked_path = pick_folder(prompt)

            if picked_path:
                return {"path": picked_path}
            return {"path": None}
        except Exception as e:
            return {"path": None, "error": f"Linux folder picker failed: {str(e)}"}

    elif sys.platform != "darwin":
        return {"path": None, "error": "Folder picker only supported on macOS and Linux"}

    # choose file allows selecting .app bundles as files which is often what users expect for 'App Path'
    # choose folder is better for directories like 'Tables'
    cmd = "choose file" if pick_files else "choose folder"

    script = f"""
    set chosen to {cmd} with prompt "{prompt}"
    return POSIX path of chosen
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0 and result.stdout.strip():
            selected = result.stdout.strip().rstrip("/")
            return {"path": selected}
        return {"path": None}
    except subprocess.TimeoutExpired:
        return {"path": None, "error": "Dialog timed out"}
    except Exception as e:
        return {"path": None, "error": str(e)}


@router.get("/system/status")
async def system_status(request: Request):
    """System overview: table counts, disk usage, directory status, software checks."""
    tables_dir = config.expanded_tables_dir

    # Count files and track sizes separately
    vpx_count = 0
    b2s_count = 0
    rom_count = 0
    media_count = 0
    table_size = 0
    media_size = 0

    if tables_dir.exists():
        for f in tables_dir.rglob("*"):
            if f.is_file():
                fsize = f.stat().st_size
                ext = f.suffix.lower()
                parent_name = f.parent.name.lower()

                # Classify as media or table content
                is_media = parent_name == "medias" or parent_name in (
                    "covers", "screenshots", "titlescreens", "videos",
                    "fanart", "marquees", "miximages", "backglasses",
                )
                if is_media:
                    media_size += fsize
                    media_count += 1
                else:
                    table_size += fsize

                if ext == ".vpx":
                    vpx_count += 1
                elif ext == ".directb2s":
                    b2s_count += 1
                elif ext == ".zip" and "roms" in str(f.parent).lower():
                    rom_count += 1

    # Disk usage
    disk = shutil.disk_usage(
        str(tables_dir.parent) if tables_dir.parent.exists() else "/"
    )

    db_tables = await db.get_table_count()

    # Software path checks
    vpx_raw = config.vpx_standalone_app_path.strip()
    esde_raw = config.esde_app_path.strip()
    
    vpx_path = Path(os.path.expanduser(vpx_raw)) if vpx_raw else None
    esde_path = Path(os.path.expanduser(esde_raw)) if esde_raw else None
    
    return {
        "directories": {
            "tables_dir": {
                "path": str(tables_dir),
                "exists": tables_dir.exists(),
            },
            "support_dir": {
                "path": config.support_dir,
                "exists": Path(config.support_dir).exists(),
            },
        },
        "counts": {
            "vpx_files": vpx_count,
            "b2s_files": b2s_count,
            "rom_files": rom_count,
            "media_files": media_count,
            "db_tables": db_tables,
        },
        "storage": {
            "tables_size_mb": round(table_size / (1024 * 1024), 1),
            "media_size_mb": round(media_size / (1024 * 1024), 1),
            "disk_total_gb": round(disk.total / (1024**3), 1),
            "disk_used_gb": round(disk.used / (1024**3), 1),
            "disk_free_gb": round(disk.free / (1024**3), 1),
        },
        "software": {
            "vpx": {
                "path": str(vpx_path) if vpx_path else "",
                "exists": vpx_path.exists() if vpx_path else False,
                "label": "Visual Pinball Standalone",
            },
            "esde": {
                "path": str(esde_path) if esde_path else "",
                "exists": esde_path.exists() if esde_path else False,
                "label": "Emulation Station DE",
            },
        },
        "is_local": check_is_local(request),
        "version": VERSION,
        "platform": sys.platform,
    }



@router.post("/migrate-media")
async def migrate_media():
    """Migrate media based on the current storage strategy."""
    import asyncio

    from backend.core.config import config
    from backend.services.media_manager import migrate_media_strategy

    # Run in background to avoid timeout
    asyncio.create_task(migrate_media_strategy(config.media_storage_mode))

    return {
        "success": True,
        "message": f"Migration to {config.media_storage_mode} started in background. Check global progress.",
    }


@router.get("/scraper/sources")
async def get_scraper_sources():
    """Return available scraper sources and their valid keys."""
    from backend.services.vpinmediadb import SOURCES_TO_CHECK as vpmdb_keys

    # ScreenScraper keys are somewhat dynamic but we have a standard set we use
    ss_keys = [
        "wheel-tarcisios",
        "wheel",
        "manuel",
        "ss",
        "videotable",
        "video-normalized",
        "fanart",
        "box-2d",
    ]

    return [
        {"id": "vpinmediadb", "name": "VPinMediaDB", "keys": vpmdb_keys},
        {"id": "screenscraper", "name": "ScreenScraper", "keys": ss_keys},
    ]
