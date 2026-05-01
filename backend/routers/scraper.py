"""
Scraper API router — ScreenScraper media download endpoints.
"""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

import backend.core.database as db
from backend.services.media_manager import get_esde_media_status
from backend.services.screenscraper import (get_quota_info, search_game,
                                    test_credentials)
from backend.services.vpinmediadb import scrape_vpinmediadb

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scraper", tags=["scraper"])


@router.post("/test")
async def test_screenscraper():
    """Test ScreenScraper credentials."""
    return await test_credentials()


@router.get("/search/{table_id}")
async def search_for_table(table_id: int):
    """Search ScreenScraper for a specific table's media."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    result = await search_game(
        table["display_name"],
        table.get("filename", ""),
    )

    # Also check what ES-DE media we already have
    esde_status = await get_esde_media_status(table_id)

    return {
        **result,
        "esde_existing": esde_status.get("existing_types", []),
        "esde_missing": esde_status.get("missing_types", []),
    }


@router.post("/batch-status")
async def get_batch_status(table_ids: list[int]):
    """Get ES-DE status for multiple tables at once."""
    from backend.services.media_manager import get_all_esde_media_status

    return await get_all_esde_media_status(table_ids)


@router.post("/download/{table_id}")
async def download_table_media(table_id: int, missing_only: bool = False):
    """Download all missing media for a single table. Prioritizes vpinmediadb then ScreenScraper."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    from backend.services.scraper_service import trigger_media_download

    result = await trigger_media_download(
        table_id=table_id,
        vps_id=table.get("vps_id"),
        table_name=table["display_name"],
        filename=table.get("filename", ""),
        missing_only=missing_only,
    )

    # Persist downloaded files into the media table immediately
    if result.get("success") and result.get("downloaded"):
        for dl_item in result["downloaded"]:
            cat = dl_item.get("type")
            path = dl_item.get("path")
            if cat and path:
                try:
                    await db.upsert_media(table_id, cat, path)
                except Exception as db_err:
                    logger.error(
                        f"Failed to persist media [{cat}] for table {table_id}: {db_err}"
                    )

    # Check what's missing from ES-DE to format message if needed
    esde_status = await get_esde_media_status(table_id)
    missing = esde_status.get("missing_types", [])

    if result.get("success") and not result.get("downloaded") and not missing:
        result["message"] = "All ES-DE media already present"

    return result


@router.post("/download-vpmdb/{table_id}")
async def download_vpmdb_media(table_id: int):
    """Download available media from vpinmediadb using VPS ID."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.get("vps_id"):
        return {
            "success": False,
            "message": "This table is not matched to VPS and cannot be scraped from vpinmediadb. Please match it first in the 'Filters' or 'Fix' tab.",
        }

    result = await scrape_vpinmediadb(
        table_id=table_id, vps_id=table["vps_id"], table_filename=table["filename"]
    )

    return result


@router.post("/download-all")
async def download_all_media(missing_only: bool = True):
    """Start batch download for all tables based on strategy."""
    from backend.services.task_registry import task_registry

    task = task_registry.get_task("batch-scraper")
    if task.status == "running":
        return {"success": False, "message": "A batch scrape is already in progress"}

    # Get all tables
    tables = await db.get_tables(limit=1000)

    tables_to_scrape = []

    if missing_only:
        # Find tables with missing ES-DE media
        for t in tables:
            esde_status = await get_esde_media_status(t["id"])
            missing = esde_status.get("missing_types", [])
            if missing:
                tables_to_scrape.append({"table": t, "missing": missing})
    else:
        # Overwrite all: Include any table that has a VPS ID
        for t in tables:
            if t.get("vps_id"):
                tables_to_scrape.append({"table": t, "missing": []})

    if not tables_to_scrape:
        return {
            "success": True,
            "message": "No tables match the scraping criteria",
            "total": 0,
        }

    task_registry.start_task(
        "batch-scraper", total=len(tables_to_scrape), message="Starting batch scrape..."
    )

    # Run in background
    asyncio.create_task(_run_batch_scrape(tables_to_scrape, missing_only=missing_only))

    return {
        "success": True,
        "message": f"Started batch scraping {len(tables_to_scrape)} tables",
        "total": len(tables_to_scrape),
    }


@router.post("/manuals/{table_id}")
async def scrape_manual_for_table(table_id: int):
    """Scrape manual for a single table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    from backend.services.screenscraper import download_media_for_table

    result = await download_media_for_table(
        table_id=table_id,
        table_name=table["display_name"],
        filename=table["filename"],
        missing_types=["manuals"],
    )

    if result.get("success"):
        # Persist downloaded files into the media table
        if result.get("downloaded"):
            for dl_item in result["downloaded"]:
                cat = dl_item.get("type")
                path = dl_item.get("path")
                if cat and path:
                    try:
                        await db.upsert_media(table_id, cat, path)
                    except Exception as db_err:
                        logger.error(
                            f"Failed to persist manual [{cat}] for table {table_id}: {db_err}"
                        )

        # Update cache/indicator
        status = await get_esde_media_status(table_id)
        if "manuals" in status.get("existing_types", []):
            await db.upsert_table({"id": table_id, "has_manual": 1})

    return result


