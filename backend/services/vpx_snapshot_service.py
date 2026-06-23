"""
VPX Application Snapshot Service
Backs up and restores the Visual Pinball application binary/bundle and its settings.
"""

import json
import logging
import datetime
import os
import platform
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

from backend.core.config import APP_SUPPORT_DIR, config
from backend.services.task_registry import task_registry

logger = logging.getLogger(__name__)


class VpxSnapshotService:
    SNAPSHOT_DIR = Path(APP_SUPPORT_DIR) / "Snapshots" / "VPX"

    @classmethod
    def _get_vpx_settings_dir(cls) -> Path:
        """Get the platform-specific VPX settings directory.
        Per https://github.com/vpinball/vpinball/blob/master/docs/FileLayout.md:
          macOS:  ~/Library/Application Support/VPinballX
          Linux:  ~/.local/share/VPinballX
        """
        if platform.system() == "Darwin":
            return Path.home() / "Library" / "Application Support" / "VPinballX"
        else:
            # Linux: ~/.local/share/VPinballX per official VPX docs
            return Path.home() / ".local" / "share" / "VPinballX"

    @classmethod
    def _get_vpx_app_path(cls) -> Optional[Path]:
        """Get the VPX application path from config."""
        raw = config.vpx_standalone_app_path.strip()
        if not raw:
            return None
        return Path(os.path.expanduser(raw))

    @classmethod
    async def create_snapshot(cls, label: str = None, task_id: str = "vpx_snapshot_create") -> Dict:
        """Create a backup of the VPX application and settings."""
        task_registry.start_task(task_id, total=100, message="Locating VPX files...")

        app_path = cls._get_vpx_app_path()
        settings_dir = cls._get_vpx_settings_dir()

        if not app_path or not app_path.exists():
            task_registry.fail_task(task_id, f"VPX application not found at: {app_path}")
            return {"success": False, "error": f"VPX application not found at: {app_path}"}

        # Collect files to backup
        app_files = []
        settings_files = []
        prefs_files = []

        # Collect app files (could be a .app bundle directory or single binary)
        task_registry.update_progress(task_id, 5, "Scanning application files...")
        if app_path.is_dir():
            for f in app_path.rglob("*"):
                if f.is_file():
                    app_files.append(f)
        elif app_path.is_file():
            app_files.append(app_path)

        # Collect settings files
        task_registry.update_progress(task_id, 10, "Scanning settings files...")
        settings_exist = settings_dir.exists() and settings_dir.is_dir()
        if settings_exist:
            for f in settings_dir.rglob("*"):
                if f.is_file():
                    settings_files.append(f)

        # Collect preferences files (macOS only)
        if platform.system() == "Darwin":
            prefs_dir = Path.home() / "Library" / "Preferences"
            if prefs_dir.exists():
                for f in prefs_dir.glob("org.vpinball.*.plist"):
                    if f.is_file():
                        prefs_files.append(f)

        total_files = len(app_files) + len(settings_files) + len(prefs_files)
        if total_files == 0:
            task_registry.fail_task(task_id, "No files found to backup")
            return {"success": False, "error": "No files found to backup"}

        task_registry.update_progress(task_id, 15, f"Found {total_files} files to package...")

        # Create snapshot directory and archive
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        cls.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        zip_path = cls.SNAPSHOT_DIR / f"{timestamp}.zip"

        metadata = {
            "timestamp": datetime.datetime.now().isoformat(),
            "label": label or "Manual Backup",
            "app_path": str(app_path),
            "settings_path": str(settings_dir),
            "settings_exist": settings_exist,
            "app_is_bundle": app_path.is_dir(),
            "platform": platform.system(),
            "app_file_count": len(app_files),
            "settings_file_count": len(settings_files),
            "prefs_file_count": len(prefs_files),
            "files": {
                "app": [str(f.relative_to(app_path.parent if app_path.is_dir() else app_path.parent)) for f in app_files],
                "settings": [str(f.relative_to(settings_dir)) for f in settings_files] if settings_exist else [],
                "prefs": [str(f.name) for f in prefs_files]
            }
        }

        try:
            task_registry.update_progress(task_id, 20, "Creating archive...")

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add metadata
                zipf.writestr("metadata.json", json.dumps(metadata, indent=4))

                # Add app files
                processed = 0
                for f in app_files:
                    if app_path.is_dir():
                        # For .app bundles, preserve the bundle structure
                        arcname = f"app/{app_path.name}/{f.relative_to(app_path)}"
                    else:
                        # For single binaries
                        arcname = f"app/{f.name}"
                    zipf.write(f, arcname)
                    processed += 1
                    progress = 20 + int((processed / total_files) * 75)
                    if processed % 10 == 0:
                        task_registry.update_progress(task_id, progress, f"Adding {f.name}...")

                # Add settings files
                for f in settings_files:
                    arcname = f"settings/{f.relative_to(settings_dir)}"
                    zipf.write(f, arcname)
                    processed += 1
                    progress = 20 + int((processed / total_files) * 75)
                    if processed % 10 == 0:
                        task_registry.update_progress(task_id, progress, f"Adding {f.name}...")

                # Add preferences files
                for f in prefs_files:
                    arcname = f"prefs/{f.name}"
                    zipf.write(f, arcname)
                    processed += 1
                    progress = 20 + int((processed / total_files) * 75)
                    if processed % 10 == 0:
                        task_registry.update_progress(task_id, progress, f"Adding {f.name}...")

            task_registry.complete_task(task_id, "VPX backup created successfully")
            return {
                "success": True,
                "snapshot_id": timestamp,
                "path": str(zip_path),
                "metadata": metadata
            }
        except Exception as e:
            logger.error(f"Failed to create VPX snapshot: {e}")
            # Clean up partial zip
            if zip_path.exists():
                zip_path.unlink()
            task_registry.fail_task(task_id, str(e))
            return {"success": False, "error": str(e)}

    @classmethod
    async def list_snapshots(cls) -> List[Dict]:
        """List all VPX application snapshots."""
        if not cls.SNAPSHOT_DIR.exists():
            return []

        snapshots = []
        for f in cls.SNAPSHOT_DIR.glob("*.zip"):
            try:
                with zipfile.ZipFile(f, 'r') as zipf:
                    if "metadata.json" in zipf.namelist():
                        meta = json.loads(zipf.read("metadata.json").decode())
                        meta["id"] = f.stem
                        meta["size"] = f.stat().st_size
                        snapshots.append(meta)
            except Exception as e:
                logger.warning(f"Failed to read VPX snapshot {f}: {e}")

        # Sort by timestamp descending
        snapshots.sort(key=lambda x: x["timestamp"], reverse=True)
        return snapshots

    @classmethod
    async def restore_snapshot(cls, snapshot_id: str, task_id: str = "vpx_snapshot_restore") -> Dict:
        """Restore a VPX snapshot, replacing current app and settings."""
        task_registry.start_task(task_id, total=100, message="Opening archive...")

        zip_path = cls.SNAPSHOT_DIR / f"{snapshot_id}.zip"
        if not zip_path.exists():
            task_registry.fail_task(task_id, "Snapshot not found")
            return {"success": False, "error": "Snapshot not found"}

        try:
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                # Read metadata
                meta = json.loads(zipf.read("metadata.json").decode())
                original_app_path = Path(meta["app_path"])
                original_settings_path = Path(meta["settings_path"])
                is_bundle = meta.get("app_is_bundle", False)

                all_files = [n for n in zipf.namelist() if n != "metadata.json"]
                total_files = len(all_files)

                task_registry.update_progress(task_id, 10, "Removing current files...")

                # Delete current app
                if original_app_path.exists():
                    if original_app_path.is_dir():
                        shutil.rmtree(original_app_path)
                    else:
                        original_app_path.unlink()

                # Delete current settings
                if original_settings_path.exists() and original_settings_path.is_dir():
                    shutil.rmtree(original_settings_path)

                # Delete current prefs (macOS only)
                if platform.system() == "Darwin":
                    prefs_dir = Path.home() / "Library" / "Preferences"
                    if prefs_dir.exists():
                        for f in prefs_dir.glob("org.vpinball.*.plist"):
                            if f.is_file():
                                try:
                                    f.unlink()
                                except Exception:
                                    pass

                task_registry.update_progress(task_id, 20, f"Extracting {total_files} files...")

                # Extract files to their original locations
                for i, name in enumerate(all_files):
                    if name.startswith("app/"):
                        # Determine target path for app files
                        if is_bundle:
                            # app/BundleName.app/... -> original_app_path/...
                            # Strip "app/BundleName.app/" prefix
                            parts = Path(name).parts
                            if len(parts) > 2:
                                relative = Path(*parts[2:])  # Skip "app" and bundle name
                                target = original_app_path / relative
                            else:
                                continue  # Directory entry, skip
                        else:
                            # app/filename -> original_app_path (parent dir)
                            parts = Path(name).parts
                            if len(parts) > 1:
                                target = original_app_path
                            else:
                                continue

                        target.parent.mkdir(parents=True, exist_ok=True)
                        with zipf.open(name) as src, open(target, 'wb') as dst:
                            dst.write(src.read())

                        # Restore executable permissions on the main binary
                        if not is_bundle and target == original_app_path:
                            os.chmod(target, 0o755)

                    elif name.startswith("settings/"):
                        # settings/... -> original_settings_path/...
                        parts = Path(name).parts
                        if len(parts) > 1:
                            relative = Path(*parts[1:])  # Skip "settings"
                            target = original_settings_path / relative
                            target.parent.mkdir(parents=True, exist_ok=True)
                            with zipf.open(name) as src, open(target, 'wb') as dst:
                                dst.write(src.read())

                    elif name.startswith("prefs/"):
                        # prefs/... -> ~/Library/Preferences/...
                        if platform.system() == "Darwin":
                            prefs_dir = Path.home() / "Library" / "Preferences"
                            parts = Path(name).parts
                            if len(parts) > 1:
                                target = prefs_dir / parts[1]  # The file name
                                target.parent.mkdir(parents=True, exist_ok=True)
                                with zipf.open(name) as src, open(target, 'wb') as dst:
                                    dst.write(src.read())

                    progress = 20 + int((i + 1) / total_files * 75)
                    if i % 10 == 0:
                        task_registry.update_progress(task_id, progress, f"Restoring {Path(name).name}...")

                # For macOS .app bundles, fix executable permissions on the main binary
                if is_bundle and original_app_path.exists():
                    macos_dir = original_app_path / "Contents" / "MacOS"
                    if macos_dir.exists():
                        for f in macos_dir.iterdir():
                            if f.is_file():
                                os.chmod(f, 0o755)

            task_registry.complete_task(task_id, "VPX application restored successfully")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to restore VPX snapshot {snapshot_id}: {e}")
            task_registry.fail_task(task_id, str(e))
            return {"success": False, "error": str(e)}

    @classmethod
    async def delete_snapshot(cls, snapshot_id: str) -> Dict:
        """Delete a single VPX snapshot."""
        zip_path = cls.SNAPSHOT_DIR / f"{snapshot_id}.zip"
        if zip_path.exists():
            try:
                zip_path.unlink()
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Snapshot not found"}

    @classmethod
    async def delete_all_snapshots(cls) -> Dict:
        """Delete all VPX snapshots."""
        if not cls.SNAPSHOT_DIR.exists():
            return {"success": True}
        
        errors = []
        for f in cls.SNAPSHOT_DIR.glob("*.zip"):
            try:
                f.unlink()
            except Exception as e:
                errors.append(f"Failed to delete {f.name}: {e}")
                
        if errors:
            return {"success": False, "error": "; ".join(errors)}
        return {"success": True}

    @classmethod
    async def delete_originals(cls) -> Dict:
        """Delete the current VPX application and settings to prepare for a fresh install."""
        app_path = cls._get_vpx_app_path()
        settings_dir = cls._get_vpx_settings_dir()

        errors = []

        # Delete app
        if app_path and app_path.exists():
            try:
                if app_path.is_dir():
                    shutil.rmtree(app_path)
                else:
                    app_path.unlink()
                logger.info(f"Deleted VPX application at: {app_path}")
            except Exception as e:
                errors.append(f"Failed to delete app: {e}")
                logger.error(f"Failed to delete VPX app at {app_path}: {e}")

        # Delete settings
        if settings_dir.exists() and settings_dir.is_dir():
            try:
                shutil.rmtree(settings_dir)
                logger.info(f"Deleted VPX settings at: {settings_dir}")
            except Exception as e:
                errors.append(f"Failed to delete settings: {e}")
                logger.error(f"Failed to delete VPX settings at {settings_dir}: {e}")

        # Delete prefs (macOS only)
        if platform.system() == "Darwin":
            prefs_dir = Path.home() / "Library" / "Preferences"
            if prefs_dir.exists():
                for f in prefs_dir.glob("org.vpinball.*.plist"):
                    if f.is_file():
                        try:
                            f.unlink()
                            logger.info(f"Deleted VPX preferences file at: {f}")
                        except Exception as e:
                            errors.append(f"Failed to delete prefs {f.name}: {e}")
                            logger.error(f"Failed to delete VPX prefs at {f}: {e}")

        if errors:
            return {"success": False, "error": "; ".join(errors)}

        return {"success": True, "message": "VPX application and settings deleted. Ready for fresh install."}
