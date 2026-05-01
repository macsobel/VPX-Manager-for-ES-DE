from fastapi import APIRouter, HTTPException

from backend.services.patch_manager import PatchManager

router = APIRouter(prefix="/api/patches", tags=["patches"])


@router.get("/status")
async def get_patch_status():
    """Get patching status for all eligible tables."""
    return await PatchManager.get_patch_status()


@router.post("/apply/{table_id}")
async def apply_patch(table_id: int):
    """Apply a patch to a specific table."""
    result = await PatchManager.apply_patch(table_id)
    if not result["success"]:
        raise HTTPException(
            status_code=400, detail=result.get("error", "Failed to apply patch")
        )
    return result
