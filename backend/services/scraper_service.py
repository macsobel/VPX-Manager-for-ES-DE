import asyncio
import logging
from pathlib import Path
from typing import Optional

import httpx

from backend.core.config import load_config
from backend.services.gamelist_manager import GamelistManager
from backend.services.screenscraper import search_game as ss_search
from backend.services.screenscraper import test_credentials
from backend.services.vpinmediadb import check_availability as vpmdb_check

logger = logging.getLogger(__name__)

# Fallback dictionaries based on user-specified preference hierarchy.
# The first entry that resolves wins — no further entries are tried.
FALLBACKS = {
    "covers": [
        {"source": "vpinmediadb", "key": "wheel.png"},  # 1. vpinmediadb wheel
        {"source": "screenscraper", "key": "wheel-tarcisios"},  # 2. Tarcisio's Wheel
        {"source": "screenscraper", "key": "wheel"},  # 3. Regular Wheel
    ],
    "fanart": [
        {"source": "vpinmediadb", "key": "1k/bg.png"},  # 1. 1k backglass
        {"source": "vpinmediadb", "key": "4k/table.png"},  # 2. 4k table shot
        {"source": "vpinmediadb", "key": "1k/table.png"},  # 3. 1k table shot
    ],
    "manuals": [
        {"source": "screenscraper", "key": "manuel"},  # 1. SS manual (PDF)
    ],
    "marquees": [
        {"source": "screenscraper", "key": "wheel"},  # 1. SS Wheel
        {"source": "vpinmediadb", "key": "wheel.png"},  # 2. vpinmediadb wheel
    ],
    "screenshots": [
        {"source": "vpinmediadb", "key": "1k/table.png"},  # 1. 1k table shot
        {"source": "vpinmediadb", "key": "4k/table.png"},  # 2. 4k table shot
        {"source": "screenscraper", "key": "ss"},  # 3. SS screenshot
    ],
    "videos": [
        {
            "source": "vpinmediadb",
            "key": "1k/table.mp4",
        },  # 1. vpinmediadb 1k table video
        {
            "source": "vpinmediadb",
            "key": "4k/table.mp4",
        },  # 2. vpinmediadb 4k table video
        {"source": "vpinmediadb", "key": "1k/video.mp4"},  # 3. vpinmediadb legacy video
        {"source": "screenscraper", "key": "videotable"},  # 4. SS Table Video (FullHD)
        {
            "source": "screenscraper",
            "key": "video-normalized",
        },  # 5. SS Standardized Video
    ],
}

ESDE_TAG_MAP = {
    "covers": "image",
    "screenshots": "thumbnail",
    "fanart": "fanart",
    "marquees": "marquee",
    "videos": "video",
    "manuals": "manual",
}


