from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel

from backend.services.snapshot_service import SnapshotService

router = APIRouter(prefix="/api/tables", tags=["snapshots"])

class SnapshotCreate(BaseModel):
    label: Optional[str] = None

@router.get("/{table_id}/snapshots")
async def list_snapshots(table_id: int):
    return await SnapshotService.list_snapshots(table_id)

@router.post("/{table_id}/snapshots")
async def create_snapshot(table_id: int, req: SnapshotCreate = Body(...)):
    result = await SnapshotService.create_snapshot(table_id, req.label)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/{table_id}/snapshots/{snapshot_id}/restore")
async def restore_snapshot(table_id: int, snapshot_id: str):
    result = await SnapshotService.restore_snapshot(table_id, snapshot_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.delete("/{table_id}/snapshots/{snapshot_id}")
async def delete_snapshot(table_id: int, snapshot_id: str):
    result = await SnapshotService.delete_snapshot(table_id, snapshot_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result
