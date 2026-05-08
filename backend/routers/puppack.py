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
