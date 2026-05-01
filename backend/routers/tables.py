import os

"""
Tables API router — CRUD, scanning, filtering.
"""

import logging
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

import backend.core.database as db
from backend.core.config import APP_SUPPORT_DIR, config
from backend.services.gamelist_manager import GamelistManager
from backend.services.scanner import scan_tables_directory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tables", tags=["tables"])


class TableUpdate(BaseModel):
    display_name: Optional[str] = None
    manufacturer: Optional[str] = None
    year: Optional[str] = None
    table_type: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    ss_id: Optional[str] = None
    players: Optional[str] = None


class IgnoreRequest(BaseModel):
    version: str


@router.get("")
async def list_tables(
    search: str = "",
    manufacturer: str = "",
    year: str = "",
    table_type: str = "",
    has_b2s: Optional[int] = None,
    vps_matched: Optional[bool] = None,
    collection_id: Optional[int] = None,
    sort_by: str = "display_name",
    sort_dir: str = "asc",
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
):
    tables = await db.get_tables(
        search=search,
        manufacturer=manufacturer,
        year=year,
        table_type=table_type,
        has_b2s=has_b2s,
        vps_matched=vps_matched,
        collection_id=collection_id,
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )
    total = await db.get_table_count(search=search, vps_matched=vps_matched)

    # Enrich with latest VPS versions from cache and physical media status
    from backend.services.vps_matcher import vps_matcher

    if not vps_matcher._loaded:
        await vps_matcher._load_cached_async()

    esde_base = config.esde_media_base
    fanart_dir = esde_base / "fanart"

    enriched_tables = []
    for t in tables:
        t_dict = dict(t)

        # Override the database has_fanart with actual physical file existence
        has_fanart = 0
        if fanart_dir.exists() and t_dict.get("filename"):
            stem = Path(t_dict["filename"]).stem
            folder_name = (
                Path(t_dict.get("folder_path", "")).name
                if t_dict.get("folder_path")
                else ""
            )

            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                # Check root folder
                if (fanart_dir / f"{stem}{ext}").exists():
                    has_fanart = 1
                    break
                # Check nested game folder
                if folder_name and (fanart_dir / folder_name / f"{stem}{ext}").exists():
                    has_fanart = 1
                    break
        t_dict["has_fanart"] = has_fanart

        if t_dict.get("vps_id"):
            entry = vps_matcher.get_entry(t_dict["vps_id"])
            if entry:
                # If matched to a specific file, use that. Otherwise use the best guess.
                file_entry = None
                if t_dict.get("vps_file_id"):
                    file_entry = vps_matcher.get_file_entry(
                        t_dict["vps_id"], t_dict["vps_file_id"]
                    )

                if not file_entry:
                    file_entry = vps_matcher._get_latest_table(
                        entry.get("tableFiles", [])
                    )

                t_dict["latest_vps_version"] = file_entry.get("version", "")
                t_dict["vps_file_url"] = (
                    (file_entry.get("urls") or [{}])[0].get("url", "")
                    if file_entry.get("urls")
                    else ""
                )

                # Global latest (Community)
                community_entry = vps_matcher._get_latest_table(
                    entry.get("tableFiles", [])
                )
                t_dict["community_vps_version"] = community_entry.get("version", "")
                t_dict["community_vps_author"] = (
                    community_entry.get("authors", [""])[0]
                    if community_entry.get("authors")
                    else ""
                )
                t_dict["community_vps_url"] = (
                    (community_entry.get("urls") or [{}])[0].get("url", "")
                    if community_entry.get("urls")
                    else ""
                )
                t_dict["community_vps_file_id"] = community_entry.get("id", "")
                t_dict["is_community_newer"] = community_entry.get(
                    "id"
                ) != file_entry.get("id")
        enriched_tables.append(t_dict)

    return {"tables": enriched_tables, "total": total, "limit": limit, "offset": offset}


@router.get("/filters")
async def get_filter_options():
    """Return available filter values for the frontend dropdowns."""
    return {
        "manufacturers": await db.get_distinct_values("manufacturer"),
        "years": await db.get_distinct_values("year"),
        "types": await db.get_distinct_values("table_type"),
    }


