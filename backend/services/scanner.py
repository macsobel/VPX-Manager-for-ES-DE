from __future__ import annotations

"""
Filesystem scanner for VPX table directories.
Supports self-contained per-folder table layouts where each table folder
contains its own ROMs (pinmame/roms/), music, backglass, media, etc.

Expected structure (VPinFE convention):
  Tables/
  └── Table Name (Manufacturer Year)/
      ├── Table Name (Manufacturer Year) Author 1.0.vpx
      ├── Table Name (Manufacturer Year) Author 1.0.directb2s
      ├── Table Name (Manufacturer Year) Author 1.0.vbs
      ├── Table Name.info
      ├── medias/
      │   ├── wheel.png
      │   ├── bg.png
      │   ├── table.png
      │   ├── table.mp4
      │   ├── dmd.png
      │   ├── cab.png
      │   ├── audio.mp3
      │   ├── flyer.png
      │   └── realdmd.png
      ├── music/
      ├── pupvideos/
      └── pinmame/
          ├── roms/
          ├── altcolor/
          ├── altsound/
          ├── nvram/
          ├── ini/
          └── cfg/
"""
import logging
from pathlib import Path

import backend.core.database as db
from backend.core.config import config

logger = logging.getLogger(__name__)


# Standard media files in medias/ folder (VPinFE naming convention)
MEDIA_FILE_MAP = {
    "wheel": ["wheel"],
    "backglass": ["bg"],
    "playfield": ["table"],
    "table_video": ["table"],
    "dmd": ["dmd"],
    "cab": ["cab"],
    "audio": ["audio"],
    "flyer": ["flyer"],
    "realdmd": ["realdmd"],
}

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".avi"}
AUDIO_EXTS = {".mp3", ".ogg", ".wav"}