@router.post("/batch-manuals")
async def start_batch_manual_download():
    """Start batch download for all tables missing manuals."""
    from backend.services.task_registry import task_registry

    task = task_registry.get_task("manual-batch-scraper")
    if task.status == "running":
        return {
            "success": False,
            "message": "A batch manual scrape is already in progress",
        }

    # We'll do the filtering inside the background task to avoid blocking the request
    task_registry.start_task(
        "manual-batch-scraper", total=0, message="Initializing batch manual scrape..."
    )

    # Run in background
    asyncio.create_task(_run_batch_manual_scrape())

    return {
        "success": True,
        "message": "Started batch manual scraping",
    }


async def _run_batch_manual_scrape():
    """Background task for batch manual scraping."""
    import backend.core.database as db
    from backend.services.task_registry import task_registry

    try:
        # 1. Filter tables missing manuals
        task_registry.update_progress(
            "manual-batch-scraper", 0, "Checking for missing manuals..."
        )
        tables = await db.get_tables(limit=5000)

        tables_to_scrape = []
        for t in tables:
            # Check if cancelled
            if task_registry.get_task("manual-batch-scraper").status == "cancelled":
                return

            status = await get_esde_media_status(t["id"])
            if "manuals" in status.get("missing_types", []):
                tables_to_scrape.append(t)

        if not tables_to_scrape:
            task_registry.complete_task("manual-batch-scraper", "No manuals missing")
            return

        # 2. Start the actual download loop
        task_registry.start_task(
            "manual-batch-scraper",
            total=len(tables_to_scrape),
            message=f"Starting download of {len(tables_to_scrape)} manuals...",
        )

        completed = 0
        errors = 0

        from backend.services.screenscraper import download_media_for_table

        for t in tables_to_scrape:
            # Check if cancelled
            if task_registry.get_task("manual-batch-scraper").status == "cancelled":
                break

            task_registry.update_progress(
                "manual-batch-scraper",
                completed,
                f"Downloading manual: {t['display_name']}",
            )

            try:
                result = await download_media_for_table(
                    table_id=t["id"],
                    table_name=t["display_name"],
                    filename=t["filename"],
                    missing_types=["manuals"],
                )

                if result.get("success") and result.get("total_downloaded", 0) > 0:
                    # Persist each downloaded manual into the media table
                    for dl_item in result.get("downloaded", []):
                        cat = dl_item.get("type")
                        path = dl_item.get("path")
                        if cat and path:
                            try:
                                await db.upsert_media(t["id"], cat, path)
                            except Exception as db_err:
                                logger.error(
                                    f"Failed to persist manual [{cat}] for {t['display_name']}: {db_err}"
                                )

                    await db.upsert_table({"id": t["id"], "has_manual": 1})

                if result.get("errors"):
                    logger.error(
                        f"Manual download error for {t['display_name']}: {result['errors']}"
                    )

            except Exception as e:
                errors += 1
                logger.error(f"Batch manual scrape error for {t['display_name']}: {e}")

            completed += 1
            task_registry.update_progress(
                "manual-batch-scraper",
                completed,
                f"Downloading manual: {t['display_name']}",
            )
            await asyncio.sleep(1.0)

    finally:
        task_registry.complete_task(
            "manual-batch-scraper", f"Completed {completed} tables with {errors} errors"
        )


