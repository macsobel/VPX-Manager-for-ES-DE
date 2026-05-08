import logging
from pathlib import Path
from typing import List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.config import config
import backend.core.database as db
from backend.services.puppack.manager import pup_pack_manager

logger = logging.getLogger("api.puppack")

router = APIRouter(prefix="/api/puppacks", tags=["PUP Packs"])

class ApplyOptionRequest(BaseModel):
    filename: str

class ToggleVBSRequest(BaseModel):
    enable: bool

class ScreenLayoutConfig(BaseModel):
    screen: str  # e.g., "Topper", "DMD", "Backglass", "FullDMD", "Playfield"
    enable: int
    monitor_index: int
    x: float
    y: float
    width: float
    height: float

class INIConfigRequest(BaseModel):
    screens: List[ScreenLayoutConfig]

@router.get("")
async def list_puppack_tables():
    """Returns a list of all tables that currently have a PUP Pack installed."""
    tables = await db.get_tables()
    tables_with_pup = []

    for t in tables:
        table_dir = Path(t["folder_path"])
        pup_dir = table_dir / "pupvideos"

        if pup_dir.exists() and pup_dir.is_dir() and any(not item.name.startswith('.') for item in pup_dir.iterdir()):
            tables_with_pup.append({
                "id": t["id"],
                "name": t["display_name"],
                "filename": t["filename"],
            })

    return {"tables": tables_with_pup}

def resolve_pup_root(pup_dir: Path) -> Path:
    """Robustly find the true PUP root (where screens.pup or setup scripts live)."""
    if not pup_dir.exists():
        return pup_dir

    EXCLUSIONS = {
        "pupinit.bat", "getcodec.bat", "getcodec2.bat", "getlen.bat",
        "normalizemp3.bat", "editthispuppack.bat", "vlc-kill.bat",
        "ffmpeg.bat", "ffprobe.bat"
    }

    # 1. Check if the current dir is already a root
    if (pup_dir / "screens.pup").exists():
        return pup_dir
    
    # Check for setup scripts in current dir
    try:
        if any(f.suffix.lower() == ".bat" and f.name.lower() not in EXCLUSIONS 
               for f in pup_dir.iterdir() if f.is_file()):
            return pup_dir
    except:
        pass

    # 2. Search recursively
    # We want to find the shallowest directory that contains either screens.pup OR .bat options
    best_root = None
    min_depth = 999

    # Search for screens.pup
    for f in pup_dir.glob("**/screens.pup"):
        if "__MACOSX" in str(f).lower():
            continue
        depth = len(f.parts)
        if depth < min_depth:
            min_depth = depth
            best_root = f.parent

    # Search for .bat options
    for f in pup_dir.glob("**/*.bat"):
        if "__MACOSX" in str(f).lower() or f.name.lower() in EXCLUSIONS:
            continue
        depth = len(f.parts)
        if depth < min_depth:
            min_depth = depth
            best_root = f.parent
        elif depth == min_depth:
            # If same depth, screens.pup usually wins as a root indicator, 
            # but we already have a root at this depth
            pass

    return best_root if best_root else pup_dir

