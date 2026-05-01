import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

import backend.core.database as db
from backend.services.vbs_manager import vbs_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vbs-manager", tags=["vbs-manager"])


class RegexFixRequest(BaseModel):
    fix_type: str
    rom_name: Optional[str] = None


class EditorSaveRequest(BaseModel):
    vbs_content: str


@router.post("/refresh-patches")
async def refresh_vbs_patches():
    """Force a fresh download of the VBS patch database from GitHub."""
    hashes = await vbs_manager.get_patch_hashes(force_refresh=True)
    return {"success": True, "count": len(hashes)}


@router.get("/status")
async def get_vbs_status(background_tasks: BackgroundTasks):
    """Get the status of all VBS files for tables. Automatically triggers sync if stale or missing."""
    tables = await db.get_tables(limit=10000)
    patches = await vbs_manager.get_patch_hashes()

    # Create fast maps for lookup
    patch_originals = {p["sha256"]: p for p in patches if "sha256" in p}
    patch_final = {
        p["patched"]["sha256"]: p
        for p in patches
        if "patched" in p and "sha256" in p["patched"]
    }

    results = []
    for t in tables:
        vpx_path = Path(t["folder_path"]) / t["filename"]
        vbs_sidecar = vpx_path.with_suffix(".vbs")
        is_extracted = vbs_sidecar.exists()
        vbs_hash = t.get("vbs_hash", "")

        # Robustness: Calculate missing hashes on-the-fly to prevent stale UI after sync/extraction
        if is_extracted and not vbs_hash:
            try:
                vbs_hash = vbs_manager.calculate_vbs_hash(vbs_sidecar)
                if vbs_hash:
                    # Update DB in background
                    background_tasks.add_task(
                        db.upsert_table, {"id": t["id"], "vbs_hash": vbs_hash}
                    )
            except Exception as e:
                logger.error(f"Failed to auto-hash in status check: {e}")

        status = vbs_manager.resolve_vbs_status(
            is_extracted, vbs_hash, patch_originals, patch_final
        )

        results.append(
            {
                "table_id": t["id"],
                "display_name": t["display_name"],
                "filename": t["filename"],
                "vbs_status": status,
                "vbs_hash": vbs_hash,
                "vps_id": t.get("vps_id", ""),
            }
        )

    # Auto-triggering a full bulk scan here was too aggressive and could queue hundreds of redundant tasks.
    # Users should trigger a re-scan manually if they see missing hashes.

    return results


@router.post("/patches/apply-all")
async def apply_all_vbs_patches():
    """Apply all available patches from the community repository."""
    from backend.services.patch_manager import PatchManager

    return await PatchManager.apply_all_available_patches()


@router.post("/bulk-extract")
async def bulk_extract_vbs():
    """Start the asynchronous bulk extraction process."""
    return await vbs_manager.start_bulk_extraction()


@router.get("/bulk-extract/status")
async def get_bulk_extract_status():
    """Get the status of the bulk extraction process."""
    return vbs_manager.get_bulk_extraction_status()


@router.post("/bulk-extract/cancel")
async def cancel_bulk_extract():
    """Cancel the ongoing bulk extraction process."""
    return await vbs_manager.cancel_bulk_extraction()


