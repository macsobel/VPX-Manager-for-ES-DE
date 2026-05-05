from __future__ import annotations

import os
import shutil

"""
File upload router — VPinFE-style table import with individual typed file fields.
Each file type has its own upload endpoint for proper routing into the
self-contained table folder structure.

Table folder structure:
  Table Name (Manufacturer Year)/
  ├── Table Name.vpx
  ├── Table Name.directb2s
  ├── Table Name.vbs
  ├── Table Name.ini
  ├── music/
  ├── pupvideos/
  ├── medias/           (wheel.png, bg.png, table.png, table.mp4, etc.)
  └── pinmame/
      ├── roms/
      ├── altcolor/
      ├── altsound/
      ├── nvram/
      ├── ini/
      └── cfg/
"""
import io
import logging
import tempfile
import zipfile
from pathlib import Path
from typing import List, Optional, Union

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile, HTTPException

from backend.core.config import config
from backend.core.display_utils import get_effective_rotation
from backend.services.vps_matcher import vps_matcher

# Optional archive support
try:
    import py7zr
except ImportError:
    py7zr = None

try:
    import patoolib
except ImportError:
    patoolib = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])


def _sanitize_folder_name(name: str) -> str:
    """Remove characters that are invalid in folder names."""
    return "".join(c for c in name if c not in '<>:"/\\|?*')


def _ensure_table_subfolders(table_dir: Path):
    """Pre-create the standard self-contained table structure."""
    for sub in [
        "music",
        "pupvideos",
        "medias",
        "pinmame/roms",
        "pinmame/altcolor",
        "pinmame/altsound",
        "pinmame/nvram",
        "pinmame/cfg",
    ]:
        (table_dir / sub).mkdir(parents=True, exist_ok=True)


@router.get("/import-nvram")
async def import_nvram(name: str):
    """Fetch an NVRAM file from the master repository to be used in an upload slot."""
    nvram_repo_dir = Path(config.support_dir) / "nvrams"
    if not nvram_repo_dir.exists():
        raise HTTPException(status_code=404, detail="NVRAM repository not found")

    # Search recursively for the filename
    target_file = next(nvram_repo_dir.rglob(name), None)
    if not target_file or not target_file.is_file():
        raise HTTPException(
            status_code=404, detail=f"NVRAM {name} not found in repository"
        )

    from fastapi.responses import FileResponse

    return FileResponse(
        target_file, media_type="application/octet-stream", filename=name
    )


