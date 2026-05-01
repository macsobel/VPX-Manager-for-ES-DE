from __future__ import annotations

"""
Media manager service.
Unified around ES-DE downloaded_media standard.
Stores and tracks media in ESDE downloaded_media folders:
  fanart, covers, manuals, marquees, screenshots, videos
"""
import os
import shutil
from pathlib import Path

import backend.core.database as db
from backend.core.config import config

# Standard ES-DE media categories for status tracking
ESDE_STATUS_TYPES = ["fanart", "covers", "manuals", "marquees", "screenshots", "videos"]

# Extensions by category
ESDE_EXTENSIONS = {
    "images": [".png", ".jpg", ".jpeg", ".webp"],
    "videos": [".mp4", ".mkv", ".avi", ".webm"],
    "manuals": [".pdf"],
}


async def get_media_status(table_id: int) -> dict:
    """
    Get media completeness status for a table (ES-DE focused).
    Unified replacement for legacy status checks.
    """
    return await get_esde_media_status(table_id)


async def get_all_media_status() -> list[dict]:
    """Get ES-DE media status for all tables by scanning the file system."""
    # We query all tables first
    tables = await db.get_tables(limit=2000)
    results = []
    for t in tables:
        status = await get_esde_media_status(t["id"])
        status["display_name"] = t["display_name"]
        status["filename"] = t["filename"]
        status["vps_id"] = t.get("vps_id", "")
        results.append(status)
    return results


async def get_esde_media_status(table_id: int) -> dict:
    """
    Check ES-DE downloaded_media for existing assets using direct filename mapping.
    Source of truth for all media indicators.
    """
    esde_base = config.esde_media_base

    table = await db.get_table(table_id)
    if not table:
        return {
            "id": table_id,
            "existing_types": [],
            "missing_types": list(ESDE_STATUS_TYPES),
        }

    filename = table.get("filename", "")
    stem = Path(filename).stem if filename else ""

    existing = []
    missing = []

    if stem:
        folder_name = Path(table["folder_path"]).name
        for status_type in ESDE_STATUS_TYPES:
            found = False

            folder_path = esde_base / status_type
            if folder_path.exists():
                if status_type in ("videos",):
                    exts = ESDE_EXTENSIONS["videos"]
                elif status_type in ("manuals",):
                    exts = ESDE_EXTENSIONS["manuals"]
                else:
                    exts = ESDE_EXTENSIONS["images"]

                for ext in exts:
                    # Check root
                    if (folder_path / f"{stem}{ext}").exists():
                        found = True
                        break
                    # Check nested
                    if (
                        folder_name
                        and (folder_path / folder_name / f"{stem}{ext}").exists()
                    ):
                        found = True
                        break

            if found:
                existing.append(status_type)
            else:
                missing.append(status_type)

    return {
        "id": table_id,
        "existing_types": existing,
        "missing_types": missing,
    }


async def get_all_esde_media_status(table_ids: List[int]) -> List[dict]:
    """Get ES-DE media status for multiple tables at once."""
    results = []
    for tid in table_ids:
        results.append(await get_esde_media_status(tid))
    return results


async def get_media_file_path(table_id: int, media_type: str) -> Optional[Path]:
    """
    Find the exact path for a given table and ES-DE media type.
    Checks both root and nested ES-DE subfolders.
    """
    table = await db.get_table(table_id)
    if not table:
        return None

    filename = table.get("filename", "")
    stem = Path(filename).stem if filename else ""
    if not stem:
        return None

    esde_base = config.esde_media_base
    folder_path = esde_base / media_type

    if not folder_path.exists():
        return None

    if media_type in ("videos",):
        exts = ESDE_EXTENSIONS["videos"]
    elif media_type in ("manuals",):
        exts = ESDE_EXTENSIONS["manuals"]
    else:
        exts = ESDE_EXTENSIONS["images"]

    # 1. Check Root Path (Folder representation)
    for ext in exts:
        path = folder_path / f"{stem}{ext}"
        if path.exists():
            return path

    # 2. Check Nested Path (Game representation)
    folder_name = Path(table["folder_path"]).name
    if folder_name:
        for ext in exts:
            path = folder_path / folder_name / f"{stem}{ext}"
            if path.exists():
                return path

    return None