async def _run_batch_scrape(tables_to_scrape: list, missing_only: bool = True):
    """Background task for batch scraping."""
    from backend.services.task_registry import task_registry

    task_registry.start_task(
        "batch-scraper", total=len(tables_to_scrape), message="Starting batch scrape..."
    )
    completed = 0
    errors = 0

    try:
        for item in tables_to_scrape:
            task = task_registry.get_task("batch-scraper")
            if task.status == "cancelled":
                break

            t = item["table"]
            task_registry.update_progress(
                "batch-scraper", completed, f"Scraping: {t['display_name']}"
            )

            try:
                from backend.services.scraper_service import trigger_media_download

                result = await trigger_media_download(
                    table_id=t["id"],
                    vps_id=t.get("vps_id"),
                    table_name=t["display_name"],
                    filename=t.get("filename", ""),
                    missing_only=missing_only,
                )

                if result.get("success") and result.get("downloaded"):
                    # Persist each downloaded file into the media table
                    # upsert_media(table_id, media_type, file_path, thumbnail_path="")
                    for dl_item in result["downloaded"]:
                        cat = dl_item.get("type")
                        path = dl_item.get("path")
                        if cat and path:
                            try:
                                await db.upsert_media(t["id"], cat, path)
                            except Exception as db_err:
                                logger.error(
                                    f"Failed to persist media [{cat}] for {t['display_name']}: {db_err}"
                                )

                # Check for errors in the payload
                if result.get("errors"):
                    logger.error(
                        f"Media processor errors for {t['display_name']}: {result['errors']}"
                    )
            except Exception as e:
                errors += 1
                logger.error(f"Batch scrape error for {t['display_name']}: {e}")

            completed += 1
            task_registry.update_progress(
                "batch-scraper", completed, f"Scraping: {t['display_name']}"
            )

            # Rate limit: pause between tables
            await asyncio.sleep(1.0)

    finally:
        task_registry.complete_task(
            "batch-scraper", f"Completed {completed} tables with {errors} errors"
        )


@router.get("/status")
async def get_scrape_status(include_quota: bool = False):
    from backend.core.config import config
    from backend.services.task_registry import task_registry

    # Check if user has credentials saved (literal check of config fields)
    has_user_creds = bool(
        config.screenscraper_username and config.screenscraper_password
    )

    quota = None
    if include_quota:
        quota = await get_quota_info()
        # Ensure has_credentials is also updated in the quota object if it exists
        if quota:
            quota["has_credentials"] = (
                quota.get("has_credentials", False) or has_user_creds
            )

    task = task_registry.get_task("batch-scraper")
    return {
        "batch": {
            "running": task.status == "running",
            "total": task.total,
            "completed": task.current,
            "current_table": task.message,
            "error_count": 0,
        },
        "quota": quota,
        "has_credentials": has_user_creds,  # Direct report
    }


@router.get("/manuals-status")
async def get_manuals_status():
    from backend.services.task_registry import task_registry

    task = task_registry.get_task("manual-batch-scraper")
    return {
        "batch": {
            "running": task.status == "running",
            "total": task.total,
            "completed": task.current,
            "current_table": task.message,
        }
    }


@router.post("/manuals-cancel")
async def cancel_manual_batch_scrape():
    from backend.services.task_registry import task_registry

    task = task_registry.get_task("manual-batch-scraper")
    if task.status == "running":
        task.status = "cancelled"
        return {
            "success": True,
            "message": "Batch manual scrape cancellation requested",
        }
    return {"success": False, "message": "No batch manual scrape is running"}