async def scan_tables_directory() -> dict:
    """
    Supports both:
      - Flat layout: all .vpx files in one directory
      - Per-folder layout: each table in its own subdirectory (preferred)

    Per-folder tables are self-contained — ROMs live inside
    <table_folder>/pinmame/roms/ and media in <table_folder>/medias/.

    Returns a summary dict.
    """
    tables_dir = config.expanded_tables_dir
    if not tables_dir.exists():
        tables_dir.mkdir(parents=True, exist_ok=True)
        return {"scanned": 0, "new": 0, "updated": 0, "errors": []}

    from backend.services.task_registry import task_registry

    new_count = 0
    updated_count = 0
    errors = []
    vpx_files = []

    # Collect all .vpx files recursively
    for sub in tables_dir.rglob("*.vpx"):
        if sub.is_file():
            vpx_files.append((sub, sub.parent))

    task_registry.start_task(
        "scanner", total=len(vpx_files), message="Scanning tables..."
    )

    try:
        existing_db = await db.get_db()
        try:
            cursor = await existing_db.execute(
                "SELECT id, filename, mtime, vps_id FROM tables"
            )
            rows = await cursor.fetchall()
            # Store existing info: {filename_lower: (id, mtime_in_db, vps_id)}
            existing_meta = {
                row["filename"].lower(): (row["id"], row["mtime"], row["vps_id"])
                for row in rows
            }
        finally:
            await existing_db.close()

        tables_to_upsert = []
        found_filenames = set(v[0].name.lower() for v in vpx_files)

        import asyncio

        semaphore = asyncio.Semaphore(10)  # Process up to 10 tables concurrently

        async def process_single_vpx(vpx_path, folder_path, idx):
            nonlocal new_count, updated_count
            async with semaphore:
                task_registry.update_progress(
                    "scanner", idx + 1, f"Scanning: {vpx_path.name}"
                )
                try:
                    # Check if we can skip parsing
                    current_mtime = str(vpx_path.stat().st_mtime)
                    existing_info = existing_meta.get(vpx_path.name.lower())

                    if existing_info and existing_info[1] == current_mtime:
                        return None

                    # Extract metadata from VPX file
                    from backend.services.vpx_parser import VPXParser

                    # These OLE operations are CPU/IO bound, but we can offload them
                    # Use a timeout to prevent hanging on malformed files
                    try:
                        meta = await asyncio.wait_for(
                            asyncio.to_thread(VPXParser.get_metadata, vpx_path),
                            timeout=30.0,
                        )
                        vbs_hash = await asyncio.wait_for(
                            asyncio.to_thread(VPXParser.get_vbs_hash, vpx_path),
                            timeout=30.0,
                        )
                    except asyncio.TimeoutError:
                        logger.error(f"Timeout scanning {vpx_path.name}")
                        errors.append(f"Timeout scanning {vpx_path.name}")
                        return None

                    stem = vpx_path.stem
                    # Check for matching .directb2s
                    b2s_candidates = [
                        folder_path / f"{stem}.directb2s",
                        vpx_path.parent / f"{stem}.directb2s",
                    ]
                    has_b2s = any(p.exists() for p in b2s_candidates)

                    # Check for ROMs
                    has_rom = False
                    rom_dirs = [folder_path / "pinmame" / "roms", folder_path / "roms"]
                    for rom_dir in rom_dirs:
                        if rom_dir.exists() and rom_dir.is_dir():
                            for rom in rom_dir.iterdir():
                                if rom.suffix.lower() == ".zip":
                                    has_rom = True
                                    break
                            if has_rom:
                                break

                    # Check for PUP Pack (must have a subfolder inside pupvideos)
                    pup_dir = folder_path / "pupvideos"
                    has_pup = (
                        pup_dir.exists()
                        and pup_dir.is_dir()
                        and any(d.is_dir() for d in pup_dir.iterdir())
                    )

                    # Check for AltColor
                    has_altcolor = False
                    altcolor_dirs = [
                        folder_path / "pinmame" / "altcolor",
                        folder_path / "altcolor",
                    ]
                    for d in altcolor_dirs:
                        if d.exists() and d.is_dir() and any(d.iterdir()):
                            has_altcolor = True
                            break

                    # Check for AltSound
                    has_altsound = False
                    altsound_dirs = [
                        folder_path / "pinmame" / "altsound",
                        folder_path / "altsound",
                    ]
                    for d in altsound_dirs:
                        if d.exists() and d.is_dir() and any(d.iterdir()):
                            has_altsound = True
                            break

                    # Check for Music
                    has_music = (
                        (folder_path / "music").exists()
                        and (folder_path / "music").is_dir()
                        and any((folder_path / "music").iterdir())
                    )

                    # Build display name
                    display_name = meta.get("display_name") or stem.replace(
                        "_", " "
                    ).replace("-", " ")
                    manufacturer = ""
                    year = ""
                    parts = display_name.split("(")
                    if len(parts) > 1:
                        meta_str = parts[-1].rstrip(")")
                        tokens = meta_str.split()
                        m_parts = []
                        for t in tokens:
                            if t.isdigit() and len(t) == 4:
                                year = t
                            else:
                                m_parts.append(t)
                        if m_parts:
                            manufacturer = " ".join(m_parts)

                    table_id = existing_info[0] if existing_info else None
                    vps_id = existing_info[2] if existing_info else None
                    table_data = {
                        "filename": vpx_path.name,
                        "version": meta["version"],
                        "author": meta["author"],
                        "has_b2s": 1 if has_b2s else 0,
                        "has_rom": 1 if has_rom else 0,
                        "has_pup": 1 if has_pup else 0,
                        "has_altcolor": 1 if has_altcolor else 0,
                        "has_altsound": 1 if has_altsound else 0,
                        "has_music": 1 if has_music else 0,
                        "folder_path": str(folder_path),
                        "vbs_hash": vbs_hash,
                        "mtime": current_mtime,
                    }

                    if not vps_id or vps_id == "":
                        table_data["display_name"] = display_name
                        table_data["manufacturer"] = manufacturer
                        table_data["year"] = year

                    if table_id:
                        table_data["id"] = table_id
                        updated_count += 1
                    else:
                        new_count += 1

                    return table_data

                except Exception as e:
                    errors.append(f"Error scanning {vpx_path.name}: {e}")
                    return None

        # Run all tasks concurrently
        tasks = [
            process_single_vpx(vpx_path, folder_path, i)
            for i, (vpx_path, folder_path) in enumerate(vpx_files)
        ]
        results = await asyncio.gather(*tasks)
        tables_to_upsert = [t for t in results if t is not None]

        # Perform batch upsert
        if tables_to_upsert:
            await db.upsert_tables_batch(tables_to_upsert)

            # Scanned medias (still individual for now, but we can batch this later if needed)
            # We need to get the IDs of new tables. Simplest is to reload existing_meta
            existing_db = await db.get_db()
            try:
                cursor = await existing_db.execute(
                    "SELECT id, filename, folder_path FROM tables"
                )
                all_rows = await cursor.fetchall()

                upserted_filenames = {t["filename"] for t in tables_to_upsert}
                for row in all_rows:
                    # Only scan if it was in our upsert list
                    if row["filename"] in upserted_filenames:
                        await _scan_medias_folder(row["id"], Path(row["folder_path"]))
            finally:
                await existing_db.close()

        # Identify orphans
        existing_db = await db.get_db()
        try:
            cursor = await existing_db.execute("SELECT id, filename FROM tables")
            all_existing = await cursor.fetchall()

            for row in all_existing:
                if row["filename"].lower() not in found_filenames:
                    # Need to delete this table!
                    from backend.services.gamelist_manager import GamelistManager
                    from backend.services.media_manager import \
                        delete_all_media_for_table

                    try:
                        gm = GamelistManager(str(config.get_gamelist_xml_path()))
                        rel_path = f"./{Path(row['folder_path']).name}/{row['filename']}"
                        gm.remove_game(rel_path)
                    except Exception:
                        pass
                    await delete_all_media_for_table(row["filename"])
                    await db.delete_table(row["id"])
        finally:
            await existing_db.close()

        summary = {
            "scanned": len(vpx_files),
            "new": new_count,
            "updated": updated_count,
            "errors": errors,
        }
        # NEW: Auto-match unmatched tables after scan
        from backend.services.vps_matcher import vps_matcher
        asyncio.create_task(vps_matcher.auto_match_all())

        task_registry.complete_task("scanner", f"Scanned {len(vpx_files)} tables", extra_data=summary)

    except Exception as e:
        import traceback

        error_msg = f"Scan failed: {str(e)}"
        try:
            logger.error(error_msg)
            logger.error(traceback.format_exc())
        except Exception:
            print(error_msg)
        task_registry.fail_task("scanner", error_msg)
        errors.append(error_msg)
        summary = {"errors": errors}

    return summary


async def _scan_medias_folder(table_id: int, folder_path: Path):
    """Scan the medias/ folder for a table's media files using VPinFE naming."""
    medias_dir = folder_path / "medias"
    if not medias_dir.exists():
        return

    for f in medias_dir.iterdir():
        if not f.is_file():
            continue

        stem = f.stem.lower()
        ext = f.suffix.lower()

        # Match against VPinFE naming convention
        for media_type, base_names in MEDIA_FILE_MAP.items():
            if stem not in base_names:
                continue

            # Validate extension matches the media type
            if media_type == "table_video" and ext in VIDEO_EXTS:
                await db.upsert_media(table_id, media_type, str(f))
            elif media_type == "audio" and ext in AUDIO_EXTS:
                await db.upsert_media(table_id, media_type, str(f))
            elif (
                media_type
                in ("wheel", "backglass", "playfield", "dmd", "cab", "flyer", "realdmd")
                and ext in IMAGE_EXTS
            ):
                await db.upsert_media(table_id, media_type, str(f))
            break
