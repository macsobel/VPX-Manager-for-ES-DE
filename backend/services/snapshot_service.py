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

logger = logging.getLogger(__name__)

class SnapshotService:
    SNAPSHOT_DIR = Path(APP_SUPPORT_DIR) / "Snapshots"

    @classmethod
    async def create_snapshot(cls, table_id: int, label: str = None) -> Dict:
        """Create a snapshot of the table's core files."""
        table = await db.get_table(table_id)
        if not table:
            return {"success": False, "error": "Table not found"}

        table_dir = Path(table["folder_path"])
        if not table_dir.exists():
            return {"success": False, "error": "Table folder not found"}

        # Define files to include
        files_to_backup = []
        
        # 1. Core Table Files in root
        stem = Path(table["filename"]).stem
        for ext in [".vpx", ".vbs", ".pov", ".ini"]:
            p = table_dir / f"{stem}{ext}"
            if p.exists():
                files_to_backup.append(p)

        # 2. PuP Pack "Brain"
        pup_dir = table_dir / "pupvideos"
        if pup_dir.exists():
            # Find the specific table folder in pupvideos
            # Often it matches the stem or is a subfolder
            for sub in pup_dir.iterdir():
                if sub.is_dir():
                    # Check for screens.pup
                    screens_pup = sub / "screens.pup"
                    if screens_pup.exists():
                        files_to_backup.append(screens_pup)
                        # Also grab script.pup and .bat files
                        script_pup = sub / "script.pup"
                        if script_pup.exists():
                            files_to_backup.append(script_pup)
                        
                        for bat in sub.glob("*.bat"):
                            files_to_backup.append(bat)

        if not files_to_backup:
            return {"success": False, "error": "No files found to backup"}

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
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add metadata
                zipf.writestr("metadata.json", json.dumps(metadata, indent=4))
                
                # Add files
                for f in files_to_backup:
                    zipf.write(f, f.relative_to(table_dir))

            return {
                "success": True, 
                "snapshot_id": snapshot_id,
                "path": str(zip_path),
                "metadata": metadata
            }
        except Exception as e:
            logger.error(f"Failed to create snapshot for table {table_id}: {e}")
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
    async def restore_snapshot(cls, table_id: int, snapshot_id: str) -> Dict:
        """Restore a snapshot, overwriting current files."""
        table = await db.get_table(table_id)
        if not table:
            return {"success": False, "error": "Table not found"}

        table_dir = Path(table["folder_path"])
        zip_path = cls.SNAPSHOT_DIR / str(table_id) / f"{snapshot_id}.zip"
        
        if not zip_path.exists():
            return {"success": False, "error": "Snapshot not found"}

        try:
            # Pre-restore safety: we could backup the CURRENT state here too?
            # For now, let's just restore.
            with zipfile.ZipFile(zip_path, 'r') as zipf:
                # Extract all files EXCEPT metadata.json
                for name in zipf.namelist():
                    if name == "metadata.json":
                        continue
                    zipf.extract(name, table_dir)
            
            return {"success": True}
        except Exception as e:
            logger.error(f"Failed to restore snapshot {snapshot_id} for table {table_id}: {e}")
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