async def delete_media_file(table_id: int, media_type: str) -> dict:
    """
    Delete a specific ES-DE media file and its database record.
    Ensures both root and nested paths are cleaned up.
    """
    table = await db.get_table(table_id)
    if not table:
        return {"success": False, "error": "Table not found"}

    filename = table.get("filename", "")
    stem = Path(filename).stem if filename else ""
    folder_name = Path(table["folder_path"]).name if table.get("folder_path") else ""

    # 1. Delete from database
    try:
        conn = await db.get_db()
        await conn.execute(
            "DELETE FROM media WHERE table_id = ? AND media_type = ?",
            (table_id, media_type),
        )
        await conn.commit()
    except Exception as db_err:
        import logging
        logging.getLogger(__name__).error(f"Failed to delete DB record for media: {db_err}")

    # 2. Delete from physical storage (All potential paths)
    esde_base = config.esde_media_base
    folder_path = esde_base / media_type
    
    deleted_paths = []
    if stem and folder_path.exists():
        if media_type == "videos":
            exts = ESDE_EXTENSIONS["videos"]
        elif media_type == "manuals":
            exts = ESDE_EXTENSIONS["manuals"]
        else:
            exts = ESDE_EXTENSIONS["images"]

        for ext in exts:
            # Root path
            p1 = folder_path / f"{stem}{ext}"
            if p1.exists():
                p1.unlink()
                deleted_paths.append(str(p1))
            
            # Nested path
            if folder_name:
                p2 = folder_path / folder_name / f"{stem}{ext}"
                if p2.exists():
                    p2.unlink()
                    deleted_paths.append(str(p2))

        # Cleanup nested folder if it's now empty
        if folder_name:
            nested_dir = folder_path / folder_name
            if nested_dir.exists() and nested_dir.is_dir():
                try:
                    # Check if directory is empty (ignoring .DS_Store etc if possible, but simple check first)
                    if not any(nested_dir.iterdir()):
                        nested_dir.rmdir()
                        import logging
                        logging.getLogger(__name__).info(f"Deleted empty nested media folder: {nested_dir}")
                except Exception:
                    pass # Directory not empty or permission error

    return {
        "success": True,
        "message": f"Deleted {len(deleted_paths)} file(s) and removed database record",
    }


