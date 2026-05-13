import os
import json
import shutil
import logging
import datetime
from pathlib import Path
from typing import List, Dict, Optional
import zipfile

from backend.core.config import APP_SUPPORT_DIR
from backend.core import database as db

from backend.services.task_registry import task_registry

logger = logging.getLogger(__name__)

class SnapshotService:
    SNAPSHOT_DIR = Path(APP_SUPPORT_DIR) / "Snapshots"

    @classmethod
    async def create_snapshot(cls, table_id: int, label: str = None, task_id: str = "snapshot_create") -> Dict:
        """Create a snapshot of the table's core files."""
        task_registry.start_task(task_id, total=100, message="Searching for files...")
        
        table = await db.get_table(table_id)
        if not table:
            task_registry.fail_task(task_id, "Table not found")
            return {"success": False, "error": "Table not found"}

        table_dir = Path(table["folder_path"])
        if not table_dir.exists():
            task_registry.fail_task(task_id, "Table folder not found")
            return {"success": False, "error": "Table folder not found"}

        # Define files to include
        files_to_backup = []
        
        # 1. Core Table Files in root
        stem = Path(table["filename"]).stem
        # Include VPX, VBS, POV, INI, and now Backglass/RES files
        for ext in [".vpx", ".vbs", ".pov", ".ini", ".directb2s", ".res"]:
            p = table_dir / f"{stem}{ext}"
            if p.exists():
                files_to_backup.append(p)

        # 2. PinMAME Support Files (ROMs, NVRAM, etc.)
        pinmame_dir = table_dir / "pinmame"
        if pinmame_dir.exists():
            # We backup the actual files, but skip some logs/temp if they exist
            for sub in ["roms", "nvram", "altcolor", "altsound", "ini", "cfg"]:
                sub_path = pinmame_dir / sub
                if sub_path.exists():
                    for f in sub_path.rglob("*"):
                        if f.is_file() and not f.name.endswith(".log"):
                            files_to_backup.append(f)

        # 3. PuP Pack Configuration
        pup_dir = table_dir / "pupvideos"
        if pup_dir.exists():
            for sub in pup_dir.iterdir():
                if sub.is_dir():
                    # Backup all config/script files, but EXCLUDE large mp4/video media
                    config_extensions = [".pup", ".bat", ".json", ".txt", ".vbs", ".ini"]
                    for f in sub.rglob("*"):
                        if f.is_file() and f.suffix.lower() in config_extensions:
                            files_to_backup.append(f)

        # 4. Music folder
        music_dir = table_dir / "music"
        if music_dir.exists():
            for f in music_dir.rglob("*"):
                if f.is_file():
                    files_to_backup.append(f)

        if not files_to_backup:
            task_registry.fail_task(task_id, "No files found to backup")
            return {"success": False, "error": "No files found to backup"}

        task_registry.update_progress(task_id, 10, f"Found {len(files_to_backup)} files to package...")

        # Create snapshot directory
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        snapshot_id = timestamp
        target_dir = cls.SNAPSHOT_DIR / str(table_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        
        zip_path = target_dir / f"{timestamp}.zip"
        
        metadata = {
            "table_id": table_id,
            "table_name": table["display_name"],
            "timestamp": datetime.datetime.now().isoformat(),
            "label": label or "Manual Snapshot",
            "files": [str(f.relative_to(table_dir)) for f in files_to_backup]
        }

        try:
            task_registry.update_progress(task_id, 20, "Creating archive...")
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add metadata
                zipf.writestr("metadata.json", json.dumps(metadata, indent=4))
                
                total_files = len(files_to_backup)
                for i, f in enumerate(files_to_backup):
                    zipf.write(f, f.relative_to(table_dir))
                    # Progress from 20% to 100%
                    progress = 20 + int((i + 1) / total_files * 80)
                    if i % 5 == 0: # Update every 5 files to avoid spam
                        task_registry.update_progress(task_id, progress, f"Adding {f.name}...")

            task_registry.complete_task(task_id, "Snapshot created successfully")
            return {
                "success": True, 
                "snapshot_id": snapshot_id,
                "path": str(zip_path),
                "metadata": metadata
            }
        except Exception as e:
            logger.error(f"Failed to create snapshot for table {table_id}: {e}")
            task_registry.fail_task(task_id, str(e))
            return {"success": False, "error": str(e)}

    @classmethod
    async def list_snapshots(cls, table_id: int) -> List[Dict]:
        """List all snapshots for a specific table."""
        target_dir = cls.SNAPSHOT_DIR / str(table_id)
        if not target_dir.exists():
            return []

        snapshots = []
        for f in target_dir.glob("*.zip"):
            try:
                with zipfile.ZipFile(f, 'r') as zipf:
                    if "metadata.json" in zipf.namelist():
                        meta = json.loads(zipf.read("metadata.json").decode())
                        meta["id"] = f.stem
                        meta["size"] = f.stat().st_size
                        snapshots.append(meta)
            except Exception as e:
                logger.warning(f"Failed to read snapshot {f}: {e}")
        
        # Sort by timestamp descending
        snapshots.sort(key=lambda x: x["timestamp"], reverse=True)
        return snapshots

    @classmethod
    async def restore_snapshot(cls, table_id: int, snapshot_id: str, task_id: str = "snapshot_restore") -> Dict:
        """Restore a snapshot, overwriting current files."""
        task_registry.start_task(task_id, total=100, message="Opening archive...")
        
        table = await db.get_table(table_id)
        if not table:
            task_registry.fail_task(task_id, "Table not found")
            return {"success": False, "error": "Table not found"}

        table_dir = Path(table["folder_path"])
        zip_path = cls.SNAPSHOT_DIR / str(table_id) / f"{snapshot_id}.zip"
        
        if not zip_path.exists():
            task_registry.fail_task(task_id, "Snapshot not found")
            return {"success": False, "error": "Snapshot not found"}

        try:
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                all_files = [n for n in zipf.namelist() if n != "metadata.json"]
                total_files = len(all_files)
                
                task_registry.update_progress(task_id, 10, f"Extracting {total_files} files...")
                
                for i, name in enumerate(all_files):
                    zipf.extract(name, table_dir)
                    # Progress from 10% to 100%
                    progress = 10 + int((i + 1) / total_files * 90)
                    if i % 5 == 0:
                        task_registry.update_progress(task_id, progress, f"Restoring {name}...")
            
            task_registry.complete_task(task_id, "Restored successfully")
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to restore snapshot {snapshot_id} for table {table_id}: {e}")
            task_registry.fail_task(task_id, str(e))
            return {"success": False, "error": str(e)}

    @classmethod
    async def delete_snapshot(cls, table_id: int, snapshot_id: str) -> Dict:
        """Delete a snapshot file."""
        zip_path = cls.SNAPSHOT_DIR / str(table_id) / f"{snapshot_id}.zip"
        if zip_path.exists():
            try:
                zip_path.unlink()
                return {"success": True}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"success": False, "error": "Snapshot not found"}

    @classmethod
    async def delete_all_snapshots(cls) -> Dict:
        """Delete all snapshot files for all tables."""
        if cls.SNAPSHOT_DIR.exists():
            try:
                shutil.rmtree(cls.SNAPSHOT_DIR)
                cls.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
                return {"success": True}
            except Exception as e:
                logger.error(f"Failed to delete all snapshots: {e}")
                return {"success": False, "error": str(e)}
        return {"success": True}
