from pathlib import Path

"""
Media API router.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

import backend.core.database as db
from backend.services.media_manager import (delete_media_file, get_all_media_status,
                                    get_media_file_path, get_media_status,
                                    save_uploaded_media)

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/missing")
async def get_missing_media():
    """Get all tables with missing media."""
    results = await get_all_media_status()
    return {"tables": results, "total": len(results)}


@router.get("/tables-with-manuals")
async def get_tables_with_manuals():
    """Get list of table IDs that have manuals."""

    from backend.core.config import config

    manuals_dir = config.esde_media_base / "manuals"
    if not manuals_dir.exists():
        return []

    tables = await db.get_tables(limit=2000)
    has_manual_ids = []

    for t in tables:
        if not t.get("filename"):
            continue

        stem = Path(t["filename"]).stem
        folder_name = (
            Path(t.get("folder_path", "")).name if t.get("folder_path") else ""
        )

        # Check root
        if (manuals_dir / f"{stem}.pdf").exists():
            has_manual_ids.append(t["id"])
            continue

        # Check nested
        if folder_name and (manuals_dir / folder_name / f"{stem}.pdf").exists():
            has_manual_ids.append(t["id"])

    return has_manual_ids


@router.get("/{table_id}")
async def get_table_media(table_id: int):
    """Get media status for a specific table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return await get_media_status(table_id)


@router.post("/{table_id}/upload")
async def upload_media(table_id: int, media_type: str, file: UploadFile = File(...)):
    """Upload a media file for a table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    from backend.services.media_manager import ESDE_STATUS_TYPES

    valid_types = ESDE_STATUS_TYPES
    if media_type not in valid_types:
        raise HTTPException(
            status_code=400, detail=f"Invalid media type. Must be one of: {valid_types}"
        )

    content = await file.read()
    result = await save_uploaded_media(table_id, media_type, file.filename, content)
    return result


@router.delete("/{table_id}/{media_type}")
async def delete_media(table_id: int, media_type: str):
    """Delete a specific media file for a table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    from backend.services.media_manager import ESDE_STATUS_TYPES

    valid_types = ESDE_STATUS_TYPES
    if media_type not in valid_types:
        raise HTTPException(
            status_code=400, detail=f"Invalid media type. Must be one of: {valid_types}"
        )

    result = await delete_media_file(table_id, media_type)
    if not result.get("success"):
        raise HTTPException(
            status_code=400, detail=result.get("error", "Delete failed")
        )
    return result


@router.delete("/{table_id}")
async def delete_all_media(table_id: int):
    """Delete all media for a table."""
    from backend.services.media_manager import delete_all_media_by_id

    result = await delete_all_media_by_id(table_id)
    if not result.get("success"):
        raise HTTPException(
            status_code=400, detail=result.get("error", "Delete failed")
        )
    return result


@router.get("/{table_id}/manual")
async def serve_table_manual(table_id: int):
    """Serve the manual PDF for a table."""
    file_path = await get_media_file_path(table_id, "manuals")
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{file_path.name}"'},
    )


@router.get("/{table_id}/serve/{media_type}")
async def serve_esde_media_file(table_id: int, media_type: str):
    """Serve a specific ES-DE media file."""
    file_path = await get_media_file_path(table_id, media_type)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    return FileResponse(file_path)


@router.post("/{table_id}/rotate/{media_type}")
async def rotate_table_media(table_id: int, media_type: str, angle: int = 90):
    """Rotate a specific media file for a table."""
    from backend.services.media_manager import rotate_media

    result = await rotate_media(table_id, media_type, angle)
    if not result.get("success"):
        raise HTTPException(
            status_code=400, detail=result.get("error", "Rotation failed")
        )
    return result