async def rotate_media(table_id: int, media_type: str, angle: int) -> dict:
    """
    Rotate a media file and update all physical instances (dual-path).
    """
    from backend.services.media_processor import rotate_image

    table = await db.get_table(table_id)
    if not table:
        return {"success": False, "error": "Table not found"}

    file_path = await get_media_file_path(table_id, media_type)
    if not file_path or not file_path.exists():
        return {"success": False, "error": "Media file not found"}

    try:
        # Rotate the primary file
        if media_type == "videos" or str(file_path).lower().endswith(".mp4"):
            from backend.services.media_processor import rotate_video_metadata_manual

            rotate_video_metadata_manual(str(file_path), angle)
        else:
            rotate_image(str(file_path), angle)

        # Re-apply dual-path synchronization
        game_stem = Path(table["filename"]).stem
        folder_name = Path(table["folder_path"]).name

        media_base = config.esde_media_base

        await save_media_dual(
            media_base=media_base,
            media_type=media_type,
            folder_name=folder_name,
            game_stem=game_stem,
            ext=file_path.suffix,
            source_path=file_path,
        )

        return {"success": True, "message": f"Media rotated {angle} degrees"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def delete_all_media_for_table(table_filename: str, folder_path: str = None) -> None:
    """
    Deletes all global ES-DE media associated with a table filename.
    Ensures both root files and nested folders are removed.
    """
    table_stem = Path(table_filename).stem
    folder_name = Path(folder_path).name if folder_path else ""
    media_base = config.esde_media_base
    import logging
    import shutil

    logger = logging.getLogger(__name__)

    for sub in ESDE_STATUS_TYPES:
        media_dir = media_base / sub
        if not media_dir.exists():
            continue

        # 1. Delete root files matching stem
        for file_path in media_dir.glob(f"{table_stem}.*"):
            try:
                file_path.unlink()
                logger.info(f"Deleted global media (root-stem): {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete global media {file_path}: {e}")

        # 2. Delete root files matching folder_name (ES-DE folder representation)
        if folder_name:
            for file_path in media_dir.glob(f"{folder_name}.*"):
                try:
                    file_path.unlink()
                    logger.info(f"Deleted global media (root-folder): {file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete global media {file_path}: {e}")

        # 3. Delete nested folder matching table's folder name
        if folder_name:
            nested_dir = media_dir / folder_name
            if nested_dir.exists() and nested_dir.is_dir():
                try:
                    shutil.rmtree(nested_dir)
                    logger.info(f"Deleted global media (nested folder): {nested_dir}")
                except Exception as e:
                    logger.error(f"Failed to delete nested media folder {nested_dir}: {e}")


async def delete_all_media_by_id(table_id: int) -> dict:
    """Helper to delete all media for a table ID."""
    table = await db.get_table(table_id)
    if not table:
        return {"success": False, "error": "Table not found"}

    filename = table.get("filename", "")
    if not filename:
        return {"success": False, "error": "Table has no filename"}

    await delete_all_media_for_table(filename, table.get("folder_path"))
    return {
        "success": True,
        "message": f"Deleted all media for {table.get('display_name')}",
    }


async def save_uploaded_media(
    table_id: int, media_type: str, filename: str, content: bytes
) -> dict:
    """
    Save an uploaded media file to the ES-DE global folders with dual-path duplication.
    """
    table = await db.get_table(table_id)
    if not table:
        return {"success": False, "error": "Table not found"}

    if media_type not in ESDE_STATUS_TYPES:
        return {"success": False, "error": f"Invalid ES-DE media type: {media_type}"}

    # Extract naming info
    ext = Path(filename).suffix.lower()
    game_stem = Path(table["filename"]).stem
    folder_name = Path(table["folder_path"]).name

    # Determine base directory
    media_base = config.esde_media_base

    target_dir = media_base / media_type
    target_dir.mkdir(parents=True, exist_ok=True)

    # Path 1: Root level (for Folder)
    path_folder = target_dir / f"{folder_name}{ext}"

    # Path 2: Nested level (for Game)
    path_game_dir = target_dir / folder_name
    path_game_dir.mkdir(parents=True, exist_ok=True)
    path_game = path_game_dir / f"{game_stem}{ext}"

    try:
        # Write primary file
        with open(path_folder, "wb") as f:
            f.write(content)

        # Duplicate to secondary path
        shutil.copy2(path_folder, path_game)

        # Sync with gamelist.xml (using the nested path as primary for the game entry)
        try:
            from backend.services.gamelist_manager import GamelistManager

            gm = GamelistManager(str(config.get_gamelist_xml_path()))

            tag_map = {
                "covers": "image",
                "screenshots": "thumbnail",
                "fanart": "fanart",
                "marquees": "marquee",
                "videos": "video",
                "manuals": "manual",
            }
            tag = tag_map.get(media_type)
            if tag:
                # Always use the nested path for the <game> entry in XML
                if config.media_storage_mode == "portable":
                    rel_xml_path = f"./media/{media_type}/{folder_name}{ext}"
                else:
                    rel_xml_path = str(path_game).replace("\\", "/")

                rom_rel_path = f"./{folder_name}/{table['filename']}"
                gm.update_game(rom_rel_path, {tag: rel_xml_path})
        except Exception as e:
            import logging

            logging.getLogger(__name__).error(
                f"Failed to sync gamelist.xml on upload: {e}"
            )

        return {
            "success": True,
            "path": str(path_folder),
            "game_path": str(path_game),
            "media_type": media_type,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def save_media_dual(
    media_base: Path,
    media_type: str,
    folder_name: str,
    game_stem: str,
    ext: str,
    source_path: Path,
) -> list[Path]:
    """
    Helper to ensure a media file exists in both ES-DE required locations for nested tables.
    Used by scraper and media processor after initial download/edit.
    """
    target_dir = media_base / media_type
    target_dir.mkdir(parents=True, exist_ok=True)

    # Path 1: Root level (for Folder representation)
    path_folder = target_dir / f"{folder_name}{ext}"

    # Path 2: Nested level (for Game representation)
    path_game_dir = target_dir / folder_name
    path_game_dir.mkdir(parents=True, exist_ok=True)
    path_game = path_game_dir / f"{game_stem}{ext}"

    # Check if source is already one of the targets (using samefile for casing-insensitive comparison)
    is_path_folder = False
    is_path_game = False

    try:
        if (
            source_path.exists()
            and path_folder.exists()
            and os.path.samefile(source_path, path_folder)
        ):
            is_path_folder = True
    except (OSError, ValueError):
        pass

    try:
        if (
            source_path.exists()
            and path_game.exists()
            and os.path.samefile(source_path, path_game)
        ):
            is_path_game = True
    except (OSError, ValueError):
        pass

    if is_path_folder:
        # Source is Path 1, just refresh Path 2
        shutil.copy2(path_folder, path_game)
    elif is_path_game:
        # Source is Path 2, just refresh Path 1
        shutil.copy2(path_game, path_folder)
    else:
        # Source is elsewhere (temp dir or a different file), move to Path 1 then copy to Path 2
        if path_folder.exists():
            path_folder.unlink()
        shutil.move(str(source_path), str(path_folder))
        shutil.copy2(path_folder, path_game)

    return [path_folder, path_game]


async def migrate_media_strategy(target_mode: str):
    """
    Migrate media files physically between ES-DE Global and Portable table folders.
    """
    from backend.core.config import load_config
    from backend.services.gamelist_manager import GamelistManager
    from backend.services.task_registry import task_registry

    cfg = load_config()
    tables = await db.get_tables()
    total_tables = len(tables)

    task_registry.start_task(
        "media-migration", total=total_tables, message="Initializing mapping..."
    )

    global_esde = cfg.expanded_esde_media_dir
    tables_dir = cfg.expanded_tables_dir

    moved_count = 0

    try:
        if target_mode == "portable":
            # Move from Global -> Portable
            task_registry.update_progress(
                "media-migration", 0, "Moving to Portable Mode..."
            )
            for i, t in enumerate(tables):
                task_registry.update_progress(
                    "media-migration", i, f"Migrating ({i}/{total_tables})"
                )
                filename = t.get("filename", "")
                if not filename:
                    continue

                stem = Path(filename).stem

                for media_type in [
                    "covers",
                    "screenshots",
                    "fanart",
                    "marquees",
                    "videos",
                    "manuals",
                ]:
                    global_category_dir = global_esde / media_type
                    if not global_category_dir.exists():
                        continue

                    found_file = None
                    for ext in [".png", ".jpg", ".mp4", ".pdf"]:
                        check_path = global_category_dir / f"{stem}{ext}"
                        if check_path.exists():
                            found_file = check_path
                            break

                    if found_file:
                        # Move to portable
                        portable_dir = tables_dir / "media" / media_type
                        portable_dir.mkdir(parents=True, exist_ok=True)
                        dest_path = portable_dir / found_file.name

                        try:
                            shutil.move(str(found_file), str(dest_path))
                            moved_count += 1
                        except Exception as e:
                            import logging

                            logging.getLogger(__name__).error(
                                f"Failed to move {found_file} to {dest_path}: {e}"
                            )

        else:
            # Move from Portable -> Global (Standard)
            task_registry.update_progress(
                "media-migration", 0, "Moving to Standard Mode..."
            )
            for i, t in enumerate(tables):
                task_registry.update_progress(
                    "media-migration", i, f"Migrating ({i}/{total_tables})"
                )
                filename = t.get("filename", "")
                if not filename:
                    continue

                stem = Path(filename).stem
                portable_base_root = tables_dir / "media"
                portable_base_nested = tables_dir / Path(filename).parent / "media"

                for media_type in [
                    "covers",
                    "screenshots",
                    "fanart",
                    "marquees",
                    "videos",
                    "manuals",
                ]:

                    found_file = None
                    for ext in [".png", ".jpg", ".mp4", ".pdf"]:
                        # Check root portable location first
                        check_path_root = portable_base_root / media_type / f"{stem}{ext}"
                        if check_path_root.exists():
                            found_file = check_path_root
                            break
                        
                        # Fallback to nested/buggy location
                        check_path_nested = portable_base_nested / media_type / f"{stem}{ext}"
                        if check_path_nested.exists():
                            found_file = check_path_nested
                            break

                    if found_file:
                        global_category_dir = global_esde / media_type
                        global_category_dir.mkdir(parents=True, exist_ok=True)
                        dest_path = global_category_dir / found_file.name

                        try:
                            shutil.move(str(found_file), str(dest_path))
                            moved_count += 1
                        except Exception as e:
                            import logging

                            logging.getLogger(__name__).error(
                                f"Failed to move {found_file} to {dest_path}: {e}"
                            )

        # Rewrite XML paths for all tables using the configured gamelist path
        gm = GamelistManager(str(cfg.get_gamelist_xml_path()))

        old_xml = cfg.expanded_tables_dir / "gamelist.xml"
        new_xml = cfg.get_gamelist_xml_path()

        if old_xml.exists() and old_xml != new_xml:
            try:
                new_xml.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(old_xml), str(new_xml))
            except Exception as e:
                import logging

                logging.getLogger(__name__).error(f"Failed to copy gamelist.xml: {e}")

        for t in tables:
            filename = t.get("filename", "")
            if not filename:
                continue

            from backend.services.media_manager import get_esde_media_status

            tag_map = {
                "covers": "image",
                "screenshots": "thumbnail",
                "fanart": "fanart",
                "marquees": "marquee",
                "videos": "video",
                "manuals": "manual",
            }

            esde_status = await get_esde_media_status(t["id"])
            existing = esde_status.get("existing_types", [])
            if not existing:
                continue

            xml_updates = {}
            for media_type in existing:
                tag = tag_map.get(media_type)
                if not tag:
                    continue

                ext = ".png"
                if media_type == "videos":
                    ext = ".mp4"
                elif media_type == "manuals":
                    ext = ".pdf"

                target_filename = f"{Path(filename).stem}{ext}"
                if target_mode == "portable":
                    rel_path = f"./media/{media_type}/{target_filename}"
                else:
                    global_category_dir = global_esde / media_type
                    rel_path = str(global_category_dir / target_filename).replace(
                        "\\", "/"
                    )

                xml_updates[tag] = rel_path

            gm.update_game(f"./{filename}", xml_updates)

        task_registry.complete_task(
            "media-migration", f"Completed: migrated {moved_count} files"
        )
        return {
            "success": True,
            "message": f"Migrated {moved_count} files successfully.",
        }
    except Exception as e:
        task_registry.fail_task("media-migration", str(e))
        return {"success": False, "error": str(e)}
