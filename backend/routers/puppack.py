import logging
from pathlib import Path
from typing import List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.core.config import config
import backend.core.database as db
from backend.services.puppack.manager import pup_pack_manager

logger = logging.getLogger("api.puppack")

router = APIRouter(prefix="/puppacks", tags=["PUP Packs"])

class ApplyOptionRequest(BaseModel):
    filename: str

@router.get("/")
async def list_puppack_tables():
    """Returns a list of all tables that currently have a PUP Pack installed."""
    tables = await db.get_all_tables()
    tables_with_pup = []

    for t in tables:
        table_dir = Path(t["folder_path"])
        pup_dir = table_dir / "pupvideos"

        if pup_dir.exists() and pup_dir.is_dir() and any(pup_dir.iterdir()):
            tables_with_pup.append({
                "id": t["id"],
                "name": t["display_name"],
                "filename": t["filename"],
            })

    return {"tables": tables_with_pup}

@router.get("/{table_id}/options")
async def get_puppack_options(table_id: int):
    """Returns available setup .bat options for a specific table's PUP Pack."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    pup_dir = table_dir / "pupvideos"

    # Check if nested
    subdirs = [d for d in pup_dir.iterdir() if d.is_dir()]
    files = [f for f in pup_dir.iterdir() if f.is_file()]
    if len(subdirs) == 1 and len(files) == 0:
        pup_dir = subdirs[0]

    options = pup_pack_manager.identify_options(pup_dir)
    return {"options": options, "pup_dir": str(pup_dir.name)}

@router.post("/{table_id}/apply")
async def apply_puppack_option(table_id: int, req: ApplyOptionRequest):
    """Applies a selected setup .bat option for a table's PUP Pack."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    pup_dir = table_dir / "pupvideos"

    # Check if nested
    subdirs = [d for d in pup_dir.iterdir() if d.is_dir()]
    files = [f for f in pup_dir.iterdir() if f.is_file()]
    if len(subdirs) == 1 and len(files) == 0:
        pup_dir = subdirs[0]

    success = pup_pack_manager.apply_option(pup_dir, req.filename)
    if success:
        return {"success": True, "message": f"Applied {req.filename} successfully."}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to apply {req.filename}")
