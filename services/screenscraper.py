from __future__ import annotations
"""
ScreenScraper API client for media scraping.
Modeled after ES-DE's ScreenScraper.cpp implementation.

Uses the ScreenScraper v2 API to search for Visual Pinball games
and download media assets into ES-DE's downloaded_media folder structure.
"""
import httpx
import asyncio
import re
import logging
from typing import Union, Optional, List, Dict
from pathlib import Path
import urllib.parse
from config import config, load_config

logger = logging.getLogger(__name__)

API_BASE = "https://api.screenscraper.fr/api2"
SYSTEM_ID_VPINBALL = 198  # Visual Pinball system ID on ScreenScraper
SOFTNAME = "VPin Manager"

# ScreenScraper media type → (folder, suffix)
MEDIA_TYPE_MAP = {
    "wheel":              ("marquees", ""),
    "wheel-hd":           ("marquees", ""),
    "wheel-carbon":       ("marquees", ""),
    "wheel-steel":        ("marquees", ""),
    "wheel-tarcisios":    ("covers",   ""),   # Tarcisio's Wheel → Covers
    "screenmarquee":      ("marquees", ""),
    "ss":                 ("screenshots", ""),
    "sstitle":            ("screenshots", ""),
    "fanart":             ("fanart", ""),
    "video":              ("videos", ""),
    "video-normalized":   ("videos", ""),
    "videotable":         ("videos", ""),     # Table Video FullHD
    "box-2D":             ("covers", ""),
    "box-3D":             ("covers", ""),
    "box-2D-dos":         ("covers", ""),
    "support-2D":         ("covers", ""),
    "support-pdf":        ("manuals", ""),
    "manuel":             ("manuals", ""),    # SS PDF manual (correct key)
    "mixrbv1":            ("covers", ""),
    "mixrbv2":            ("covers", ""),
}

# The media types we actually want to download, in priority order
DESIRED_MEDIA_TYPES = [
    "wheel-tarcisios", "wheel-hd", "wheel",  # marquee/wheel/covers
    "ss",                                     # screenshot
    "videotable", "video",                    # video (FullHD then regular)
    "video-normalized",                       # fallback video
    "box-2D",                                 # cover
    "fanart",                                 # fan art
    "manuel", "support-pdf",                  # manual
]

# Region priority (matching ES-DE's approach)
REGION_PRIORITY = ["wor", "us", "eu", "jp", "ss", "cus"]


def _get_auth_params() -> dict:
    """Build authentication query parameters from current config."""
    cfg = config
    params = {"softname": SOFTNAME, "output": "json"}

    # Developer credentials
    if cfg.screenscraper_devid and cfg.screenscraper_devpassword:
        params["devid"] = cfg.screenscraper_devid
        params["devpassword"] = cfg.screenscraper_devpassword

    # User credentials (priority) or Developer fallback
    ssid = cfg.screenscraper_username or cfg.screenscraper_dev_user
    sspassword = cfg.screenscraper_password or cfg.screenscraper_dev_pass

    if ssid and sspassword:
        params["ssid"] = ssid
        params["sspassword"] = sspassword

    # Important for API v2
    params["v"] = "2"

    return params


def _clean_game_name(filename: str) -> str:
    """
    Clean a VPX filename for ScreenScraper search.
    Strips: file extension, parenthetical info, version numbers, author tags.
    """
    name = Path(filename).stem
    # Remove parenthetical info like (Manufacturer Year)
    name = re.sub(r'\s*\([^)]*\)\s*', ' ', name)
    # Remove brackets like [Author]
    name = re.sub(r'\s*\[[^\]]*\]\s*', ' ', name)
    # Remove version patterns like v1.0, V2.1, 1.0.0
    name = re.sub(r'\s*[vV]?\d+\.\d+(\.\d+)?\s*', ' ', name)
    # Remove common suffixes
    for tag in ['VPW', 'VPX', 'VP10', 'MOD', 'Premium', 'LE', 'CE', 'Pro']:
        name = re.sub(rf'\b{tag}\b', '', name, flags=re.IGNORECASE)
    # Collapse whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def _pick_best_media(media_list: list, media_type: str) -> Optional[dict]:
    """
    From a list of media entries, pick the best one matching the given type
    and region priority (following ES-DE's region fallback logic).
    """
    candidates = [m for m in media_list if m.get("type") == media_type]
    if not candidates:
        return None

    # Videos and fanart don't have region — just take the first
    if media_type in ("video", "video-normalized", "fanart"):
        return candidates[0]

    # Region-based selection
    for region in REGION_PRIORITY:
        for c in candidates:
            if c.get("region", "").lower() == region:
                return c

    # Fallback: take whatever is available
    return candidates[0] if candidates else None