@router.post("/parse-vpx")
async def parse_vpx(
    vpx_file: UploadFile = File(...), vps_id: Optional[str] = Form(None)
):
    """Parse a .vpx file to extract expected ROMs before import."""
    import tempfile

    from backend.services.vpx_parser import VPXParser

    with tempfile.NamedTemporaryFile(delete=False, suffix=".vpx") as tmp:
        content = await vpx_file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        roms = VPXParser.process_vpx_table(
            tmp_path, extract_sidecar=False, vps_id=vps_id
        )
        logger.info(
            f"Analyzed VPX {vpx_file.filename} (VPS: {vps_id}), found ROMs: {roms}"
        )

        # Check master NVRAM repo for matching files (recursive search)
        nvram_repo_dir = Path(config.support_dir) / "nvrams"
        matched_nvram = []
        if nvram_repo_dir.exists():
            # Index all files in the repo for fast lookup
            all_repo_files = {
                f.name.lower(): f.name
                for f in nvram_repo_dir.rglob("*.nv")
                if f.is_file()
            }

            for rom_obj in roms:
                rom_name = (
                    rom_obj.get("version") if isinstance(rom_obj, dict) else rom_obj
                )
                if not rom_name:
                    continue

                nv_key = f"{rom_name.lower()}.nv"
                if nv_key in all_repo_files:
                    matched_nvram.append(all_repo_files[nv_key])

        # NEW: Check for auto-patch via VBS Manager
        vbs_sidecar = Path(tmp_path).with_suffix(".vbs")
        patch_info = None

        from backend.services.vbs_manager import vbs_manager

        extract_result = await vbs_manager.extract_vbs(Path(tmp_path))

        if extract_result.get("success") and vbs_sidecar.exists():
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
            if vbs_sidecar.exists():
                try:
                    vbs_sidecar.unlink()  # Clean up extracted sidecar
                except FileNotFoundError:
                    pass

        # NEW: Check for AltColors via VPS
        altcolors = []
        if vps_id:
            from backend.services.vps_matcher import vps_matcher

            altcolors = vps_matcher.get_altcolors_by_vps_id(vps_id)

        return {
            "success": True,
            "roms": roms,
            "altcolors": altcolors,
            "nvram": matched_nvram,
            "patch_info": patch_info,
        }
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/import-table")
async def import_table(
    background_tasks: BackgroundTasks,
    table_name: str = Form(...),
    manufacturer: str = Form(""),
    year: str = Form(""),
    vps_id: str = Form(""),
    table_type: str = Form(""),
    vps_version: str = Form(""),
    vps_table_url: str = Form(""),
    ipdb_id: str = Form(""),
    vpx_file: UploadFile = File(...),
    directb2s_file: Optional[UploadFile] = File(None),
    rom_files: List[UploadFile] = File([]),
    puppack_file: Union[UploadFile, List[UploadFile], None] = File(None),
    music_file: Union[UploadFile, List[UploadFile], None] = File(None),
    altsound_file: Union[UploadFile, List[UploadFile], None] = File(None),
    altcolor_file: Union[UploadFile, List[UploadFile], None] = File(None),
    vbs_file: Optional[UploadFile] = File(None),
    ini_file: Optional[UploadFile] = File(None),
    nvram_files: Optional[str] = Form(None),
    uploaded_nvram_files: List[UploadFile] = File([]),
    auto_scrape: bool = Form(False),
):
    """
    Import a new table with all associated files in one operation.
    Creates the folder structure and routes each file to its correct location.
    """
    # 1. Standardize metadata from VPS if ID provided (Authoritative 100% match logic)
    if vps_id:
        vps_entry = vps_matcher.get_entry(vps_id)
        if vps_entry:
            table_name = vps_entry.get("name") or table_name
            manufacturer = vps_entry.get("manufacturer") or manufacturer
            year = str(vps_entry.get("year", "")) or year
            logger.info(
                f"VPIN-MANAGER: Using authoritative VPS metadata for ID {vps_id}: {table_name} ({manufacturer} {year})"
            )
    import backend.core.database as db
    from backend.services.table_file_service import TableFileService

    tables_dir = config.expanded_tables_dir
    tables_dir.mkdir(parents=True, exist_ok=True)

    # Build standardized name
    standard_name = TableFileService.get_standard_name(table_name, manufacturer, year)
    folder_name = standard_name
    table_dir = tables_dir / folder_name

    if table_dir.exists():
        return {
            "success": False,
            "error": f"Folder already exists: {folder_name}",
            "folder": folder_name,
        }

    _ensure_table_subfolders(table_dir)

    results = []

    # 1. VPX file (required) — save to table root with standardized name
    vpx_content = await vpx_file.read()
    new_vpx_filename = f"{standard_name}.vpx"
    vpx_target = table_dir / new_vpx_filename
    with open(vpx_target, "wb") as f:
        f.write(vpx_content)
    results.append(
        {"type": "vpx", "file": new_vpx_filename, "destination": str(vpx_target)}
    )

    # 2. DirectB2S (optional) — save to table root with standardized name
    if directb2s_file and directb2s_file.filename:
        b2s_content = await directb2s_file.read()
        if b2s_content:
            ext = Path(directb2s_file.filename).suffix
            new_b2s_filename = f"{standard_name}{ext}"
            b2s_target = table_dir / new_b2s_filename
            with open(b2s_target, "wb") as f:
                f.write(b2s_content)
            results.append(
                {
                    "type": "backglass",
                    "file": new_b2s_filename,
                    "destination": str(b2s_target),
                }
            )

    # 3. ROMs (optional) — save to pinmame/roms/
    for rf in rom_files:
        if rf and rf.filename:
            rom_content = await rf.read()
            if rom_content:
                rom_target = table_dir / "pinmame" / "roms" / rf.filename
                rom_target.parent.mkdir(parents=True, exist_ok=True)
                with open(rom_target, "wb") as f:
                    f.write(rom_content)
                results.append(
                    {"type": "rom", "file": rf.filename, "destination": str(rom_target)}
                )

    # 4. PUP Pack (optional) — extract or save loose files
    if puppack_file:
        pup_dest = table_dir / "pupvideos"
        result = await _process_slot_media(puppack_file, pup_dest, "PUP Pack")
        results.append(result)

    # 5. Music (optional) — extract or save loose files
    if music_file:
        music_dest = table_dir / "music"
        result = await _process_slot_media(music_file, music_dest, "Music")
        results.append(result)

    # 6. AltSound (optional) — extract or save loose files
    if altsound_file:
        altsound_dest = table_dir / "pinmame" / "altsound"
        result = await _process_slot_media(altsound_file, altsound_dest, "AltSound")
        results.append(result)

    # 7. AltColor (optional) — save to pinmame/altcolor/ with potential rom-specific subfolder
    if altcolor_file:
        # Determine if we should use a rom-specific subfolder
        # Priority: 1. User manual upload filename base, 2. First detected ROM name
        altcolor_base_dest = table_dir / "pinmame" / "altcolor"

        # If we have a rom from detection or VPS, use it as a subfolder for better isolation
        rom_subfolder = ""
        if rom_files and rom_files[0].filename:
            rom_subfolder = Path(rom_files[0].filename).stem
        elif rom_files and isinstance(rom_files, list) and len(rom_files) > 0:
            rom_subfolder = Path(rom_files[0].filename).stem
        elif results:
            # Try to find a rom result
            rom_res = next((r for r in results if r["type"] == "rom"), None)
            if rom_res:
                rom_subfolder = Path(rom_res["file"]).stem

        # Fallback to VPS rom version if available
        if not rom_subfolder and rom_files:
            # This is a bit complex, let's keep it simple for now:
            # Use pinmame/altcolor/<filename_stem> if it's a single file,
            # or pinmame/altcolor/ if it's a zip.
            pass

        result = await _process_slot_media(
            altcolor_file, altcolor_base_dest, "AltColor", wrap_in_subfolder=True
        )
        results.append(result)

    # 8. Sidecar Files (optional)
    if vbs_file and vbs_file.filename:
        vbs_content = await vbs_file.read()
        target = table_dir / f"{standard_name}.vbs"
        with open(target, "wb") as f:
            f.write(vbs_content)
        results.append(
            {"type": "vbs_override", "status": "saved", "destination": str(target)}
        )

    if ini_file and ini_file.filename:
        ini_content = await ini_file.read()
        target = table_dir / f"{standard_name}.ini"
        with open(target, "wb") as f:
            f.write(ini_content)
        results.append({"type": "ini", "status": "saved", "destination": str(target)})
        # Extra safety: wipe out any orphaned pinmame/ini subfolder if it was created
        old_ini_dir = table_dir / "pinmame" / "ini"
        if old_ini_dir.exists():
            shutil.rmtree(old_ini_dir)
    else:
        # Auto-generate Smart Auto-Fit INI on first upload
        try:
            rotation = get_effective_rotation(config.master_orientation)
            ini_lines = [
                "[Player]",
                f"Rotation = {rotation}",
                "CabinetAutofitMode = 1",
                "CabinetAutofitPos = 0.1",
            ]
            target = table_dir / f"{standard_name}.ini"
            with open(target, "w", encoding="utf-8") as f:
                f.write("\n".join(ini_lines) + "\n")
            results.append({"type": "ini", "status": "auto-generated", "destination": str(target)})
        except Exception as e:
            logger.error(f"Failed to auto-generate INI during import: {e}")

    # 8. NVRAM files (optional) — copy from master repo or save uploaded files to pinmame/nvram/

    nvram_dest = table_dir / "pinmame" / "nvram"

    if nvram_files:
        nv_list = [f.strip() for f in nvram_files.split(",") if f.strip()]
        nvram_repo_dir = Path(config.support_dir) / "nvrams"
        nvram_dest.mkdir(parents=True, exist_ok=True)
        for nv in nv_list:
            source = nvram_repo_dir / nv
            if source.exists():
                target = nvram_dest / nv
                shutil.copy2(source, target)
                results.append(
                    {"type": "nvram", "file": nv, "destination": str(target)}
                )

    for file in uploaded_nvram_files:
        if file and file.filename:
            content = await file.read()
            if content:
                nvram_dest.mkdir(parents=True, exist_ok=True)
                target = nvram_dest / file.filename
                with open(target, "wb") as f:
                    f.write(content)
                results.append(
                    {"type": "nvram", "file": file.filename, "destination": str(target)}
                )

    # Extract internal metadata from the saved VPX file
    from backend.services.vpx_parser import VPXParser

    meta = VPXParser.get_metadata(vpx_target)
    vbs_hash = VPXParser.get_vbs_hash(vpx_target)

    # 9. Robustly extract VBS using VPinballX
    from backend.services.vbs_manager import vbs_manager

    # Only auto-extract if a manual VBS wasn't uploaded
    if not vbs_file:
        await vbs_manager.extract_vbs(vpx_target)
    else:
        logger.info(
            f"Skipping VBS extraction, using uploaded override for {new_vpx_filename}"
        )

    # 10. Process VPX table for ROM detection (will read from the new .vbs file)
    VPXParser.process_vpx_table(vpx_target, extract_sidecar=False, vps_id=vps_id)

    # Persist to database
    display_name_to_save = table_name or meta.get("display_name")
    table_id = await db.upsert_table(
        {
            "display_name": display_name_to_save,
            "filename": new_vpx_filename,
            "manufacturer": manufacturer,
            "year": year,
            "vps_id": vps_id,
            "table_type": table_type,
            "vps_version": vps_version,
            "vps_table_url": vps_table_url,
            "ipdb_id": ipdb_id,
            "version": meta["version"] or vps_version,
            "author": meta["author"],
            "folder_path": str(table_dir),
            "has_b2s": 1 if directb2s_file else 0,
            "has_rom": 1 if rom_files else 0,
            "vbs_hash": vbs_hash,
        }
    )

    # Ensure the physical folder and files are perfectly standardized to the chosen metadata
    from backend.services.table_file_service import TableFileService
    await TableFileService.standardize_names(table_id)

    # 11. Optional: Auto-scrape media (blocking if requested)
    scrape_result = None
    if auto_scrape:
        from backend.services.scraper_service import trigger_media_download

        table_updated = await db.get_table(table_id)
        scrape_result = await trigger_media_download(
            table_id=table_id,
            vps_id=vps_id,
            table_name=table_updated["display_name"],
            filename=table_updated["filename"],
            missing_only=True,
        )
        
        # Persist downloaded files into the media table
        if scrape_result.get("success") and scrape_result.get("downloaded"):
            for dl_item in scrape_result["downloaded"]:
                cat = dl_item.get("type")
                path = dl_item.get("path")
                if cat and path:
                    try:
                        await db.upsert_media(table_id, cat, path)
                    except Exception as db_err:
                        logger.error(f"Failed to persist media [{cat}] during import: {db_err}")

    return {
        "success": True,
        "id": table_id,
        "folder": folder_name,
        "path": str(table_dir),
        "results": results,
        "scraped": scrape_result
    }