async def trigger_media_download(
    table_id: int,
    vps_id: Optional[str],
    table_name: str,
    filename: str,
    missing_only: bool = False,
) -> dict:
    cfg = load_config()
    esde_base = Path(cfg.esde_media_base)
    gm = GamelistManager(str(cfg.get_gamelist_xml_path()))

    # Check current status if we are in missing_only mode
    existing_types = []
    if missing_only:
        from backend.services.media_manager import get_esde_media_status

        status = await get_esde_media_status(table_id)
        existing_types = status.get("existing_types", [])

    downloaded = []
    errors = []

    # 1. Fetch from VPinMediaDB
    vpmdb_urls = {}
    if vps_id:
        vpmdb_urls = await vpmdb_check(vps_id)

    # 2. Fetch from ScreenScraper API (Check auth first to elegantly skip)
    ss_media = {}
    ss_metadata = {}
    auth_check = await test_credentials()
    if auth_check.get("success"):
        # Fetch current table data again to get the ss_id if it was recently matched
        import backend.core.database as db

        current_table = await db.get_table(table_id)
        ss_id_to_use = current_table.get("ss_id") if current_table else None

        ss_result = await ss_search(table_name, filename, ss_id=ss_id_to_use)
        if ss_result.get("success"):
            ss_media = ss_result.get("available_media", {})
            ss_metadata = ss_result.get("xml_metadata", {})
            # Save ID
            if ss_result.get("ss_id"):
                import backend.core.database as db

                await db.upsert_table({"id": table_id, "ss_id": ss_result["ss_id"]})
    else:
        logger.info(
            f"Skipping ScreenScraper due to credential failure: {auth_check.get('message')}"
        )

    # 3. Determine best download per category
    targets = {}  # "covers" -> {"url": "", "format": ".png"}
    # Use FALLBACKS from config, fallback to default FALLBACKS if missing
    fallbacks = getattr(cfg, "media_preferences", FALLBACKS)
    if not fallbacks:
        fallbacks = FALLBACKS

    for category, fallback_list in fallbacks.items():
        logger.info(f"Processing category: {category}")
        for req in fallback_list:
            source = req["source"]
            key = req["key"]
            logger.debug(f"  Checking source: {source}, key: {key}")
            if source == "vpinmediadb" and key in vpmdb_urls:
                ext = Path(key).suffix or ".png"
                targets[category] = {
                    "url": vpmdb_urls[key],
                    "ext": ext,
                    "source": source,
                    "key": key,
                }
                logger.info(f"  MATCH FOUND (VPinMediaDB): {key} -> {vpmdb_urls[key]}")
                break
            elif source == "screenscraper" and key in ss_media:
                media_info = ss_media[key]
                logger.debug(f"    SS Match Candidate: {key} -> {media_info}")
                ext = f".{media_info['format']}" if media_info.get("format") else ".png"
                targets[category] = {
                    "url": media_info["url"],
                    "ext": ext,
                    "source": source,
                    "key": key,
                }
                logger.info(
                    f"  MATCH FOUND (ScreenScraper): {key} -> {media_info['url']}"
                )
                break
        if category not in targets:
            logger.warning(f"  NO MATCH FOUND for category: {category}")

    # 4. Download and process
    xml_updates = ss_metadata.copy()  # includes description/synopsis

    # Get table info for path generation
    import backend.core.database as db

    table_data = await db.get_table(table_id)
    if not table_data:
        return {"success": False, "error": "Table not found in database"}

    folder_name = Path(table_data["folder_path"]).name
    game_stem = Path(filename).stem

    from backend.services.media_manager import save_media_dual

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for category, info in targets.items():
            if missing_only and category in existing_types:
                logger.info(
                    f"Skipping category {category} as it already exists and missing_only is true"
                )
                continue

            media_base = cfg.esde_media_base

            # Use a safe temporary path within the app's support directory
            temp_dir = Path(cfg.support_dir) / "temp"
            temp_dir.mkdir(exist_ok=True)
            temp_path = temp_dir / f"dl_{game_stem}_{category}{info['ext']}"

            try:
                resp = await client.get(info["url"])
                if resp.status_code == 200:
                    with open(temp_path, "wb") as f:
                        f.write(resp.content)

                    # Apply specific user rotation rules (applies to any category except videos)
                    if category != "videos":
                        from backend.services.media_processor import \
                            process_downloaded_image

                        await asyncio.to_thread(
                            process_downloaded_image,
                            str(temp_path),
                            info["source"],
                            info["key"],
                        )

                    # Normalize and rotate video
                    if category == "videos":
                        from backend.services.media_processor import (
                            normalize_video, process_downloaded_video)

                        await asyncio.to_thread(normalize_video, str(temp_path))
                        await asyncio.to_thread(
                            process_downloaded_video,
                            str(temp_path),
                            info["source"],
                            info["key"],
                        )

                    # Apply dual-path saving
                    final_paths = await save_media_dual(
                        media_base=media_base,
                        media_type=category,
                        folder_name=folder_name,
                        game_stem=game_stem,
                        ext=info["ext"],
                        source_path=temp_path,
                    )

                    downloaded.append({"type": category, "path": str(final_paths[1])})

                    # Path for XML: always use the nested/game path
                    if cfg.media_storage_mode == "portable":
                        rel_path = (
                            f"./media/{category}/{folder_name}/{game_stem}{info['ext']}"
                        )
                    else:
                        rel_path = str(final_paths[1]).replace("\\", "/")

                    tag = ESDE_TAG_MAP.get(category)
                    if tag:
                        xml_updates[tag] = rel_path
                else:
                    errors.append(
                        f"Failed to download {category} via {info['url']}: HTTP {resp.status_code}"
                    )
            except Exception as e:
                errors.append(f"Error downloading {category}: {e}")
            await asyncio.sleep(0.5)

    # 5. Update gamelist.xml (Duplicating for both file and folder)
    if xml_updates:
        # Build nested relative path: ./FolderName/table.vpx
        # This ensures ES-DE correctly maps the game and the GamelistManager syncs the folder entry.
        # Use filename as is if it already contains the folder (not usual for DB 'filename'),
        # but ES-DE default is stem-as-folder.
        table_folder = game_stem
        rom_rel_path = f"./{table_folder}/{filename}"

        if "name" not in xml_updates:
            xml_updates["name"] = table_name

        # If manufacturer is available, ensure it's mapped to developer and publisher
        manufacturer = table_data.get("manufacturer")
        theme = table_data.get("theme")
        if manufacturer:
            if (
                not xml_updates.get("developer")
                or xml_updates.get("developer") == "Unknown"
            ):
                xml_updates["developer"] = manufacturer
            if (
                not xml_updates.get("publisher")
                or xml_updates.get("publisher") == "Unknown"
            ):
                xml_updates["publisher"] = manufacturer

        # Use theme for genre, fallback to manufacturer if theme is empty
        if theme:
            xml_updates["genre"] = theme
        elif manufacturer and (
            not xml_updates.get("genre") or xml_updates.get("genre") == "Unknown"
        ):
            xml_updates["genre"] = manufacturer

        # Prioritize DB/VPS players count
        db_players = table_data.get("players")
        if db_players:
            xml_updates["players"] = str(db_players)

        logger.info(
            f"Scraper service updating gamelist for {rom_rel_path} with keys: {list(xml_updates.keys())}"
        )
        gm.update_game(rom_rel_path, xml_updates)

        # ALSO update the local database with the metadata (ONLY description/notes as requested)
        db_updates = {}
        if "desc" in xml_updates:
            db_updates["notes"] = xml_updates["desc"]

        if db_updates:
            db_updates["id"] = table_id
            await db.upsert_table(db_updates)

    return {"success": True, "downloaded": downloaded, "errors": errors}