@router.get("/update-count")
async def get_update_count():
    """Count tables with available updates using the exact same logic as the tables page."""
    from backend.services.vps_matcher import vps_matcher

    if not vps_matcher._loaded:
        await vps_matcher._load_cached_async()

    def versions_are_equal(v1: str, v2: str) -> bool:
        """Mirror of the frontend versionsAreEqual function."""
        if v1 == v2:
            return True
        if not v1 or not v2:
            return False
        parts1 = str(v1).split('.')
        parts2 = str(v2).split('.')
        length = max(len(parts1), len(parts2))
        for i in range(length):
            p1 = (parts1[i] if i < len(parts1) else '0').strip()
            p2 = (parts2[i] if i < len(parts2) else '0').strip()
            if p1.isdigit() and p2.isdigit():
                if int(p1) != int(p2):
                    return False
            else:
                if p1.lower() != p2.lower():
                    return False
        return True

    tables = await db.get_tables(limit=9999)
    updates_count = 0

    for t in tables:
        t_dict = dict(t)
        vps_id = t_dict.get("vps_id", "")
        if not vps_id:
            continue

        current_version = (t_dict.get("version") or "").strip()
        ignored_version = (t_dict.get("ignored_version") or "").strip()

        entry = vps_matcher.get_entry(vps_id)
        if not entry:
            continue

        # Get the specific matched file entry
        file_entry = None
        if t_dict.get("vps_file_id"):
            file_entry = vps_matcher.get_file_entry(vps_id, t_dict["vps_file_id"])
        if not file_entry:
            file_entry = vps_matcher._get_latest_table(entry.get("tableFiles", []))
        if not file_entry:
            continue

        latest_version = (file_entry.get("version") or "").strip()

        # Get community (global latest) entry
        community_entry = vps_matcher._get_latest_table(entry.get("tableFiles", []))
        community_version = (community_entry.get("version") or "").strip()
        is_community_newer = community_entry.get("id") != file_entry.get("id")

        # Check for direct update: latest_vps_version != current AND != ignored
        has_direct = (
            latest_version
            and current_version
            and not versions_are_equal(latest_version, current_version)
            and not versions_are_equal(latest_version, ignored_version)
        )

        # Check for community update: same logic but using community version
        has_community = (
            is_community_newer
            and community_version
            and current_version
            and not versions_are_equal(community_version, current_version)
            and not versions_are_equal(community_version, ignored_version)
        )

        if has_direct or has_community:
            updates_count += 1

    return {"updates_available": updates_count}



@router.get("/stats")
async def get_stats():
    """Dashboard statistics."""
    total = await db.get_table_count()
    matched = await db.get_table_count(vps_matched=True)
    unmatched = await db.get_table_count(vps_matched=False)
    from backend.services.media_manager import get_all_media_status

    media_statuses = await get_all_media_status()
    missing_media_count = sum(1 for s in media_statuses if s.get("missing_types"))

    # VBS stats
    db_conn = await db.get_db()
    cursor = await db_conn.execute("SELECT COUNT(*) FROM tables WHERE vbs_hash != ''")
    row_extracted = await cursor.fetchone()
    vbs_extracted = row_extracted[0] if row_extracted else 0

    # Check for patches via the hashes.json
    from backend.services.vbs_manager import vbs_manager

    hashes = await vbs_manager.get_patch_hashes()
    patch_final_hashes = {
        item["patched"]["sha256"] for item in hashes if "patched" in item
    }

    cursor = await db_conn.execute("SELECT vbs_hash FROM tables WHERE vbs_hash != ''")
    vbs_rows = await cursor.fetchall()
    vbs_patched = sum(1 for r in vbs_rows if r["vbs_hash"] in patch_final_hashes)

    # Table updates available (VPS-matched tables with newer versions)
    updates_available = 0
    try:
        vps_tables = await db.get_tables(vps_matched=True, limit=9999)
        for t in vps_tables:
            if not t.get("vps_id"):
                continue
            stored_version = (t.get("vps_version") or t.get("version") or "").strip()
            if not stored_version:
                continue
            entry = vps_matcher.get_entry(t["vps_id"])
            if not entry:
                continue
            # Get the latest file version from VPS
            file_entry = None
            if t.get("vps_file_id"):
                file_entry = vps_matcher.get_file_entry(t["vps_id"], t["vps_file_id"])
            if not file_entry:
                file_entry = vps_matcher._get_latest_table(entry.get("tableFiles", []))
            if not file_entry:
                continue
            latest_version = (file_entry.get("version") or "").strip()
            if latest_version and latest_version != stored_version:
                updates_available += 1
    except Exception:
        pass  # Don't break stats if VPS comparison fails

    return {
        "total_tables": total,
        "vps_matched": matched,
        "vps_unmatched": unmatched,
        "missing_media": missing_media_count,
        "vbs_extracted": vbs_extracted,
        "vbs_patched": vbs_patched,
        "updates_available": updates_available,
    }


