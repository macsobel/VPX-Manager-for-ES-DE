import logging
import os
import platform
import re
from pathlib import Path
from typing import List, Set

import backend.core.database as db
from backend.core.config import config

logger = logging.getLogger(__name__)

class ESDESyncService:
    def __init__(self):
        self.collections_dir = self._get_collections_dir()
        if not self.collections_dir.exists():
            try:
                self.collections_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                logger.error(f"Could not create ES-DE collections directory: {e}")

    def _get_collections_dir(self) -> Path:
        """Locate the ES-DE custom collections directory."""
        if platform.system() == "Darwin":
            # Check both standard and hidden locations for macOS
            path = Path.home() / "Library" / "Application Support" / "ES-DE" / "collections"
            if not path.exists():
                path = Path.home() / ".emulationstation" / "collections"
            return path
        else:
            # Default for Linux/Others
            return Path.home() / ".emulationstation" / "collections"

    def _sanitize_filename(self, name: str) -> str:
        """Sanitize collection name for filesystem usage."""
        # Remove non-alphanumeric except spaces/dashes/underscores
        name = re.sub(r'[^\w\s-]', '', name)
        return name.strip().replace(' ', '_')

    async def export_to_esde(self, collection_id: int):
        """Write a database collection to an ES-DE .cfg file."""
        try:
            collection = await db.get_collection(collection_id)
            if not collection:
                return

            tables = await db.get_tables(collection_id=collection_id, limit=1000)
            if not tables:
                # If collection exists in ES-DE but is now empty in DB, remove the file
                # unless we want to keep empty files. ES-DE usually ignores empty .cfg
                # We'll remove it to keep it clean.
                await self.delete_from_esde(collection["name"])
                return

            safe_name = self._sanitize_filename(collection["name"])
            file_path = self.collections_dir / f"custom-{safe_name}.cfg"

            # Prepare content: one absolute path per line
            paths = []
            for t in tables:
                vpx_path = t.get("vpx_path")
                if vpx_path:
                    # Ensure path is absolute and expanded
                    p = Path(vpx_path).expanduser()
                    if p.exists():
                        paths.append(str(p))

            if paths:
                file_path.write_text("\n".join(paths) + "\n")
                logger.info(f"Exported collection '{collection['name']}' to {file_path}")
            else:
                if file_path.exists():
                    file_path.unlink()

        except Exception as e:
            logger.error(f"Failed to export collection {collection_id} to ES-DE: {e}")

    async def delete_from_esde(self, collection_name: str):
        """Remove the .cfg file associated with a deleted collection."""
        try:
            safe_name = self._sanitize_filename(collection_name)
            file_path = self.collections_dir / f"custom-{safe_name}.cfg"
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted ES-DE collection file: {file_path}")
        except Exception as e:
            logger.error(f"Failed to delete ES-DE collection file for '{collection_name}': {e}")

    async def import_from_esde(self):
        """Scan ES-DE folder and update database collections."""
        try:
            if not self.collections_dir.exists():
                return

            cfg_files = list(self.collections_dir.glob("custom-*.cfg"))
            if not cfg_files:
                return

            # Get existing collections to compare
            existing_collections = await db.get_collections()
            # Map name -> id
            collection_map = {c["name"]: c["id"] for c in existing_collections}

            for cfg in cfg_files:
                # Extract name: custom-My_Collection.cfg -> My Collection
                name = cfg.stem.replace("custom-", "").replace("_", " ")
                
                # 1. Ensure collection exists in DB
                if name not in collection_map:
                    collection_id = await db.create_collection(name=name, description="Imported from ES-DE")
                    collection_map[name] = collection_id
                    logger.info(f"Created new collection '{name}' from ES-DE import")
                else:
                    collection_id = collection_map[name]

                # 2. Sync tables in collection
                lines = cfg.read_text().splitlines()
                paths_in_cfg = {line.strip() for line in lines if line.strip()}
                
                # Get current tables in DB collection
                db_tables = await db.get_tables(collection_id=collection_id, limit=2000)
                paths_in_db = {t["vpx_path"] for t in db_tables if t.get("vpx_path")}

                # Add missing tables
                for path in paths_in_cfg:
                    if path not in paths_in_db:
                        # Find table by path
                        table = await db.get_table_by_path(path)
                        if table:
                            await db.add_table_to_collection(collection_id, table["id"])
                            logger.info(f"Added '{table['name']}' to collection '{name}' via ES-DE sync")

                # Remove tables NOT in CFG (True bi-directional sync)
                # If we want VPX Manager to be the master, we might skip this.
                # But the user said "reflected... and vice versa", so we should remove.
                for t in db_tables:
                    if t.get("vpx_path") not in paths_in_cfg:
                        await db.remove_table_from_collection(collection_id, t["id"])
                        logger.info(f"Removed '{t['name']}' from collection '{name}' via ES-DE sync")

        except Exception as e:
            logger.error(f"Failed to import collections from ES-DE: {e}")

    async def sync_all(self):
        """Full bi-directional sync."""
        logger.info("Starting bi-directional ES-DE collection sync...")
        # 1. Import from ES-DE first (it might have newer data if user edited files)
        await self.import_from_esde()
        
        # 2. Export all back to ES-DE to ensure files are up to date
        collections = await db.get_collections()
        for c in collections:
            await self.export_to_esde(c["id"])
        
        logger.info("ES-DE collection sync complete.")

esde_sync = ESDESyncService()
