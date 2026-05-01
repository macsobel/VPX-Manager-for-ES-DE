import asyncio
import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import backend.core.database as db
from backend.services.task_registry import task_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ini-manager", tags=["ini-manager"])


async def _run_bulk_generate(tables: list):
    """Background task to generate missing INI files."""
    completed = 0
    errors = 0

    task_registry.start_task(
        "ini-bulk", total=len(tables), message="Generating missing INIs..."
    )

    try:
        for t in tables:
            task = task_registry.get_task("ini-bulk")
            if task.status == "cancelled":
                break

            task_registry.update_progress(
                "ini-bulk", completed, f"Generating: {t['display_name']}"
            )

            try:
                vpx_path = Path(t["folder_path"]) / t["filename"]
                ini_path = vpx_path.with_suffix(".ini")

                if not ini_path.exists():
                    with open(ini_path, "w", encoding="utf-8") as f:
                        f.write("")

                completed += 1
            except Exception:
                logger.error(f"Bulk INI error for {t['display_name']}: {e}")
                errors += 1

            task_registry.update_progress(
                "ini-bulk", completed, f"Generating: {t['display_name']}"
            )
            await asyncio.sleep(0.1)  # Small breather

    finally:
        task_registry.complete_task(
            "ini-bulk", f"Completed {completed} INIs with {errors} errors"
        )


@router.post("/bulk-generate")
async def bulk_generate_ini():
    """Trigger bulk generation of missing INI files."""
    task = task_registry.get_task("ini-bulk")
    if task.status == "running":
        return {"success": False, "message": "Bulk INI generation already in progress"}

    tables = await db.get_tables(limit=5000)
    # Only process tables that don't have an INI
    to_process = []
    for t in tables:
        vpx_path = Path(t["folder_path"]) / t["filename"]
        if not vpx_path.with_suffix(".ini").exists():
            to_process.append(t)

    if not to_process:
        return {
            "success": True,
            "message": "All tables already have INI files",
            "count": 0,
        }

    asyncio.create_task(_run_bulk_generate(to_process))
    return {
        "success": True,
        "message": f"Started generating {len(to_process)} INI files",
        "count": len(to_process),
    }


@router.get("/bulk-status")
async def get_bulk_status():
    """Get the status of the bulk INI generation task."""
    return task_registry.get_all_statuses().get("ini-bulk", {"status": "idle"})


@router.get("/status")
async def get_ini_status():
    """Get the status of all INI files for tables."""
    tables = await db.get_tables(limit=10000)

    results = []
    for t in tables:
        vpx_path = Path(t["folder_path"]) / t["filename"]
        # Standard INI is named like the table file, but .ini instead of .vpx
        ini_path = vpx_path.with_suffix(".ini")
        has_ini = ini_path.exists()

        results.append(
            {
                "table_id": t["id"],
                "display_name": t["display_name"],
                "filename": t["filename"],
                "has_ini": has_ini,
            }
        )

    return results


class EditorSaveRequest(BaseModel):
    ini_content: str


@router.get("/{table_id}")
async def get_ini_details(table_id: int):
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    content = ""
    if ini_path.exists():
        try:
            with open(ini_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            try:
                with open(ini_path, "r", encoding="windows-1252") as f:
                    content = f.read()
            except Exception as e2:
                logger.error(f"Error reading INI for table {table_id}: {e2}")
                content = "; Error reading file"

    return {
        "table_id": table["id"],
        "display_name": table["display_name"],
        "filename": table["filename"],
        "has_ini": ini_path.exists(),
        "content": content,
    }


@router.post("/{table_id}/save")
async def save_ini(table_id: int, req: EditorSaveRequest):
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    try:
        with open(ini_path, "w", encoding="utf-8") as f:
            f.write(req.ini_content)
        return {"success": True}
    except Exception:
        logger.error(f"Failed to save INI for table {table_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{table_id}/generate")
async def generate_ini(table_id: int):
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    if ini_path.exists():
        return {"success": True, "message": "INI file already exists."}

    try:
        # Generate an empty INI file
        with open(ini_path, "w", encoding="utf-8") as f:
            f.write("")
        return {"success": True}
    except Exception:
        logger.error(f"Failed to generate INI for table {table_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{table_id}")
async def delete_ini(table_id: int):
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    ini_path = vpx_path.with_suffix(".ini")

    if not ini_path.exists():
        return {"success": True, "message": "INI file not found."}

    try:
        os.remove(ini_path)
        return {"success": True}
    except Exception:
        logger.error(f"Failed to delete INI for table {table_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
