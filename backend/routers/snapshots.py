from fastapi import APIRouter, HTTPException, Body, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel

from backend.services.snapshot_service import SnapshotService
from backend.services.task_registry import task_registry

router = APIRouter(prefix="/api/tables", tags=["snapshots"])

class SnapshotCreate(BaseModel):
    label: Optional[str] = None

@router.get("/{table_id}/snapshots")
async def list_snapshots(table_id: int):
    return await SnapshotService.list_snapshots(table_id)

@router.get("/{table_id}/snapshots/status")
async def get_snapshot_status(table_id: int):
    """Get progress of a running snapshot operation for this table."""
    # Check for both create and restore task IDs
    # Since only one runs at a time for a table, we can check both or just use one ID
    # Let's use a unified ID for this table's snapshot tasks
    task_id = f"snapshot_{table_id}"
    return task_registry.get_task(task_id)

@router.post("/{table_id}/snapshots")
async def create_snapshot(table_id: int, background_tasks: BackgroundTasks, req: SnapshotCreate = Body(...)):
    task_id = f"snapshot_{table_id}"
    background_tasks.add_task(SnapshotService.create_snapshot, table_id, req.label, task_id)
    return {"success": True, "task_id": task_id}

@router.post("/{table_id}/snapshots/{snapshot_id}/restore")
async def restore_snapshot(table_id: int, snapshot_id: str, background_tasks: BackgroundTasks):
    task_id = f"snapshot_{table_id}"
    background_tasks.add_task(SnapshotService.restore_snapshot, table_id, snapshot_id, task_id)
    return {"success": True, "task_id": task_id}

@router.delete("/{table_id}/snapshots/{snapshot_id}")
async def delete_snapshot(table_id: int, snapshot_id: str):
    result = await SnapshotService.delete_snapshot(table_id, snapshot_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.delete("/all/delete")
async def delete_all_snapshots():
    """Delete all snapshot files for all tables."""
    result = await SnapshotService.delete_all_snapshots()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result