@router.get("/unmatched")
async def get_unmatched():
    """List tables not matched to VPS."""
    tables = await db.get_tables(vps_matched=False, limit=500)
    return {"tables": tables, "total": len(tables)}


@router.get("/{table_id}")
async def get_table(table_id: int):
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    media = await db.get_media_for_table(table_id)
    table["media"] = media

    # Check for updates if VPS matched
    if table.get("vps_id"):
        from backend.services.vps_matcher import vps_matcher

        entry = vps_matcher.get_entry(table["vps_id"])
        if entry:
            file_entry = None
            if table.get("vps_file_id"):
                file_entry = vps_matcher.get_file_entry(
                    table["vps_id"], table["vps_file_id"]
                )

            if not file_entry:
                file_entry = vps_matcher._get_latest_table(entry.get("tableFiles", []))

            table["latest_vps_version"] = file_entry.get("version", "")
            table["vps_file_url"] = (
                (file_entry.get("urls") or [{}])[0].get("url", "")
                if file_entry.get("urls")
                else ""
            )

            # Global latest (Community)
            community_entry = vps_matcher._get_latest_table(entry.get("tableFiles", []))
            table["community_vps_version"] = community_entry.get("version", "")
            table["community_vps_author"] = (
                community_entry.get("authors", [""])[0]
                if community_entry.get("authors")
                else ""
            )
            table["community_vps_url"] = (
                (community_entry.get("urls") or [{}])[0].get("url", "")
                if community_entry.get("urls")
                else ""
            )
            table["community_vps_file_id"] = community_entry.get("id", "")
            table["is_community_newer"] = community_entry.get("id") != file_entry.get(
                "id"
            )

    # Enrich with Gamelist metadata (rating, desc)
    try:
        folder_name = Path(table["folder_path"]).name
        rom_path = f"./{folder_name}/{table['filename']}"
        gm = GamelistManager(str(config.get_gamelist_xml_path()))
        game_meta = gm.get_game(rom_path)
        if game_meta:
            # Database-First logic: only overwrite if XML has 'better' data
            # Rating: Only overwrite if XML rating is > 0
            if game_meta.get("rating"):
                try:
                    # if xml_rating_float > 0:
                    #     # Map ES-DE (0.0-1.0) back to stars (0-5)
                    #     table["rating"] = int(xml_rating_float * 5)
                    #     logger.debug(f"Enriched rating from XML for {table_id}: {table['rating']} stars")
                    pass
                except (ValueError, TypeError):
                    pass

            # Description: Only overwrite if DB is empty or XML is significantly different
            xml_desc = game_meta.get("desc")
            if xml_desc and len(xml_desc.strip()) > 0:
                current_notes = table.get("notes") or ""
                if not current_notes or len(xml_desc) > len(current_notes):
                    table["notes"] = xml_desc
                    logger.debug(f"Enriched notes from XML for {table_id}")
    except Exception as e:
        logger.warning(f"Failed to load gamelist meta for {table_id}: {e}")

    return table


