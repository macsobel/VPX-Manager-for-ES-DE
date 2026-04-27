from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

# Base URL for raw GitHub content
REPO_RAW_BASE = "https://raw.githubusercontent.com/superhac/vpinmediadb/main"

# Sources we care about based on priority
SOURCES_TO_CHECK = [
    "wheel.png",  # Covers / Marquees
    "1k/table.png",  # Fanart / Screenshots
    "4k/table.png",  # Fanart / Screenshots
    "1k/bg.png",  # Fanart
    "1k/video.mp4",  # Videos
    "1k/table.mp4",  # Videos (Alternative)
    "4k/table.mp4",  # Videos (4K)
]


async def check_availability(vps_id: str) -> dict:
    """
    Check for available media from vpinmediadb for a specific VPS ID.
    Returns a dict mapping source file name -> url.
    """
    if not vps_id:
        return {}

    available = {}
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        # Perform HEAD requests for each source to check availability.
        for source in SOURCES_TO_CHECK:
            url = f"{REPO_RAW_BASE}/{vps_id}/{source}"
            try:
                resp = await client.head(url)
                logger.debug(f"vpinmediadb check: {url} -> {resp.status_code}")
                if resp.status_code == 200:
                    available[source] = url
                    # Aliasing: map variants to standard keys for backward compatibility with user configs
                    if source in ("1k/table.mp4", "4k/table.mp4"):
                        available["1k/video.mp4"] = url
            except Exception as e:
                logger.debug(f"vpinmediadb: {source} check failed: {e}")

    return available


async def scrape_vpinmediadb(table_id: int, vps_id: str, table_filename: str) -> dict:
    """Legacy compatibility function, do not use directly. Use scraper_service."""
    return {"success": False, "message": "Use scraper_service logic instead."}
