from fastapi import APIRouter

from backend.services.update_service import update_service

router = APIRouter(prefix="/api/updates", tags=["updates"])


@router.get("/check")
async def check_updates():
    """Manually check for updates from GitHub."""
    return await update_service.check_for_updates()