@router.post("/file-to-table/{table_id}")
async def upload_file_to_table(
    table_id: int,
    file_type: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Upload a single file to an existing table's folder.
    Handles 'safe replacement' by deleting or wiping existing content first.
    """

    import backend.core.database as db

    table = await db.get_table(table_id)
    if not table:
        return {"success": False, "error": "Table not found"}

    table_dir = Path(table["folder_path"])
    if not table_dir.exists():
        return {"success": False, "error": f"Table folder not found: {table_dir}"}

    content = await file.read()
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()

    # Route based on file_type with replacement logic
    # Use standardized name as base if possible
    base_name = Path(table["filename"]).stem

    if file_type == "vpx":
        target = table_dir / f"{base_name}.vpx"
        if target.exists():
            target.unlink()
        # Delete any existing .vbs files to ensure clean state if replacing table
        for old_vbs in table_dir.glob("*.vbs"):
            try:
                old_vbs.unlink()
            except Exception:
                pass

    elif file_type == "backglass":
        # Delete ANY existing .directb2s first
        for old in table_dir.glob("*.directb2s"):
            old.unlink()
        target = table_dir / f"{base_name}{ext}"
        await db.upsert_table({"filename": table["filename"], "has_b2s": 1})

    elif file_type == "rom":
        target = table_dir / "pinmame" / "roms" / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()
        await db.upsert_table({"filename": table["filename"], "has_rom": 1})

    elif file_type == "puppack":
        dest = table_dir / "pupvideos"
        return _extract_zip_safely(content, dest, "PUP Pack", wipe=True)

    elif file_type == "music":
        dest = table_dir / "music"
        if ext == ".zip":
            return _extract_zip_safely(content, dest, "Music", wipe=True)
        else:
            target = dest / filename
            target.parent.mkdir(parents=True, exist_ok=True)

    elif file_type == "altsound":
        dest = table_dir / "pinmame" / "altsound"
        if ext == ".zip":
            return _extract_zip_safely(content, dest, "AltSound", wipe=True)
        else:
            target = dest / filename
            target.parent.mkdir(parents=True, exist_ok=True)

    elif file_type == "altcolor":
        dest = table_dir / "pinmame" / "altcolor"
        if ext == ".zip":
            return _extract_zip_safely(content, dest, "AltColor", wipe=True)
        else:
            # Isolated per-table architecture: place in rom-specific folder
            # For now, use the filename stem as the rom name if not provided
            rom_name = Path(filename).stem
            dest = dest / rom_name
            dest.mkdir(parents=True, exist_ok=True)
            target = dest / filename
            target.parent.mkdir(parents=True, exist_ok=True)

    elif file_type == "vbs":
        target = table_dir / f"{base_name}.vbs"
        if target.exists():
            target.unlink()

    elif file_type == "ini":
        target = table_dir / f"{base_name}.ini"
        if target.exists():
            target.unlink()

    elif file_type == "nvram":
        target = table_dir / "pinmame" / "nvram" / filename
        target.parent.mkdir(parents=True, exist_ok=True)

    elif file_type.startswith("media_"):
        media_name_map = {
            "media_wheel": "wheel",
            "media_backglass": "bg",
            "media_playfield": "table",
            "media_table_video": "table",
            "media_dmd": "dmd",
            "media_audio": "audio",
            "media_cab": "cab",
            "media_flyer": "flyer",
            "media_realdmd": "realdmd",
        }
        media_base = media_name_map.get(file_type, file_type.replace("media_", ""))
        target = table_dir / "medias" / f"{media_base}{ext}"
        target.parent.mkdir(parents=True, exist_ok=True)
        # Delete existing media of same base name (any extension)
        for old in target.parent.glob(f"{media_base}.*"):
            old.unlink()
    else:
        return {"success": False, "error": f"Unknown file type: {file_type}"}

    with open(target, "wb") as f:
        f.write(content)

    if file_type == "vpx":
        from backend.services.vbs_manager import vbs_manager

        await vbs_manager.extract_vbs(target)
        from backend.services.vpx_parser import VPXParser

        VPXParser.process_vpx_table(target, extract_sidecar=False)

    return {
        "success": True,
        "type": file_type,
        "file": filename,
        "destination": str(target),
    }


async def _process_slot_media(
    file_input: Union[UploadFile, List[UploadFile]],
    dest: Path,
    label: str,
    wrap_in_subfolder: bool = False,
) -> dict:
    """Helper to process a slot that can be either an archive or a list of loose files."""
    if isinstance(file_input, list):
        # Multiple loose files
        dest.mkdir(parents=True, exist_ok=True)
        count = 0
        for f in file_input:
            if not f.filename:
                continue
            content = await f.read()

            target_dest = dest
            if wrap_in_subfolder:
                # Use filename stem as subfolder
                target_dest = dest / Path(f.filename).stem
                target_dest.mkdir(parents=True, exist_ok=True)

            with open(target_dest / f.filename, "wb") as out:
                out.write(content)
            count += 1
        return {
            "type": label.lower().replace(" ", "_"),
            "status": f"saved_{count}_files",
            "destination": str(dest),
        }

    # Single item (UploadFile)
    if not file_input.filename:
        return {"type": label.lower().replace(" ", "_"), "status": "skipped"}

    ext = Path(file_input.filename).suffix.lower()
    content = await file_input.read()

    # If it's a common archive, extract it
    if ext in [".zip", ".7z", ".rar"]:
        return await _extract_archive_safely(
            content, file_input.filename, dest, label, wipe=True
        )

    # Otherwise, it's a single loose file
    target_dest = dest
    if wrap_in_subfolder:
        target_dest = dest / Path(file_input.filename).stem

    target_dest.mkdir(parents=True, exist_ok=True)
    target = target_dest / file_input.filename
    with open(target, "wb") as f:
        f.write(content)
    return {
        "type": label.lower().replace(" ", "_"),
        "status": "saved_file",
        "destination": str(target),
    }


async def _extract_archive_safely(
    content: bytes, filename: str, dest: Path, label: str, wipe: bool = False
) -> dict:
    """Extract a zip, 7z, or rar file to the destination, optional wiping first."""
    if wipe and dest.exists():
        shutil.rmtree(dest)

    dest.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename).suffix.lower()

    try:
        if suffix == ".zip":
            with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
                zf.extractall(dest)
        elif suffix == ".7z":
            if py7zr:
                with py7zr.SevenZipFile(io.BytesIO(content), mode="r") as sz:
                    sz.extractall(dest)
            else:
                return {
                    "type": label.lower().replace(" ", "_"),
                    "status": "error",
                    "error": "7z support not installed (py7zr missing)",
                }
        elif suffix == ".rar":
            # patool is the most robust way to handle RAR if binaries exist
            if patoolib:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".rar") as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                try:
                    patoolib.extract_archive(tmp_path, outdir=str(dest), verbosity=-1)
                    return {
                        "type": label.lower().replace(" ", "_"),
                        "status": "extracted",
                        "destination": str(dest),
                    }
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            else:
                return {
                    "type": label.lower().replace(" ", "_"),
                    "status": "error",
                    "error": f"RAR support missing (patoolib or unrar binary needed for {label})",
                }
        else:
            return {
                "type": label.lower().replace(" ", "_"),
                "status": "error",
                "error": f"Unsupported archive format: {suffix}",
            }

        return {
            "type": label.lower().replace(" ", "_"),
            "status": "extracted",
            "destination": str(dest),
        }
    except Exception as e:
        logger.error(f"{label} extraction failed: {e}")
        return {
            "type": label.lower().replace(" ", "_"),
            "status": "error",
            "error": f"{label} extraction failed: {str(e)}",
        }


@router.post("/reset")
async def reset_session():
    """Legacy endpoint — kept for compatibility."""
    return {"message": "Upload session reset"}