@router.get("/{table_id}/analyze")
async def analyze_table(table_id: int):
    """Analyze an existing table file to find available patches and NVRAMs."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.get("folder_path") or not table.get("filename"):
        raise HTTPException(status_code=400, detail="Table file information missing")

    from backend.services.vbs_manager import vbs_manager
    from backend.services.vps_matcher import vps_matcher
    from backend.services.vpx_parser import VPXParser

    table_path = Path(table["folder_path"]) / table["filename"]
    if not table_path.exists():
        raise HTTPException(status_code=404, detail="Physical table file not found")

    # 1. ROMs via VPXParser
    rom_info = VPXParser.process_vpx_table(
        str(table_path), extract_sidecar=False, vps_id=table.get("vps_id")
    )

    # 2. NVRAM search in master repo
    nvram_repo_dir = Path(config.support_dir) / "nvrams"
    matched_nvram = []
    if nvram_repo_dir.exists():
        all_repo_files = {
            f.name.lower(): f.name for f in nvram_repo_dir.rglob("*.nv") if f.is_file()
        }
        for rom_obj in rom_info:
            rom_name = rom_obj.get("version") if isinstance(rom_obj, dict) else rom_obj
            if not rom_name:
                continue
            nv_key = f"{rom_name.lower()}.nv"
            if nv_key in all_repo_files:
                matched_nvram.append(all_repo_files[nv_key])

    # 3. VBS Patch check
    patch_info = None
    # We use a temporary extraction to avoid cluttering the table folder
    extract_result = await vbs_manager.extract_vbs(table_path)
    if extract_result.get("success"):
        vbs_sidecar = table_path.with_suffix(".vbs")
        if vbs_sidecar.exists():
            vbs_hash = vbs_manager.calculate_vbs_hash(vbs_sidecar)
            if vbs_hash:
                hashes = await vbs_manager.get_patch_hashes()
                # Find original hash match
                patch_entry = next(
                    (item for item in hashes if item.get("sha256") == vbs_hash), None
                )
                if patch_entry and patch_entry.get("patched", {}).get("url"):
                    patch_info = {
                        "vbs_hash": vbs_hash,
                        "patch_url": patch_entry["patched"]["url"],
                    }
            try:
                vbs_sidecar.unlink()  # Cleanup temporary extraction
            except Exception:
                pass

    # 4. AltColors via VPS (if vps_id known)
    altcolors = []
    if table.get("vps_id"):
        altcolors = vps_matcher.get_altcolors_by_vps_id(table["vps_id"])

    return {
        "success": True,
        "roms": rom_info,
        "altcolors": altcolors,
        "nvram": matched_nvram,
        "patch_info": patch_info,
    }


@router.post("/{table_id}/export-mobile")
async def export_to_mobile(table_id: int):
    """Package the table and its ROMs into a .vpxz file for mobile."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    folder_path = table.get("folder_path")
    if not folder_path or not Path(folder_path).exists():
        raise HTTPException(status_code=400, detail="Table folder not found")

    table_dir = Path(folder_path)

    # "Delete on Next Run" strategy - clean up any existing .vpxz files first
    mobile_builds_dir = APP_SUPPORT_DIR / "Mobile Builds"
    mobile_builds_dir.mkdir(parents=True, exist_ok=True)

    for old_file in mobile_builds_dir.glob("*.vpxz"):
        try:
            old_file.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete old mobile export {old_file}: {e}")

    # Create a temporary directory structure for this package
    temp_dir = mobile_builds_dir / f"temp_{table_id}"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)

    try:
        temp_dir.mkdir()
        temp_table_dir = temp_dir / "table"

        # We copy the entire table folder into /table/ to get table file and any direct dependencies (B2S, altcolor, etc.)
        shutil.copytree(table_dir, temp_table_dir)

        # Create /pinmame/roms/ if needed
        roms_dir = temp_dir / "pinmame" / "roms"

        # VPX mobile requires ROM zips to be in /pinmame/roms/
        # Move any .zip files from temp_table_dir to roms_dir
        moved_roms = False
        for zip_file in temp_table_dir.glob("*.zip"):
            if not moved_roms:
                roms_dir.mkdir(parents=True, exist_ok=True)
                moved_roms = True
            shutil.move(str(zip_file), str(roms_dir / zip_file.name))

        # Create zip archive
        safe_name = "".join(
            c
            for c in table.get("display_name", f"table_{table_id}")
            if c.isalnum() or c in " _-"
        ).strip()
        if not safe_name:
            safe_name = f"table_{table_id}"

        archive_base = str(mobile_builds_dir / safe_name)

        # shutil.make_archive adds .zip automatically
        zip_path = shutil.make_archive(archive_base, "zip", str(temp_dir))

        # Rename .zip to .vpxz
        vpxz_path = Path(zip_path).with_suffix(".vpxz")
        if vpxz_path.exists():
            vpxz_path.unlink()

        Path(zip_path).rename(vpxz_path)

        return {
            "success": True,
            "filename": vpxz_path.name,
            "size": vpxz_path.stat().st_size,
        }
    finally:
        # Clean up the temp directory after creating the archive
        if temp_dir.exists():
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up temp directory {temp_dir}: {e}")


