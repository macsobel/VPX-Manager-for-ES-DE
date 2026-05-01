import asyncio
import logging
from pathlib import Path

import backend.core.database as db
from backend.services.vbs_manager import vbs_manager

logger = logging.getLogger(__name__)


class PatchManager:
    """
    Manages VPX Standalone script patches.
    Matches tables via VBScript hashes and handles sidecar .vbs installation.
    """

    @staticmethod
    async def get_patch_hashes() -> list[dict]:
        """Fetch the master hashes.json from the upstream repo."""
        return await vbs_manager.get_patch_hashes()

    @staticmethod
    async def get_patch_status() -> list[dict]:
        """
        Check all VPS-matched tables for available patches.
        Returns a list of tables with their current patch status.
        """
        hashes = await PatchManager.get_patch_hashes()
        if not hashes:
            return []

        # Create fast maps for lookup
        patch_originals = {p["sha256"]: p for p in hashes if "sha256" in p}
        patch_final = {
            p["patched"]["sha256"]: p
            for p in hashes
            if "patched" in p and "sha256" in p["patched"]
        }

        # Get all tables from DB (match Master List capacity)
        tables = await db.get_tables(limit=10000)

        results = []
        for t in tables:
            vpx_path = Path(t["folder_path"]) / t["filename"]
            vbs_sidecar = vpx_path.with_suffix(".vbs")
            is_extracted = vbs_sidecar.exists()
            vbs_hash = t.get("vbs_hash", "")

            # Robustness: If file exists but hash is missing from DB, calculate it now
            # This fixes the "inconsistent list" issue where tables don't show up immediately after extraction.
            if is_extracted and not vbs_hash:
                vbs_hash = await asyncio.to_thread(
                    vbs_manager.calculate_vbs_hash, vbs_sidecar
                )
                if vbs_hash:
                    # Update DB in background (don't wait for it to return result)
                    asyncio.create_task(
                        db.upsert_table({"id": t["id"], "vbs_hash": vbs_hash})
                    )

            # Use unified status logic
            vbs_status = vbs_manager.resolve_vbs_status(
                is_extracted, vbs_hash, patch_originals, patch_final
            )

            # For the Patch Manager, we only care about Patch Available or Patched
            if vbs_status not in ["Patch Available", "Patched"]:
                continue

            # Find matching patch info (could be original hash or patched hash)
            patch_info = patch_originals.get(vbs_hash) or patch_final.get(vbs_hash)

            # Resilient fallback: If it's Patched, we definitely want it in the list
            # even if the specific patch_info isn't in the current hash_map for some reason.
            is_patched = vbs_status == "Patched"

            results.append(
                {
                    "table_id": t["id"],
                    "display_name": t["display_name"],
                    "filename": t["filename"],
                    "vbs_hash": vbs_hash,
                    "is_patched": is_patched,
                    "patch_url": patch_info["patched"]["url"] if patch_info else "",
                    "patch_name": (
                        patch_info.get("name", t["display_name"])
                        if patch_info
                        else t["display_name"]
                    ),
                    "vps_id": t.get("vps_id", ""),
                }
            )

        return results

    @staticmethod
    async def apply_patch(table_id: int) -> dict:
        """Download and install the .vbs patch for a specific table."""
        table = await db.get_table(table_id)
        if not table:
            return {"success": False, "error": "Table not found"}

        vbs_hash = table.get("vbs_hash", "")
        if not vbs_hash:
            return {
                "success": False,
                "error": "No VBS hash found for this table. Try re-scanning.",
            }

        hashes = await PatchManager.get_patch_hashes()
        hash_map = {p["sha256"]: p for p in hashes}
        patch_info = hash_map.get(vbs_hash)

        if not patch_info:
            return {
                "success": False,
                "error": "No patch available for this VBScript version.",
            }

        patch_url = patch_info["patched"]["url"]
        vpx_path = Path(table["folder_path"]) / table["filename"]
        vbs_target = vpx_path.with_suffix(".vbs")

        result = await vbs_manager._download_and_apply_patch(patch_url, vbs_target)
        if result["success"]:
            # Recalculate and update hash in DB so UI reflects "Patched" immediately
            new_hash = vbs_manager.calculate_vbs_hash(vbs_target)
            if new_hash:
                await db.upsert_table({"id": table_id, "vbs_hash": new_hash})
        return result

    @staticmethod
    async def apply_all_available_patches() -> dict:
        """Find all tables with 'Available' patches and apply them in parallel."""
        current_status = await PatchManager.get_patch_status()
        available_list = [p for p in current_status if not p["is_patched"]]

        if not available_list:
            return {"success": True, "message": "No available patches to apply."}

        # Use a semaphore to limit concurrency (max 5 simultaneous downloads)
        sem = asyncio.Semaphore(5)

        async def _bounded_apply(p):
            async with sem:
                return await PatchManager.apply_patch(p["table_id"])

        tasks = [_bounded_apply(p) for p in available_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        count = 0
        errors = []

        for i, result in enumerate(results):
            p = available_list[i]
            if isinstance(result, Exception):
                errors.append(f"{p['display_name']}: {str(result)}")
            elif result.get("success"):
                count += 1
            else:
                errors.append(f"{p['display_name']}: {result.get('error')}")

        return {
            "success": True,
            "message": f"Successfully applied {count} patches.",
            "errors": errors if errors else None,
        }