@router.get("/{table_id}/options")
async def get_puppack_options(table_id: int):
    """Returns available setup .bat options for a specific table's PUP Pack."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    pup_dir = resolve_pup_root(table_dir / "pupvideos")

    options = pup_pack_manager.identify_options(pup_dir)
    screens = pup_pack_manager.get_active_screens(pup_dir)
    return {
        "options": options,
        "screens": screens,
        "pup_dir": str(pup_dir.name)
    }

@router.get("/{table_id}/vbs-status")
async def get_puppack_vbs_status(table_id: int):
    """Returns the VBS PuP Pack toggle status for a table."""
    from backend.services.vbs_manager import vbs_manager
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    content = ""
    if vbs_sidecar.exists():
        try:
            with open(vbs_sidecar, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(vbs_sidecar, "r", encoding="windows-1252") as f:
                    content = f.read()
            except Exception as e:
                logger.error(f"Failed to read VBS content: {e}")
        except Exception as e:
            logger.error(f"Failed to read VBS content: {e}")

    return {
        "is_extracted": vbs_sidecar.exists(),
        "has_puppack_setting": vbs_manager.has_puppack_setting(content),
        "puppack_enabled": vbs_manager.is_puppack_enabled(content),
    }

@router.post("/{table_id}/toggle-vbs")
async def toggle_puppack_vbs(table_id: int, req: ToggleVBSRequest):
    """Toggles the PuP Pack setting in the VBS file."""
    from backend.services.vbs_manager import vbs_manager
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    if not vbs_sidecar.exists():
        raise HTTPException(status_code=400, detail="VBS sidecar not found. Please extract it first.")

    try:
        # Try UTF-8 first, fallback to windows-1252 like other text handlers
        content = ""
        used_encoding = "utf-8"
        try:
            with open(vbs_sidecar, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            used_encoding = "windows-1252"
            with open(vbs_sidecar, "r", encoding="windows-1252") as f:
                content = f.read()

        new_content = vbs_manager.apply_regex_fix(content, "puppack", enable=req.enable)

        with open(vbs_sidecar, "w", encoding=used_encoding) as f:
            f.write(new_content)

        return {"success": True, "puppack_enabled": req.enable}
    except Exception as e:
        logger.error(f"Failed to toggle PuP Pack in VBS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{table_id}/ini-config")
async def get_puppack_ini_config(table_id: int):
    """Returns the parsed PuP Pack configuration from the table's INI file."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    from backend.services.puppack.ini_helper import read_puppack_ini_config
    config = read_puppack_ini_config(ini_path)

    return {"config": config}

@router.post("/{table_id}/ini-config")
async def save_puppack_ini_config(table_id: int, req: INIConfigRequest):
    """Saves the PuP Pack screen layout to the table's INI file."""
    from backend.services.puppack.ini_helper import update_puppack_ini_config
    from backend.core.display_utils import get_effective_rotation
    from backend.routers.ini_manager import apply_flexdmd_patch
    from backend.core.config import config

    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    # If INI doesn't exist, generate a default one first
    if not ini_path.exists():
        try:
            rot = get_effective_rotation(config.master_orientation)
            content = f"[Player]\nRotation = {rot}\nCabinetAutofitMode = 1\nCabinetAutofitPos = 0.1\n\n[Standalone]\n"
            with open(ini_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            logger.error(f"Failed to generate base INI for table {table_id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate base INI file")

    config_updates = {}
    for screen_config in req.screens:
        prefix = f"PUP{screen_config.screen}"
        config_updates[f"{prefix}Window"] = screen_config.enable
        if screen_config.enable:
            config_updates[f"{prefix}Screen"] = screen_config.monitor_index
            config_updates[f"{prefix}WindowX"] = int(screen_config.x)
            config_updates[f"{prefix}WindowY"] = int(screen_config.y)
            config_updates[f"{prefix}WindowWidth"] = int(screen_config.width)
            config_updates[f"{prefix}WindowHeight"] = int(screen_config.height)

    success = update_puppack_ini_config(ini_path, config_updates)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save INI configuration")

    # Automatically apply FlexDMD patch while we are at it
    try:
        apply_flexdmd_patch(ini_path, Path(table["folder_path"]), table["filename"])
    except Exception as e:
        logger.warning(f"Failed to apply FlexDMD patch while saving PuP config: {e}")

    return {"success": True, "message": "Screen layout saved successfully."}

@router.post("/{table_id}/apply")
async def apply_puppack_option(table_id: int, req: ApplyOptionRequest):
    """Applies a selected setup .bat option for a table's PUP Pack."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    pup_dir = resolve_pup_root(table_dir / "pupvideos")

    success = pup_pack_manager.apply_option(pup_dir, req.filename)
    if success:
        return {"success": True, "message": f"Applied {req.filename} successfully."}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to apply {req.filename}")
