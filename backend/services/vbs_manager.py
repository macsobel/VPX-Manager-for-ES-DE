import asyncio
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Optional

import httpx

import backend.core.database as db
from backend.core.config import config
from backend.services.task_registry import task_registry

logger = logging.getLogger(__name__)

HASHES_URL = (
    "https://raw.githubusercontent.com/jsm174/vpx-standalone-scripts/master/hashes.json"
)


class VBSManagerService:
    def __init__(self):
        self._cached_hashes = None
        self._bulk_extract_task: Optional[asyncio.Task] = None
        self._bulk_extract_progress = {"total": 0, "current": 0, "is_running": False}

    def _get_local_hashes_path(self) -> Path:
        path = Path(config.support_dir) / "patches" / "hashes.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    async def get_patch_hashes(self, force_refresh: bool = False) -> list[dict]:
        """
        Fetch the master hashes.json from the upstream repo with local caching.
        Performs an automatic background sync if the local file is older than 24 hours.
        """
        if self._cached_hashes is not None and not force_refresh:
            return self._cached_hashes

        local_path = self._get_local_hashes_path()
        ttl_seconds = 86400  # 24 hours

        # 1. Try to load from memory/cache first if not forcing AND file exists on disk
        # (This ensures we re-download if the user manually deleted the file)
        if (
            not force_refresh
            and self._cached_hashes is not None
            and local_path.exists()
        ):
            return self._cached_hashes

        # 2. Try to load from disk if fresh enough
        if not force_refresh and local_path.exists():
            mtime = os.path.getmtime(local_path)
            if (time.time() - mtime) < ttl_seconds:
                try:
                    self._cached_hashes = await asyncio.to_thread(
                        self._load_hashes_sync, local_path
                    )
                    return self._cached_hashes
                except Exception as e:
                    logger.warning(f"Failed to read local hashes.json: {e}")

        # 3. Fetch from remote if missing, stale, or forced
        logger.info("Synchronizing VBS patch database from upstream...")
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(HASHES_URL, timeout=10.0)
                response.raise_for_status()
                data = response.json()

                # Save to disk
                await asyncio.to_thread(self._save_hashes_sync, local_path, data)

                self._cached_hashes = data
                return self._cached_hashes
            except Exception as e:
                logger.error(f"Failed to fetch patch hashes: {e}")

                # Fallback to local disk if we have it, even if stale, since remote failed
                if local_path.exists():
                    try:
                        self._cached_hashes = await asyncio.to_thread(
                            self._load_hashes_sync, local_path
                        )
                        return self._cached_hashes
                    except Exception:
                        pass
                return []

    def _load_hashes_sync(self, path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_hashes_sync(self, path: Path, data: Any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)

    def _write_vbs_sync(self, path: Path, content: bytes):
        with open(path, "wb") as f:
            f.write(content)

    async def _download_and_apply_patch(self, patch_url: str, vbs_target: Path) -> dict:
        """Helper logic to download and write a patch file, used by PatchManager and VBSManager"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(patch_url, timeout=30.0)
                response.raise_for_status()

                await asyncio.to_thread(
                    self._write_vbs_sync, vbs_target, response.content
                )

                logger.info(f"Applied patch to {vbs_target}")
                return {"success": True, "path": str(vbs_target)}
            except Exception as e:
                logger.error(f"Failed to apply patch: {e}")
                return {"success": False, "error": str(e)}

    def _get_vpx_executable_path(self) -> Path:
        vpx_app = Path(os.path.expanduser(config.vpx_standalone_app_path))

        if vpx_app.suffix == ".app":
            vpx_binary_name = (
                "VPinballX_GL" if config.vpx_use_flavor == "GL" else "VPinballX_BGFX"
            )
            path = vpx_app / "Contents" / "MacOS" / vpx_binary_name

            # Fallback to generic name if flavor-specific one is missing
            if not path.exists():
                fallback = vpx_app / "Contents" / "MacOS" / "VPinballX"
                if fallback.exists():
                    return fallback
            return path

        return vpx_app

    async def extract_vbs(self, vpx_path: Path) -> dict:
        """Asynchronously extract VBS using the VPX executable."""
        executable = self._get_vpx_executable_path()

        import shutil

        if not executable.is_absolute() and not executable.exists():
            resolved = shutil.which(executable.name)
            if resolved:
                executable = Path(resolved)

        logger.info(f"[v2.2.diag] Starting VBS extraction for: {vpx_path}")
        logger.info(f"[v2.2.diag] Using executable: {executable}")

        allowed_binaries = {
            "VPinballX_GL",
            "VPinballX_BGFX",
            "VPinballX",
            "vpinballx",
            "vpinballx-gl",
        }
        if executable.name not in allowed_binaries:
            logger.error(
                f"[v2.2.diag] Security violation: Executable name '{executable.name}' is not allowed."
            )
            return {
                "success": False,
                "error": f"Security violation: Executable '{executable.name}' is not an expected VPX binary.",
            }

        if not executable.exists():
            logger.error(f"[v2.2.diag] Executable NOT found: {executable}")
            return {"success": False, "error": f"Executable not found: {executable}"}

        try:
            # -extractvbs [table.vpx]
            cmd = [str(executable), "-extractvbs", str(vpx_path)]
            logger.info(f"[v2.2.diag] Executing command: {' '.join(cmd)}")

            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=30.0
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                logger.error(
                    f"[v2.2.diag] Extraction TIMEOUT after 30s for: {vpx_path}"
                )
                return {
                    "success": False,
                    "error": f"Extraction timed out after 30 seconds.",
                }

            if process.returncode != 0:
                error_msg = stderr.decode().strip() if stderr else "No error output."
                logger.error(
                    f"[v2.2.diag] Extraction failed with code {process.returncode}. Stderr: {error_msg}"
                )
                return {
                    "success": False,
                    "error": f"Extraction Failed [v2.2.diag]. Stderr: {error_msg}. Please ensure your VPX application is cleared from macOS quarantine using: xattr -rc '{config.vpx_standalone_app_path}'",
                }

            vbs_path = vpx_path.with_suffix(".vbs")
            if vbs_path.exists():
                logger.info(f"[v2.2.diag] Extraction successful! Created: {vbs_path}")
                vbs_hash = await asyncio.to_thread(self.calculate_vbs_hash, vbs_path)
                if vbs_hash:
                    # Update database if possible
                    table = await db.get_table_by_filename(vpx_path.name)
                    if table:
                        logger.info(
                            f"[v2.2.diag] Updating DB for {vpx_path.name} with hash {vbs_hash}"
                        )
                        await db.upsert_table(
                            {
                                "id": table["id"],
                                "filename": vpx_path.name,
                                "vbs_hash": vbs_hash,
                            }
                        )
                return {"success": True, "vbs_path": str(vbs_path)}
            else:
                logger.error(
                    f"[v2.2.diag] Command finished but {vbs_path} does not exist."
                )
                return {
                    "success": False,
                    "error": f"Extraction command completed (code {process.returncode}) but .vbs file was not found. Stderr: {stderr.decode().strip() if stderr else 'None'}",
                }
        except PermissionError as e:
            logger.error(f"[v2.2.diag] PermissionError: {e}")
            return {
                "success": False,
                "error": f"Permission denied [v2.2.diag] (PermissionError: {e}). Please ensure your VPX application is cleared from macOS quarantine and is executable: xattr -rc '{config.vpx_standalone_app_path}'",
            }
        except Exception as e:
            logger.exception(f"[v2.2.diag] Unexpected error during extraction")
            return {
                "success": False,
                "error": f"An unexpected error occurred [v2.2.diag]: {str(e)}",
            }

    def calculate_vbs_hash(self, vbs_path: Path) -> Optional[str]:
        """Calculate SHA256 hash of VBS content with normalized CRLF line endings."""
        import hashlib

        if not vbs_path.exists():
            return None
        try:
            with open(vbs_path, "rb") as f:
                vbs_bytes = f.read()
            script_text = vbs_bytes.decode("utf-8", errors="ignore")
            # Normalize to CRLF for consistent hashing with upstream repo
            # First remove all existing \r to get clean \n, then replace \n with \r\n
            normalized = (
                script_text.replace("\r\n", "\n")
                .replace("\r", "")
                .replace("\n", "\r\n")
            )

            return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate hash for {vbs_path}: {e}")
            return None

    async def apply_verified_patch(self, table_id: int) -> dict:
        """Download and apply a verified patch from hashes.json matched by current VBS hash."""
        table = await db.get_table(table_id)
        if not table:
            return {"success": False, "error": "Table not found"}

        vpx_path = Path(table["folder_path"]) / table["filename"]
        vbs_path = vpx_path.with_suffix(".vbs")

        if not vbs_path.exists():
            return {
                "success": False,
                "error": "VBS sidecar missing. Please extract first.",
            }

        # 1. Get current hash
        current_hash = await asyncio.to_thread(self.calculate_vbs_hash, vbs_path)
        if not current_hash:
            return {"success": False, "error": "Failed to calculate current VBS hash"}

        # 2. Find patch in hashes.json
        hashes = await self.get_patch_hashes()
        patch_entry = next(
            (item for item in hashes if item["sha256"] == current_hash), None
        )

        if not patch_entry:
            return {
                "success": False,
                "error": "No matching original script found in the patch database. Your VBS may already be modified or unknown.",
            }

        patch_url = patch_entry.get("patched", {}).get("url")
        if not patch_url:
            return {
                "success": False,
                "error": "Patch URL not found in the hash database.",
            }

        # 3. Download and replace
        result = await self._download_and_apply_patch(patch_url, vbs_path)
        if result["success"]:
            # 4. Update hash in DB
            new_hash = await asyncio.to_thread(self.calculate_vbs_hash, vbs_path)
            await db.upsert_table({"id": table_id, "vbs_hash": new_hash})
            return {
                "success": True,
                "message": "Verified patch applied and hash updated.",
            }

        return result

    def resolve_vbs_status(
        self,
        is_extracted: bool,
        vbs_hash: str,
        patch_originals: dict,
        patch_final: dict,
    ) -> str:
        """Unified logic to determine VBS status based on file existence and hash."""
        if not is_extracted:
            return "Missing"

        if vbs_hash:
            if vbs_hash in patch_originals:
                return "Patch Available"
            if vbs_hash in patch_final:
                return "Patched"
            return "Extracted"

        return "Extracted"

    async def _bulk_extract_worker(self, extraction_list, indexing_list):
        task_id = "vbs_sync"  # Internal ID for registry
        try:
            total = len(extraction_list) + len(indexing_list)
            self._bulk_extract_progress["total"] = total
            self._bulk_extract_progress["current"] = 0
            self._bulk_extract_progress["is_running"] = True

            task_registry.start_task(
                task_id, total=total, message="Synchronizing scripts..."
            )

            # 1. Perform extractions (and hashes)
            for vpx_path in extraction_list:
                try:
                    task_registry.update_progress(
                        task_id,
                        self._bulk_extract_progress["current"],
                        f"Extracting {vpx_path.name}...",
                    )
                    await self.extract_vbs(vpx_path)
                except Exception as e:
                    logger.error(f"Error extracting {vpx_path}: {e}")
                self._bulk_extract_progress["current"] += 1

            # 2. Perform indexing only (no binary call)
            for vpx_path, vbs_path in indexing_list:
                try:
                    task_registry.update_progress(
                        task_id,
                        self._bulk_extract_progress["current"],
                        f"Hashing {vpx_path.name}...",
                    )
                    vbs_hash = await asyncio.to_thread(
                        self.calculate_vbs_hash, vbs_path
                    )
                    if vbs_hash:
                        await db.upsert_table(
                            {"filename": vpx_path.name, "vbs_hash": vbs_hash}
                        )
                except Exception as e:
                    logger.error(f"Error hashing {vbs_path}: {e}")
                self._bulk_extract_progress["current"] += 1

            task_registry.complete_task(task_id, "Synchronization complete.")
        except Exception as e:
            logger.exception("Bulk extraction worker crashed")
            task_registry.fail_task(task_id, str(e))
        finally:
            self._bulk_extract_progress["is_running"] = False

    async def start_bulk_extraction(self):
        if self._bulk_extract_task and not self._bulk_extract_task.done():
            return {"success": False, "message": "Extraction is already running."}

        # 1. Immediate scan to get total work
        tables = await db.get_tables(limit=10000)
        extraction_list = []
        indexing_list = []

        for t in tables:
            vpx_path = Path(t["folder_path"]) / t["filename"]
            vbs_path = vpx_path.with_suffix(".vbs")

            if not vbs_path.exists() and vpx_path.exists():
                extraction_list.append(vpx_path)
            elif vbs_path.exists() and not t.get("vbs_hash"):
                indexing_list.append((vpx_path, vbs_path))

        total_work = len(extraction_list) + len(indexing_list)

        # Reset progress with actual total
        self._bulk_extract_progress = {
            "total": total_work,
            "current": 0,
            "is_running": True,
        }

        self._bulk_extract_task = asyncio.create_task(
            self._bulk_extract_worker(extraction_list, indexing_list)
        )
        return {
            "success": True,
            "message": f"Bulk extraction started for {total_work} tables.",
        }

    async def cancel_bulk_extraction(self):
        if self._bulk_extract_task and not self._bulk_extract_task.done():
            self._bulk_extract_task.cancel()
            try:
                await self._bulk_extract_task
            except asyncio.CancelledError:
                pass
            self._bulk_extract_progress["is_running"] = False
            return {"success": True, "message": "Extraction process cancelled."}
        return {"success": False, "message": "No extraction process running."}

    def get_bulk_extraction_status(self) -> dict:
        return self._bulk_extract_progress

    def get_roms_for_table(self, table_folder: str) -> list[str]:
        roms_path = Path(table_folder) / "pinmame" / "roms"
        if not roms_path.exists() or not roms_path.is_dir():
            return []

        roms = []
        for f in roms_path.iterdir():
            if f.is_file() and f.suffix.lower() == ".zip":
                roms.append(f.stem)
        return sorted(roms)

    def is_colordmd_enabled(self, content: str) -> bool:
        """Check if UseColorDMD is already set to 1 in the VBS content."""
        return bool(re.search(r"(?i)\bUseColorDMD\s*=\s*(?:1|True)", content))

    def has_colordmd_setting(self, content: str) -> bool:
        """Check if the UseColorDMD setting exists in any form in the VBS content."""
        return bool(re.search(r"(?i)\bUseColorDMD\b", content))

    def apply_regex_fix(
        self, vbs_content: str, fix_type: str, rom_name: Optional[str] = None
    ) -> str:
        if fix_type == "colordmd":
            # Enable ColorDMD: Find UseColorDMD = 0 (or commented out) and change to 1
            # E.g., UseColorDMD = 0 -> UseColorDMD = 1
            # 'UseColorDMD = 0 -> UseColorDMD = 1
            pattern = re.compile(r"(?i)(\bUseColorDMD\s*=\s*)0")
            return pattern.sub(r"\g<1>1", vbs_content)

        elif fix_type == "b2s":
            # Replace B2S Controller with VPinMAME Controller
            vbs_content = re.sub(
                r'(?i)CreateObject\("B2S\.Server"\)',
                'CreateObject("VPinMAME.Controller")',
                vbs_content,
            )
            # Comment out LaunchBackglass calls
            vbs_content = re.sub(
                r"(?im)^([^#\'\n]*)(LaunchBackglass\s+)", r"'\1\2", vbs_content
            )
            return vbs_content

        elif fix_type == "rom_swap" and rom_name:
            # ROM Swap: cGameName = "..." -> cGameName = "new_rom"
            # Const GameName = "..." -> Const GameName = "new_rom"
            # cGameName="old_rom" -> cGameName="new_rom"
            pattern = re.compile(
                r'(?i)\b(?:cGameName|GameName|RomName|ROM)\s*=\s*"([^"]+)"'
            )

            def replacer(match):
                # The entire match is the string. We want to replace just the contents of the quotes.
                # Actually, an easier way is to just rebuild the line or use sub with lambda
                full_match = match.group(0)
                old_rom = match.group(1)
                return full_match.replace(f'"{old_rom}"', f'"{rom_name}"')

            return pattern.sub(replacer, vbs_content)

        return vbs_content


vbs_manager = VBSManagerService()