@router.post("/{table_id}/launch")
async def launch_table(table_id: int):
    """Launch the table via the standalone app."""
    import subprocess
    from pathlib import Path

    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.get("folder_path") or not table.get("filename"):
        raise HTTPException(status_code=400, detail="Table path missing")

    # Expand ~ in paths
    folder_path = Path(table["folder_path"]).expanduser()
    table_path = (folder_path / table["filename"]).resolve()

    logger.debug(f"Resolved table path: {table_path}")

    if not table_path.exists():
        logger.error(f"Table file not found: {table_path}")
        raise HTTPException(
            status_code=404, detail=f"Table file not found: {table_path}"
        )

    if table_path.suffix.lower() != ".vpx":
        logger.error(f"Invalid table file type: {table_path}")
        raise HTTPException(
            status_code=400, detail="Table file must have a .vpx extension"
        )

    app_path = os.path.expanduser(config.vpx_standalone_app_path)

    # Try to resolve executable if it's a macOS app bundle
    exec_path = app_path
    if app_path.endswith(".app"):
        app_name = Path(app_path).name.replace(".app", "")
        mac_os_path = Path(app_path) / "Contents" / "MacOS"

        if (mac_os_path / app_name).exists():
            exec_path = str(mac_os_path / app_name)
        elif (mac_os_path / "VPinballX").exists():
            exec_path = str(mac_os_path / "VPinballX")
        elif (mac_os_path / "vpinballx").exists():
            exec_path = str(mac_os_path / "vpinballx")
        elif mac_os_path.exists():
            files = [f for f in mac_os_path.iterdir() if f.is_file()]
            if files:
                exec_path = str(files[0])

    try:
        if app_path.endswith(".app") and not os.path.exists(exec_path):
            cmd = ["open", "-a", app_path, "--args", "-play", str(table_path)]
            if getattr(config, "vpx_display_mode", "Desktop") == "Desktop":
                cmd.append("-EnableTrueFullscreen")
            logger.info(f"Launching via 'open': {' '.join(cmd)}")
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        else:
            cmd = [exec_path, "-play", str(table_path)]
            if getattr(config, "vpx_display_mode", "Desktop") == "Desktop":
                cmd.append("-EnableTrueFullscreen")
            logger.info(f"Launching via binary: {' '.join(cmd)}")
            subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )

        return {"success": True, "message": "Launched successfully"}
    except Exception as e:
        logger.error(f"Failed to launch table: {e}")
        return {"success": False, "error": str(e)}