async def test_credentials() -> dict:
    """
    Test ScreenScraper credentials by hitting the user info endpoint.
    Returns status dict with success, message, and quota info.
    """
    params = _get_auth_params()

    if not params.get("ssid") or not params.get("sspassword"):
        return {"success": False, "message": "No ScreenScraper credentials configured"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Use ssuserInfos to validate credentials
            resp = await client.get(
                f"{API_BASE}/ssuserInfos.php",
                params=params
            )

            if resp.status_code == 200:
                data = resp.json()
                # ScreenScraper JSON nesting can vary; be robust
                user = data.get("response", {}).get("ssuser")
                if not user:
                    user = data.get("ssuser", {})
                
                # Try to find a display name; ScreenScraper usually uses 'pseudo'
                display_name = user.get("pseudo") or user.get("id")
                
                # Fallback to the username we sent if the API didn't give us one back
                # but the status was 200 (Success)
                if not display_name and params.get("ssid"):
                    display_name = params["ssid"]
                
                if not display_name:
                    display_name = "Unknown"

                return {
                    "success": True,
                    "message": f"Authenticated as: {display_name}",
                    "username": display_name,
                    "level": user.get("niveau", "0"),
                    "requests_today": user.get("requeststoday", "?"),
                    "max_requests": user.get("maxrequestsperday", "?"),
                    "threads": user.get("maxthreads", "1"),
                }
            elif resp.status_code == 401 or resp.status_code == 403:
                return {"success": False, "message": "Invalid username or password"}
            else:
                return {"success": False, "message": f"API error: HTTP {resp.status_code}"}

    except httpx.TimeoutException:
        return {"success": False, "message": "Connection timed out"}
    except Exception as e:
        return {"success": False, "message": f"Connection error: {str(e)}"}


async def search_game(game_name: str, filename: str = "") -> dict:
    """
    Search ScreenScraper for a Visual Pinball game.
    Tries exact ROM name search first, then falls back to text search.
    Returns matched game info with available media.
    """
    params = _get_auth_params()
    params["systemeid"] = str(SYSTEM_ID_VPINBALL)

    clean_name = _clean_game_name(game_name)
    logger.info(f"ScreenScraper search: '{game_name}' → cleaned: '{clean_name}'")

    result = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Strategy 1: jeuInfos with romnom (exact match)
        if filename:
            try:
                search_params = {**params, "romnom": filename}
                resp = await client.get(f"{API_BASE}/jeuInfos.php", params=search_params)
                if resp.status_code == 200:
                    data = resp.json()
                    game = data.get("response", {}).get("jeu", {})
                    if game and game.get("id"):
                        result = _parse_game_result(game)
            except Exception as e:
                logger.debug(f"ROM name search failed: {e}")

        # Strategy 2: jeuRecherche with cleaned name (text search)
        if not result and len(clean_name) >= 4:
            try:
                search_params = {**params, "recherche": clean_name}
                resp = await client.get(f"{API_BASE}/jeuRecherche.php", params=search_params)
                if resp.status_code == 200:
                    data = resp.json()
                    jeux = data.get("response", {}).get("jeux", [])
                    if jeux:
                        # Take the first match
                        result = _parse_game_result(jeux[0])
            except Exception as e:
                logger.debug(f"Text search failed: {e}")

        # Strategy 3: Try with even more cleaned name
        if not result:
            # Strip "The" prefix, common in pinball names
            alt_name = re.sub(r'^The\s+', '', clean_name, flags=re.IGNORECASE)
            if alt_name != clean_name and len(alt_name) >= 4:
                try:
                    search_params = {**params, "recherche": alt_name}
                    resp = await client.get(f"{API_BASE}/jeuRecherche.php", params=search_params)
                    if resp.status_code == 200:
                        data = resp.json()
                        jeux = data.get("response", {}).get("jeux", [])
                        if jeux:
                            result = _parse_game_result(jeux[0])
                except Exception as e:
                    logger.debug(f"Alt name search failed: {e}")

    if result:
        return {"success": True, **result}
    return {"success": False, "message": f"No ScreenScraper match for '{clean_name}'"}


def _parse_game_result(game: dict) -> dict:
    """Parse a ScreenScraper game JSON object into our internal format."""
    # Extract name (region priority)
    names = game.get("noms", [])
    if isinstance(names, list):
        game_name = ""
        for region in REGION_PRIORITY:
            for n in names:
                if n.get("region", "").lower() == region:
                    game_name = n.get("text", "")
                    break
            if game_name:
                break
        if not game_name and names:
            game_name = names[0].get("text", "Unknown")
    else:
        game_name = str(names) if names else "Unknown"

    # Extract media list
    medias = game.get("medias", [])
    available_media = {}
    
    # Expose ALL medias, mapped by their exact ss_type for fallback logic
    for m in medias:
        ss_type = m.get("type")
        if not ss_type: continue
        best = _pick_best_media(medias, ss_type)
        if best and best.get("url"):
            if ss_type not in available_media:
                folder_tuple = MEDIA_TYPE_MAP.get(ss_type, ("unknown", ""))
                available_media[ss_type] = {
                    "ss_type": ss_type,
                    "url": best["url"],
                    "format": best.get("format", "png"),
                    "folder": folder_tuple[0],
                    "suffix": folder_tuple[1],
                }

    # Extract metadata for gamelist.xml
    metadata = {}
    # Description (region priority)
    synopses = game.get("synopsis", [])
    desc = ""
    for region in REGION_PRIORITY:
        for s in synopses:
            if s.get("region", "").lower() == region:
                desc = s.get("text", "")
                break
        if desc: break
    if desc: 
        metadata["desc"] = desc
        logger.debug(f"Extracted description for '{game_name}': {desc[:50]}...")

    metadata["rating"] = str(round(float(game.get("note", "0")) / 20.0, 1)) if game.get("note") else "0"
    metadata["releasedate"] = game.get("dates", [{}])[0].get("text", "")[:4] if game.get("dates") else ""
    metadata["developer"] = game.get("developpeur", {}).get("text", "")
    metadata["publisher"] = game.get("editeur", {}).get("text", "")
    metadata["genre"] = game.get("genres", [{}])[0].get("text", "") if game.get("genres") else ""
    metadata["players"] = game.get("joueurs", "1")

    return {
        "game_id": game.get("id", ""),
        "ss_id": game.get("id", ""),
        "game_name": game_name,
        "system": game.get("systeme", {}).get("text", "Visual Pinball"),
        "available_media": available_media,
        "media_count": len(available_media),
        "xml_metadata": metadata,
    }


async def download_media_for_table(
    table_id: int,
    table_name: str,
    filename: str,
    missing_types: Optional[List[str]] = None,
    progress_callback=None,
) -> dict:
    """
    Search ScreenScraper for a table and download all missing media.
    Saves files to ES-DE's downloaded_media directory structure.

    Args:
        table_id: Database table ID
        table_name: Display name for searching
        filename: VPX filename for ROM name matching
        missing_types: Optional list of ES-DE folder types to download (None = all available)
        progress_callback: Optional async callback(type, status) for progress updates

    Returns:
        Dict with success, downloaded files, and any errors.
    """
    cfg = load_config()
    esde_base = Path(cfg.esde_media_base)
    from services.gamelist_manager import GamelistManager
    # FIX: Use the actual gamelist.xml path, not the tables directory
    gm = GamelistManager(str(cfg.get_gamelist_xml_path()))

    # 1. Search ScreenScraper
    search_result = await search_game(table_name, filename)
    
    if not search_result.get("success"):
        return {"success": False, "error": search_result.get("message", "Game not found"), "downloaded": []}
        
    ss_id = search_result.get("ss_id")

    available = search_result.get("available_media", {})
    if not available:
        return {"success": False, "error": "No media available on ScreenScraper", "downloaded": []}

    # Determine which types to download
    to_download = {}
    for key, media_info in available.items():
        if missing_types is None or media_info["folder"] in missing_types:
            to_download[key] = media_info

    if not to_download:
        return {"success": True, "message": "All requested media already present", "downloaded": []}

    # Build the naming info for ES-DE
    import database as db
    table_data = await db.get_table(table_id)
    if not table_data:
        return {"success": False, "error": "Table not found"}
        
    game_stem = Path(table_data["filename"]).stem
    folder_name = Path(table_data["folder_path"]).name
    
    from services.media_manager import save_media_dual

    downloaded = []
    errors = []

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for key, media_info in to_download.items():
            media_url = media_info["url"]
            file_ext = f".{media_info['format']}" if media_info.get("format") else ".png"
            rel_folder = media_info["folder"]
            suffix = media_info["suffix"]

            # Determine base directory
            if cfg.media_storage_mode == "portable":
                media_base = Path(table_data["folder_path"]) / "media"
            else:
                media_base = esde_base

            # Use a safe temporary path within the app's support directory
            temp_dir = Path(cfg.support_dir) / "temp"
            temp_dir.mkdir(exist_ok=True)
            temp_path = temp_dir / f"dl_man_{game_stem}_{rel_folder}{file_ext}"

            if progress_callback:
                await progress_callback(key, "downloading")

            try:
                resp = await client.get(media_url)
                if resp.status_code == 200 and len(resp.content) > 100:
                    with open(temp_path, "wb") as f:
                        f.write(resp.content)
                    
                    # Apply dual-path saving
                    final_paths = await save_media_dual(
                        media_base=media_base,
                        media_type=rel_folder,
                        folder_name=folder_name,
                        game_stem=game_stem,
                        ext=file_ext,
                        source_path=temp_path
                    )
                    
                    downloaded.append({
                        "type": rel_folder,
                        "suffix": suffix,
                        "path": str(final_paths[1]),
                        "size": len(resp.content),
                        "ss_type": media_info["ss_type"],
                    })
                    logger.info(f"Downloaded and duplicated {rel_folder} for '{table_name}'")
                    if progress_callback:
                        await progress_callback(key, "complete")
                else:
                    errors.append(f"{key}: HTTP {resp.status_code}")
                    if progress_callback:
                        await progress_callback(key, "failed")

            except Exception as e:
                errors.append(f"{key}: {str(e)}")
                logger.error(f"Failed to download {rel_folder} for '{table_name}': {e}")
                if progress_callback:
                    await progress_callback(key, "failed")

            # Rate limiting
            await asyncio.sleep(0.5)

    # Update gamelist.xml with metadata
    if search_result.get("xml_metadata") or downloaded:
        xml_updates = search_result.get("xml_metadata", {}).copy()

        from database import get_table
        table_data = await get_table(table_id)
        if table_data:
            # FIX: Build correct rom_rel_path for nested folders
            # If the filename in DB is "Game.vpx" and it's in "Game (1993)" folder
            vpx_filename = table_data.get("filename", filename)
            table_folder = game_stem # ES-DE uses the filename stem as the folder name by default
            rom_rel_path = f"./{table_folder}/{vpx_filename}"

            # Map downloaded files to XML tags
            tag_map = {
                "covers": "image",
                "screenshots": "thumbnail",
                "fanart": "fanart",
                "marquees": "marquee",
                "videos": "video",
                "manuals": "manual"
            }

            for d in downloaded:
                media_type = d["type"]
                tag = tag_map.get(media_type)
                if tag:
                    # Format path based on storage mode
                    if cfg.media_storage_mode == "portable":
                        target_filename = Path(d['path']).name
                        rel_media_path = f"./media/{media_type}/{target_filename}"
                    else:
                        # Absolute path with forward slashes
                        rel_media_path = str(Path(d['path'])).replace("\\", "/")
                    xml_updates[tag] = rel_media_path

            if xml_updates:
                logger.info(f"Applying XML updates for {rom_rel_path}: {list(xml_updates.keys())}")
                gm.update_game(rom_rel_path, xml_updates)


    return {
        "success": True,
        "game_name": search_result.get("game_name", ""),
        "game_id": search_result.get("game_id", ""),
        "ss_id": search_result.get("game_id", ""),
        "downloaded": downloaded,
        "errors": errors,
        "total_available": len(available),
        "total_downloaded": len(downloaded),
    }


# Global cache for quota info to avoid hitting the API too many times (e.g. from UI polling)
_quota_cache = {
    "data": None,
    "timestamp": 0
}

async def get_quota_info(force_refresh: bool = False) -> dict:
    """
    Get current ScreenScraper API quota information.
    Caches results for 5 minutes by default to prevent API exhaustion via UI polling.
    """
    import time
    global _quota_cache
    
    current_time = time.time()
    if not force_refresh and _quota_cache["data"] and (current_time - _quota_cache["timestamp"]) < 300:
        return _quota_cache["data"]

    result = await test_credentials()
    if result.get("success"):
        quota_data = {
            "authenticated": True,
            "username": result.get("username", "Unknown"),
            "requests_today": result.get("requests_today", "?"),
            "max_requests": result.get("max_requests", "?"),
            "threads": result.get("threads", "1"),
        }
        _quota_cache = {"data": quota_data, "timestamp": current_time}
        return quota_data
    
    return {"authenticated": False, "message": result.get("message", "")}
