"""
VPX Application Snapshots API router.
Manages backups of the Visual Pinball application and settings.
"""
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Body, BackgroundTasks
from typing import Optional
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from backend.services.vpx_snapshot_service import VpxSnapshotService
from backend.services.task_registry import task_registry

router = APIRouter(prefix="/api/vpx-snapshots", tags=["vpx-snapshots"])

TASK_ID = "vpx_snapshot"


class VpxSnapshotCreate(BaseModel):
    label: Optional[str] = None


@router.get("")
async def list_vpx_snapshots():
    """List all VPX application backups."""
    return await VpxSnapshotService.list_snapshots()


@router.get("/status")
async def get_vpx_snapshot_status():
    """Get progress of a running VPX snapshot operation."""
    return task_registry.get_task(TASK_ID)


@router.post("")
async def create_vpx_snapshot(background_tasks: BackgroundTasks, req: VpxSnapshotCreate = Body(...)):
    """Create a new backup of the VPX application and settings."""
    background_tasks.add_task(VpxSnapshotService.create_snapshot, req.label, TASK_ID)
    return {"success": True, "task_id": TASK_ID}


@router.post("/{snapshot_id}/restore")
async def restore_vpx_snapshot(snapshot_id: str, background_tasks: BackgroundTasks):
    """Restore a VPX application backup."""
    background_tasks.add_task(VpxSnapshotService.restore_snapshot, snapshot_id, TASK_ID)
    return {"success": True, "task_id": TASK_ID}


@router.delete("/all/delete")
async def delete_all_vpx_snapshots():
    """Delete all VPX application backups."""
    result = await VpxSnapshotService.delete_all_snapshots()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result


@router.delete("/{snapshot_id}")
async def delete_vpx_snapshot(snapshot_id: str):
    """Delete a VPX application backup."""
    result = await VpxSnapshotService.delete_snapshot(snapshot_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/delete-originals")
async def delete_vpx_originals():
    """Delete the current VPX application and settings for a fresh install."""
    result = await VpxSnapshotService.delete_originals()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result