@router.post("/{table_id}/ignore")
async def ignore_version(table_id: int, req: IgnoreRequest):
    """Snooze alerts for a specific version."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    await db.upsert_table(
        {"filename": table["filename"], "ignored_version": req.version}
    )
    return {"success": True}


@router.get("/{table_id}/inventory")
async def get_table_inventory(table_id: int):
    """Scan the table folder and return a map of existing file categories."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    if not table_dir.exists():
        return {"exists": False, "error": "Folder not found"}

    def get_files(path: Path, glob: str) -> list[str]:
        if not path.exists():
            return []
        return [f.name for f in path.glob(glob) if not f.name.startswith(".")]

    inventory = {
        "vpx": get_files(table_dir, "*.vpx"),
        "backglass": get_files(table_dir, "*.directb2s"),
        "vbs": get_files(table_dir, "*.vbs"),
        "ini": get_files(table_dir, "*.ini"),
        "rom": get_files(table_dir / "pinmame" / "roms", "*.zip"),
        "puppack": (
            [d.name for d in (table_dir / "pupvideos").iterdir() if d.is_dir()]
            if (table_dir / "pupvideos").exists()
            else []
        ),
        "music": (
            [
                f.name
                for f in (table_dir / "music").iterdir()
                if not f.name.startswith(".")
            ]
            if (table_dir / "music").exists()
            else []
        ),
        "altsound": (
            [
                f.name
                for f in (table_dir / "pinmame" / "altsound").iterdir()
                if not f.name.startswith(".")
            ]
            if (table_dir / "pinmame" / "altsound").exists()
            else []
        ),
        "altcolor": (
            [
                f.name
                for f in (table_dir / "pinmame" / "altcolor").iterdir()
                if not f.name.startswith(".")
            ]
            if (table_dir / "pinmame" / "altcolor").exists()
            else []
        ),
        "medias": get_files(table_dir / "medias", "*.*"),
    }

    return {"exists": True, "inventory": inventory}


