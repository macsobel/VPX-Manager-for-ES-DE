"""
VPS (Virtual Pinball Spreadsheet) API router.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import backend.core.database as db
from backend.services.vps_matcher import vps_matcher

router = APIRouter(prefix="/api/vps", tags=["vps"])


class MatchRequest(BaseModel):
    vps_id: str
    vps_file_id: str = ""
    name: str = ""
    manufacturer: str = ""
    year: str = ""
    theme: str = ""
    table_type: str = ""
    ipdb_id: str = ""
    players: str = "1"


from fastapi import APIRouter, BackgroundTasks, HTTPException

from backend.services.task_registry import task_registry


@router.post("/sync")
async def sync_databases(background_tasks: BackgroundTasks):
    """Fetch the latest VPS database and VBS standalone scripts database in background."""
    # Check if already running
    task = task_registry.get_task("vps_sync")
    if task.status == "running":
        return {"success": False, "message": "Database sync already in progress"}

    background_tasks.add_task(vps_matcher.fetch_database)
    return {"success": True, "message": "Database sync started in background"}


@router.get("/sync/status")
async def get_sync_status():
    """Get the status of the current or last sync."""
    return task_registry.get_all_statuses().get("vps_sync", {"status": "idle"})


@router.get("/search")
async def search_vps(q: str = "", limit: int = 20):
    """Search the VPS database by name."""
    results = vps_matcher.search(q, limit=limit)
    return {"results": results, "query": q}


@router.get("/suggestions/{table_id}")
async def suggest_matches(table_id: int, limit: int = 10):
    """Auto-suggest VPS matches for a table."""
    try:
        table = await db.get_table(table_id)
        if not table:
            return {"error": "Table not found", "suggestions": []}

        print(f"DEBUG: Suggesting matches for table {table_id}: '{table['display_name']}'")
        suggestions = vps_matcher.suggest_matches(table["display_name"], limit=limit)
        print(f"DEBUG: Found {len(suggestions)} suggestions")
        return {
            "table_id": table_id,
            "table_name": table["display_name"],
            "suggestions": suggestions,
        }
    except Exception as e:
        print(f"ERROR in suggest_matches: {e}")
        return {"error": str(e), "suggestions": []}


@router.post("/match/{table_id}")
async def match_table(table_id: int, match: MatchRequest):
    """Associate a table with a VPS entry."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    update_data = {
        "filename": table["filename"],
        "vps_id": match.vps_id,
        "vps_file_id": match.vps_file_id,
    }
    if match.name:
        update_data["display_name"] = match.name
    if match.manufacturer:
        update_data["manufacturer"] = match.manufacturer
    if match.year:
        update_data["year"] = match.year
    if match.theme:
        update_data["theme"] = match.theme
    if match.table_type:
        update_data["table_type"] = match.table_type
    if match.ipdb_id:
        update_data["ipdb_id"] = match.ipdb_id
    if match.players:
        update_data["players"] = match.players

    await db.upsert_table(update_data)

    # NEW: Automatically rename files/folders to standardized format
    from backend.services.table_file_service import TableFileService

    await TableFileService.standardize_names(table_id)

    updated = await db.get_table(table_id)
    return {"success": True, "table": updated}


@router.post("/unmatch/{table_id}")
async def unmatch_table(table_id: int):
    """Remove VPS association from a table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    await db.upsert_table(
        {"filename": table["filename"], "vps_id": None, "vps_file_id": None}
    )
    updated = await db.get_table(table_id)
    return {"success": True, "table": updated}


@router.get("/{vps_id}")
async def get_vps_entry(vps_id: str):
    """Get a single VPS entry by ID, formatted for the frontend."""
    entry = vps_matcher.get_entry(vps_id)
    if not entry:
        raise HTTPException(status_code=404, detail="VPS entry not found")

    return vps_matcher._format_entry(entry)
