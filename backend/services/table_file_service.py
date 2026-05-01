from __future__ import annotations

import logging
import os
from pathlib import Path

import backend.core.database as db
from backend.core.config import config
from backend.services.gamelist_manager import GamelistManager

logger = logging.getLogger(__name__)


class TableFileService:
    @staticmethod
    def get_standard_name(name: str, manufacturer: str = "", year: str = "") -> str:
        """Build a standardized name: 'Name (Manufacturer Year)'."""
        if manufacturer and year:
            base = f"{name} ({manufacturer} {year})"
        elif manufacturer:
            base = f"{name} ({manufacturer})"
        elif year:
            base = f"{name} ({year})"
        else:
            base = name

        # Sanitize folder name: remove characters that are invalid in folder names
        return "".join(c for c in base if c not in '<>:"/\\|?*').strip()

    @staticmethod
    async def standardize_names(table_id: int) -> dict:
        """
        Renames a table's folder and files to match standardized VPS metadata.
        Returns a dict indicating success and any renames performed.
        """
        table = await db.get_table(table_id)
        if not table:
            return {"success": False, "error": "Table not found"}

        old_folder_path = Path(table["folder_path"])
        old_vpx_filename = table["filename"]

        if not old_folder_path.exists():
            return {"success": False, "error": f"Folder not found: {old_folder_path}"}

        # 1. Build new base name
        standard_base = TableFileService.get_standard_name(
            table["display_name"], table["manufacturer"], table["year"]
        )
        new_vpx_filename = f"{standard_base}.vpx"
        new_folder_name = standard_base
        new_folder_parent = old_folder_path.parent
        new_folder_path = new_folder_parent / new_folder_name

        results = {"success": True, "renames": []}

        # 2. Rename files INSIDE the folder first
        # We find any files starting with the current filename stem
        old_stem = Path(old_vpx_filename).stem
        for file in old_folder_path.glob("*"):
            if file.is_dir():
                continue

            if file.stem == old_stem:
                # This matches our primary file or a sidecar (e.g. .directb2s)
                new_file = file.parent / f"{standard_base}{file.suffix}"
                if file != new_file:
                    if new_file.exists():
                        logger.warning(f"Skipping rename, target exists: {new_file}")
                        continue
                    file.rename(new_file)
                    results["renames"].append({"old": file.name, "new": new_file.name})

        # 3. Rename the FOLDER itself if necessary
        # Special case: if we are inside the folder we are renaming, this might fail on some OS.
        if old_folder_path.name != new_folder_name:
            if new_folder_path.exists():
                logger.error(
                    f"Cannot rename folder, target already exists: {new_folder_path}"
                )
                # We still update the DB for the files we successfully renamed inside though
            else:
                try:
                    old_folder_path.rename(new_folder_path)
                    results["renames"].append(
                        {"old": old_folder_path.name, "new": new_folder_path.name}
                    )
                    # Use new folder path for DB update
                except Exception as e:
                    logger.error(f"Folder rename failed: {e}")
                    new_folder_path = (
                        old_folder_path  # Stay with old path if rename failed
                    )

        # 4. Update Database
        await db.upsert_table(
            {
                "id": table_id,
                "filename": new_vpx_filename,
                "folder_path": str(new_folder_path),
            }
        )

        # 5. Update gamelist.xml (ES-DE)
        # We need relative paths for gamelist.xml
        # Assuming gamelist entries look like: ./Folder/File.vpx
        try:
            gm = GamelistManager(str(config.get_gamelist_xml_path()))
            old_rel = f"./{old_folder_path.name}/{old_vpx_filename}"
            new_rel = f"./{new_folder_path.name}/{new_vpx_filename}"
            if old_rel != new_rel:
                gm.rename_game(old_rel, new_rel)
        except Exception as e:
            logger.error(f"Failed to update gamelist.xml: {e}")

        # 6. Update global media assets (ES-DE folders)
        # We rename any files in /images, /videos, /manuals that start with the old stem
        try:
            from backend.services.media_manager import ESDE_EXTENSIONS

            esde_base = config.expanded_tables_dir
            categories = ["images", "videos", "manuals"]

            for cat in categories:
                cat_dir = esde_base / cat
                if not cat_dir.exists():
                    continue

                # Suffixes often used in ES-DE (plus plain)
                possible_suffixes = [
                    "",
                    "-image",
                    "-marquee",
                    "-fanart",
                    "-video",
                    "-manual",
                ]

                for suf in possible_suffixes:
                    for ext in ESDE_EXTENSIONS.get(cat, []):
                        old_media = cat_dir / f"{old_stem}{suf}{ext}"
                        if old_media.exists():
                            new_media = cat_dir / f"{standard_base}{suf}{ext}"
                            if not new_media.exists():
                                old_media.rename(new_media)
                                results["renames"].append(
                                    {
                                        "old": f"{cat}/{old_media.name}",
                                        "new": new_media.name,
                                    }
                                )
        except Exception as e:
            logger.error(f"Failed to rename global media assets: {e}")

        return results