@router.put("/{table_id}")
async def update_table(table_id: int, update: TableUpdate):
    existing = await db.get_table(table_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Table not found")

    data = {"filename": existing["filename"]}
    update_dict = update.model_dump(exclude_none=True)

    # Check if a rename trigger field has changed
    needs_rename = False
    for field in ["display_name", "manufacturer", "year"]:
        if field in update_dict and update_dict[field] != existing.get(field):
            needs_rename = True
            break

    # We want to ensure rating and notes are always in data if they are in update
    # even if they are 0 or empty string.
    data.update(update_dict)

    # Upsert table updates DB (we need the new metadata in DB before renaming)
    await db.upsert_table(data)

    # Sync with gamelist.xml
    try:
        # Resolve folder name from physical path to ensure XML matching
        folder_name = Path(existing["folder_path"]).name
        rom_path = f"./{folder_name}/{existing['filename']}"
        gm = GamelistManager(str(config.get_gamelist_xml_path()))

        xml_meta = {}
        if update.display_name:
            xml_meta["display_name"] = update.display_name
        if update.manufacturer:
            xml_meta["manufacturer"] = update.manufacturer
            xml_meta["publisher"] = update.manufacturer
            xml_meta["genre"] = update.manufacturer
        if update.year:
            xml_meta["year"] = str(update.year)
        if update.players:
            xml_meta["players"] = str(update.players)

        # Map stars (0-5) to ES-DE rating (0.0-1.0)
        if update.rating is not None:
            xml_meta["rating"] = round(update.rating / 5.0, 2)

        # Map notes to ES-DE description
        if update.notes is not None:
            xml_meta["desc"] = update.notes

        if xml_meta:
            logger.info(
                f"Syncing {len(xml_meta)} fields to gamelist.xml for {rom_path}"
            )
            logger.debug(f"Sync payload: {xml_meta}")
            gm.update_game(rom_path, xml_meta)

    except Exception as e:
        logger.error(f"Failed to sync gamelist.xml for {table_id}: {e}")

    if needs_rename:
        from backend.services.table_file_service import TableFileService

        rename_result = await TableFileService.standardize_names(table_id)
        if not rename_result.get("success"):
            logger.error(
                f"Failed to automatically rename table files: {rename_result.get('error')}"
            )

    return await db.get_table(table_id)


@router.delete("/{table_id}")
async def delete_table(table_id: int, delete_files: bool = False):
    existing = await db.get_table(table_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Table not found")

    if delete_files:
        from pathlib import Path

        # 1. Folder deletion
        if existing["folder_path"]:
            folder = Path(existing["folder_path"])
            if folder.exists() and folder.is_dir():
                try:
                    shutil.rmtree(folder)
                    logger.info(f"Deleted folder: {folder}")
                except Exception as e:
                    logger.error(f"Failed to delete folder {folder}: {e}")

        # 2. Global media cleanup
        from backend.services.media_manager import delete_all_media_for_table

        if existing["filename"]:
            await delete_all_media_for_table(existing["filename"], existing["folder_path"])

        # 3. gamelist.xml cleanup
        # Calculate relative path: ./Folder Name/GameName.vpx
        if existing["folder_path"] and existing["filename"]:
            folder_name = Path(existing["folder_path"]).name
            rom_path = f"./{folder_name}/{existing['filename']}"
            try:
                gm = GamelistManager(str(config.get_gamelist_xml_path()))
                gm.remove_game(rom_path)
            except Exception as e:
                logger.error(f"Failed to remove {rom_path} from gamelist.xml: {e}")

    await db.delete_table(table_id)
    return {"success": True, "message": f"Deleted {existing['display_name']}"}


@router.delete("/{table_id}/files")
async def delete_table_file(table_id: int, path: str = Query(...)):
    """
    Delete a specific file or subfolder from a table's directory.
    'path' is relative to the table folder (e.g. 'pinmame/roms/old.zip').
    """
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    table_dir = Path(table["folder_path"])
    target = (table_dir / path).resolve()

    # Security: ensure target is within table_dir
    if not target.is_relative_to(table_dir):
        raise HTTPException(status_code=403, detail="Invalid path")

    if not target.exists():
        return {"success": True, "message": "File already gone"}

    try:
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

        # Update DB flags if necessary
        if path.endswith(".directb2s") or "backglass" in path:
            # Check if any other b2s remain
            has_b2s = any(table_dir.glob("*.directb2s"))
            await db.upsert_table({"id": table_id, "has_b2s": 1 if has_b2s else 0})
        elif "pinmame/roms" in path:
            has_rom = any((table_dir / "pinmame" / "roms").glob("*.zip"))
            await db.upsert_table({"id": table_id, "has_rom": 1 if has_rom else 0})

        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from backend.services.task_registry import task_registry


@router.post("/scan")
async def scan_tables(background_tasks: BackgroundTasks):
    """Trigger a full scan of the tables directory in the background."""
    # Check if already running
    task = task_registry.get_task("scanner")
    if task.status == "running":
        return {"success": False, "message": "Scan already in progress"}

    background_tasks.add_task(scan_tables_directory)
    return {"success": True, "message": "Scan started in background"}


@router.get("/scan/status")
async def get_scan_status():
    """Get the status of the current or last scan."""
    return task_registry.get_all_statuses().get("scanner", {"status": "idle"})


@router.get("/downloads/{filename}")
async def download_mobile_export(filename: str):
    # Define the mobile exports directory
    MOBILE_BUILDS_DIR = APP_SUPPORT_DIR / "Mobile Builds"

    # Sanitize filename to prevent path traversal
    safe_filename = filename.replace("/", "").replace("\\", "").replace("..", "")
    if not safe_filename.endswith(".vpxz"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    file_path = (MOBILE_BUILDS_DIR / safe_filename).resolve()

    # Security check
    if not file_path.is_relative_to(MOBILE_BUILDS_DIR) or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Standard FileResponse works for Safari/Firefox and serves as the source for the Chrome Blob sidepath
    return FileResponse(
        path=file_path, filename=safe_filename, media_type="application/zip"
    )


@router.post("/reveal-builds")
async def reveal_builds_folder():
    """Open the Mobile Builds folder in Finder (macOS)."""
    import subprocess

    mobile_builds_dir = APP_SUPPORT_DIR / "Mobile Builds"
    mobile_builds_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Reveal in Finder requested for: {mobile_builds_dir}")

    try:
        import sys
        # Use Popen to avoid blocking the API while Finder/File Manager opens
        logger.info("Executing 'open' command...")

        if sys.platform == "darwin":
            subprocess.Popen(["open", str(mobile_builds_dir)])
        elif sys.platform == "linux":
            subprocess.Popen(["xdg-open", str(mobile_builds_dir)])

        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to open builds folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))