@router.get("/{table_id}")
async def get_table_vbs_details(table_id: int):
    """Get VBS details and content for a single table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    is_extracted = vbs_sidecar.exists()
    content = ""
    if is_extracted:
        try:
            with open(vbs_sidecar, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read VBS content: {e}")

    roms = vbs_manager.get_roms_for_table(table["folder_path"])

    vbs_hash = table.get("vbs_hash", "")
    if is_extracted and not vbs_hash:
        try:
            vbs_hash = vbs_manager.calculate_vbs_hash(vbs_sidecar)
            if vbs_hash:
                await db.upsert_table({"id": table_id, "vbs_hash": vbs_hash})
                logger.info(
                    f"Updated missing VBS hash for table {table_id}: {vbs_hash}"
                )
        except Exception as e:
            logger.error(f"Failed to auto-hash VBS for table {table_id}: {e}")

    hashes = await vbs_manager.get_patch_hashes()
    hash_map = {p["sha256"]: p for p in hashes if "sha256" in p}
    patch_originals = hash_map
    patch_final = {
        p["patched"]["sha256"]: p
        for p in hashes
        if "patched" in p and "sha256" in p["patched"]
    }

    status = vbs_manager.resolve_vbs_status(
        is_extracted, vbs_hash, patch_originals, patch_final
    )

    patch_available = status == "Patch Available"
    patch_url = ""
    if patch_available:
        patch_url = hash_map[vbs_hash]["patched"]["url"]

    return {
        "table_id": table_id,
        "display_name": table["display_name"],
        "filename": table["filename"],
        "is_extracted": is_extracted,
        "vbs_status": status,
        "vbs_content": content,
        "roms": roms,
        "patch_available": patch_available,
        "patch_url": patch_url,
        "vbs_hash": vbs_hash,
        "colordmd_enabled": vbs_manager.is_colordmd_enabled(content),
        "has_colordmd": vbs_manager.has_colordmd_setting(content),
    }


@router.post("/{table_id}/install-patch")
async def install_vbs_patch(table_id: int):
    """Download and apply a verified patch based on current hash."""
    return await vbs_manager.apply_verified_patch(table_id)


@router.post("/{table_id}/extract")
async def extract_table_vbs(table_id: int):
    """Extract VBS for a single table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    result = await vbs_manager.extract_vbs(vpx_path)
    if not result["success"]:
        raise HTTPException(
            status_code=400, detail=result.get("error", "Extraction failed")
        )
    return result


@router.delete("/{table_id}/reset")
async def reset_table_vbs(table_id: int):
    """Delete the extracted VBS sidecar for a table."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    if vbs_sidecar.exists():
        try:
            vbs_sidecar.unlink()
            # Clear hash in DB to keep sync
            await db.upsert_table({"id": table_id, "vbs_hash": ""})
            return {"success": True, "message": "VBS sidecar deleted and hash cleared"}
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to delete VBS file: {e}"
            )
    else:
        # Even if file is missing, clear the hash if it exists in DB just in case
        await db.upsert_table({"id": table_id, "vbs_hash": ""})
        return {
            "success": True,
            "message": "No VBS sidecar found; database hash cleared",
        }


@router.post("/{table_id}/diff")
async def get_regex_diff(table_id: int, req: RegexFixRequest):
    """Preview a regex auto-fix as a simple diff structure."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    if not vbs_sidecar.exists():
        raise HTTPException(
            status_code=400, detail="VBS sidecar not found. Please extract first."
        )

    try:
        with open(vbs_sidecar, "r", encoding="utf-8", errors="replace") as f:
            original_content = f.read()

        new_content = vbs_manager.apply_regex_fix(
            original_content, req.fix_type, req.rom_name
        )

        if original_content == new_content:
            return {
                "success": True,
                "changes_found": False,
                "message": "No matches found for this fix.",
            }

        # We'll just return the proposed new content entirely to the frontend
        # and let the frontend diff it or display it.
        # But per requirements, let's just generate a simple diff list for the modal.

        import difflib

        diff_lines = list(
            difflib.unified_diff(
                original_content.splitlines(),
                new_content.splitlines(),
                fromfile="Original",
                tofile="Proposed",
                lineterm="",
            )
        )

        return {
            "success": True,
            "changes_found": True,
            "original_content": original_content,
            "new_content": new_content,
            "diff_lines": diff_lines,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process VBS file: {e}")


@router.post("/{table_id}/save")
async def save_vbs_editor(table_id: int, req: EditorSaveRequest):
    """Save the manually edited or regex-fixed VBS content."""
    table = await db.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    vpx_path = Path(table["folder_path"]) / table["filename"]
    vbs_sidecar = vpx_path.with_suffix(".vbs")

    try:
        with open(vbs_sidecar, "w", encoding="utf-8") as f:
            f.write(req.vbs_content)
        return {"success": True, "message": "VBS file saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save VBS file: {e}")
