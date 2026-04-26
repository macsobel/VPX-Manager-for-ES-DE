"""
Settings and system status API router.
Includes macOS native folder picker via osascript.
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from config import config, save_config, AppConfig, VERSION
import database as db

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
    esde_app_path: Optional[str] = None
    media_storage_mode: Optional[str] = None
    esde_media_dir: Optional[str] = None
    esde_gamelists_dir: Optional[str] = None
    screenscraper_username: Optional[str] = None
    screenscraper_password: Optional[str] = None
    screenscraper_devid: Optional[str] = None
    screenscraper_devpassword: Optional[str] = None
    media_preferences: Optional[dict] = None


@router.get("/settings")
async def get_settings(request: Request):
    # Return model data + dynamic properties
    data = config.model_dump()
    
    data.update({
        "support_dir": config.support_dir,
        "vps_db_path": config.vps_db_path,
        "db_path": config.db_path,
        "is_local": check_is_local(request)
    })
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
    from services.screenscraper import clear_quota_cache
    clear_quota_cache()
    
    return config.model_dump()


@router.post("/settings/pick-path")
async def pick_path(prompt: str = "Select a path", pick_files: bool = False):
    """
    Open a macOS native picker dialog via osascript.
    Can pick folders or files (including .app bundles).
    """
    if sys.platform != "darwin":
        return {"path": None, "error": "Folder picker only supported on macOS"}

    # choose file allows selecting .app bundles as files which is often what users expect for 'App Path'
    # choose folder is better for directories like 'Tables'
    cmd = "choose file" if pick_files else "choose folder"
    
    script = f'''
    set chosen to {cmd} with prompt "{prompt}"
    return POSIX path of chosen
    '''
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
    """System overview: table counts, disk usage, directory status."""
    tables_dir = config.expanded_tables_dir

    # Count files
    vpx_count = 0
    b2s_count = 0
    rom_count = 0
    media_count = 0
    total_size = 0

    if tables_dir.exists():
        for f in tables_dir.rglob("*"):
            if f.is_file():
                total_size += f.stat().st_size
                ext = f.suffix.lower()
                if ext == ".vpx":
                    vpx_count += 1
                elif ext == ".directb2s":
                    b2s_count += 1
                elif ext == ".zip" and "roms" in str(f.parent).lower():
                    rom_count += 1
                elif f.parent.name == "medias":
                    media_count += 1

    # Disk usage
    disk = shutil.disk_usage(str(tables_dir.parent) if tables_dir.parent.exists() else "/")

    db_tables = await db.get_table_count()

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
            "tables_size_mb": round(total_size / (1024 * 1024), 1),
            "disk_total_gb": round(disk.total / (1024**3), 1),
            "disk_used_gb": round(disk.used / (1024**3), 1),
            "disk_free_gb": round(disk.free / (1024**3), 1),
        },
        "is_local": check_is_local(request),
        "version": VERSION
    }

@router.post("/migrate-media")
async def migrate_media():
    """Migrate media based on the current storage strategy."""
    from services.media_manager import migrate_media_strategy
    from config import config
    import asyncio
    
    # Run in background to avoid timeout
    asyncio.create_task(migrate_media_strategy(config.media_storage_mode))
    
    return {"success": True, "message": f"Migration to {config.media_storage_mode} started in background. Check global progress."}


@router.get("/scraper/sources")
async def get_scraper_sources():
    """Return available scraper sources and their valid keys."""
    from services.vpinmediadb import SOURCES_TO_CHECK as vpmdb_keys
    # ScreenScraper keys are somewhat dynamic but we have a standard set we use
    ss_keys = ["wheel-tarcisios", "wheel", "manuel", "ss", "videotable", "video-normalized", "fanart", "box-2d"]
    
    return [
        {"id": "vpinmediadb", "name": "VPinMediaDB", "keys": vpmdb_keys},
        {"id": "screenscraper", "name": "ScreenScraper", "keys": ss_keys}
    ]

