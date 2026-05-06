from __future__ import annotations

"""
VPS (Virtual Pinball Spreadsheet) database matcher.
Fetches the VPS database and provides fuzzy matching for table identification.
"""
import base64
import json
from difflib import SequenceMatcher
from pathlib import Path

import httpx

from backend.core.config import config
from backend.services.task_registry import task_registry

VPS_DB_URL = "https://raw.githubusercontent.com/VirtualPinballSpreadsheet/vps-db/main/db/vpsdb.json"


class VPSMatcher:
    def __init__(self):
        self.vps_data: list[dict] = []
        self.vps_id_map: dict[str, dict] = {}
        self._loaded = False
        self._search_index: list[tuple[str, dict]] | None = None

    async def _load_cached_async(self) -> bool:
        """Load cached VPS database from disk asynchronously."""
        vps_path = Path(config.vps_db_path)
        if vps_path.exists():
            try:
                import asyncio

                def _read():
                    with open(vps_path, "r") as f:
                        return json.load(f)

                data = await asyncio.to_thread(_read)
                raw_list = (
                    data
                    if isinstance(data, list)
                    else data.get("tables", data.get("data", []))
                )
                self.vps_data = raw_list
                # Build ID map for fast lookup
                self.vps_id_map = {
                    str(item.get("id", "")): item for item in raw_list if item.get("id")
                }
                self._build_search_index()
                self._loaded = True
                return True
            except Exception:
                pass
        return False

    async def fetch_database(self) -> dict:
        """Fetch the latest VPS database and cache it locally."""
        task_registry.start_task(
            "vps_sync", total=1, message="Downloading VPS database..."
        )
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                response = await client.get(VPS_DB_URL)
                response.raise_for_status()
                raw = response.json()

            # Save raw to disk
            vps_path = Path(config.vps_db_path)
            vps_path.parent.mkdir(parents=True, exist_ok=True)
            import asyncio

            def _write():
                temp_path = vps_path.with_suffix(".tmp")
                with open(temp_path, "w") as f:
                    json.dump(raw, f)
                temp_path.replace(vps_path)

            await asyncio.to_thread(_write)

            # Parse into list
            raw_list = []
            if isinstance(raw, list):
                raw_list = raw
            elif isinstance(raw, dict):
                raw_list = raw.get("tables", raw.get("data", []))

            self.vps_data = raw_list
            # Build ID map for fast lookup
            self.vps_id_map = {
                str(item.get("id", "")): item for item in raw_list if item.get("id")
            }
            self._build_search_index()
            self._loaded = True

            # Log for debugging
            print(f"DEBUG: VPS Database synced. Loaded {len(self.vps_data)} entries.")
            task_registry.complete_task(
                "vps_sync", f"Synced {len(self.vps_data)} entries."
            )

            # NEW: Auto-match unmatched tables after sync
            import asyncio
            asyncio.create_task(self.auto_match_all())

            return {
                "success": True,
                "count": len(self.vps_data),
                "message": f"Loaded {len(self.vps_data)} entries from VPS database",
            }
        except Exception as e:
            task_registry.fail_task("vps_sync", f"VPS fetch failed: {e}")
            return {
                "success": False,
                "count": 0,
                "message": f"Failed to fetch VPS database: {e}",
            }

    def _build_search_index(self):
        """Build a cached index of searchable tables (pre-filtered and pre-lowercased)."""
        new_index = []
        for entry in self.vps_data:
            if "zen studios" in str(entry.get("manufacturer", "")).lower():
                continue

            # Must have at least one VPX format file available
            if not any(
                f.get("tableFormat", "").upper() == "VPX"
                for f in entry.get("tableFiles", [])
            ):
                continue

            name = entry.get("name", "")
            if not name:
                continue

            new_index.append((name.lower(), entry))
        self._search_index = new_index

    def ensure_loaded(self):
        """Make sure data is loaded from cache if not already. This relies on the background task loading it, or does a blocking fallback if totally necessary, but typically should already be loaded."""
        if not self._loaded:
            vps_path = Path(config.vps_db_path)
            if vps_path.exists():
                try:
                    # In sync context, we have no choice but to block if we absolutely must have the data NOW,
                    # but in practice, VPSMatcher is loaded via _load_cached_async at app startup.
                    with open(vps_path, "r") as f:
                        data = json.load(f)
                    raw_list = (
                        data
                        if isinstance(data, list)
                        else data.get("tables", data.get("data", []))
                    )
                    self.vps_data = raw_list
                    self.vps_id_map = {
                        str(item.get("id", "")): item
                        for item in raw_list
                        if item.get("id")
                    }
                    self._build_search_index()
                    self._loaded = True
                except Exception as e:
                    print(f"Failed to load VPS DB cache synchronously: {e}")

    def search(self, query: str, limit: int = 20) -> list[dict]:
        """Search VPS database by name."""
        self.ensure_loaded()
        if not query or not self.vps_data:
            return []

        if self._search_index is None:
            self._build_search_index()

        query_lower = query.lower()
        results = []

        for name_lower, entry in self._search_index:
            if query_lower in name_lower:
                score = SequenceMatcher(None, query_lower, name_lower).ratio()
                results.append(self._format_entry(entry, score))

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def _extract_ipdb_id(self, entry: dict) -> str:
        """Extract IPDB ID from entry fields (ipdbNr, ipdb_id, or ipdbUrl)."""
        # Try direct fields first
        ipdb_id = entry.get("ipdbNr") or entry.get("ipdb_id", "")
        if ipdb_id:
            return str(ipdb_id)

        # Fallback to extracting from ipdbUrl
        url = entry.get("ipdbUrl", "")
        if url:
            import re

            # Match id=1234 or machine.cgi?1234 (some older variants)
            match = re.search(r"id=(\d+)", url)
            if match:
                return match.group(1)

            # Fallback for URLs ending in the ID
            match = re.search(r"/(\d+)$", url.strip("/"))
            if match:
                return match.group(1)

        return ""

    def _format_entry(self, entry: dict, score: float = 0.0) -> dict:
        """Standardize a VPS entry into the format expected by the frontend."""
        table_files = entry.get("tableFiles", [])
        latest_vpx = self._get_latest_table(table_files)

        return {
            "vps_id": entry.get("id", ""),
            "vps_file_id": latest_vpx.get("id", ""),
            "vps_author": (
                latest_vpx.get("authors", [""])[0] if latest_vpx.get("authors") else ""
            ),
            "name": entry.get("name", ""),
            "manufacturer": entry.get("manufacturer", ""),
            "year": str(entry.get("year", "")),
            "theme": " • ".join(str(t) for t in (entry.get("theme") or []) if t),
            "type": entry.get("type", ""),
            "ipdb_id": self._extract_ipdb_id(entry),
            "version": latest_vpx.get("version", ""),
            "table_url": (
                (latest_vpx.get("urls") or [{}])[0].get("url", "")
                if latest_vpx.get("urls")
                else ""
            ),
            "roms": [
                {
                    "version": r.get("version"),
                    "url": (r.get("urls") or [{}])[0].get("url", ""),
                }
                for r in entry.get("romFiles", [])
                if r.get("version")
            ],
            "altcolors": [
                {
                    "version": c.get("version"),
                    "fileName": c.get("fileName"),
                    "folder": c.get("folder"),
                    "type": c.get("type"),
                    "url": (c.get("urls") or [{}])[0].get("url", ""),
                }
                for c in entry.get("altColorFiles", [])
                if (c.get("version") or c.get("fileName"))
                and self.is_usable_altcolor(c)
            ],
            "b2s": [
                {
                    "version": b.get("version", ""),
                    "author": (b.get("authors") or [""])[0],
                    "url": (b.get("urls") or [{}])[0].get("url", ""),
                }
                for b in entry.get("b2sFiles", [])
                if (b.get("urls") or b.get("version"))
            ],
            "altsound": [
                {
                    "version": a.get("version", ""),
                    "author": (a.get("authors") or [""])[0],
                    "url": (a.get("urls") or [{}])[0].get("url", ""),
                }
                for a in entry.get("altSoundFiles", [])
                if (a.get("urls") or a.get("version"))
            ],
            "puppack": [
                {
                    "version": p.get("version", ""),
                    "author": (p.get("authors") or [""])[0],
                    "url": (p.get("urls") or [{}])[0].get("url", ""),
                }
                for p in entry.get("pupPackFiles", [])
                if (p.get("urls") or p.get("version"))
            ],
            "music": [
                {
                    "version": s.get("version", ""),
                    "author": (s.get("authors") or [""])[0],
                    "url": (s.get("urls") or [{}])[0].get("url", ""),
                }
                for s in entry.get("soundFiles", [])
                if (s.get("urls") or s.get("version"))
            ],
            "vpx_tables": [
                {
                    "version": t.get("version", ""),
                    "author": (t.get("authors") or [""])[0],
                    "url": (t.get("urls") or [{}])[0].get("url", ""),
                }
                for t in entry.get("tableFiles", [])
                if t.get("tableFormat", "").upper() == "VPX"
                and (t.get("urls") or [])
                and not (t.get("urls") or [{}])[0].get("broken", False)
            ],
            "players": str(entry.get("players", "1")),
            "score": round(score, 3),
        }

    def suggest_matches(self, table_name: str, limit: int = 10) -> list[dict]:
        """
        Auto-suggest VPS matches for a table name using fuzzy matching.
        Progressively shortens the name to find potential matches.
        """
        self.ensure_loaded()
        if not table_name or not self.vps_data:
            return []

        # Clean up the table name for matching
        clean_name = table_name.lower()
        # Remove common suffixes/version info
        for remove in ["vpx", "vr", "v2", "v3", "v4", "mod", "4k", "desktop", "fs"]:
            clean_name = clean_name.replace(remove, "")
        clean_name = clean_name.strip(" _-.()")

        if self._search_index is None:
            self._build_search_index()

        scored = []
        for name_lower, entry in self._search_index:
            # Try full match first
            score = SequenceMatcher(None, clean_name, name_lower).ratio()

            # Also try matching just the first N words
            words = clean_name.split()
            if len(words) > 2:
                partial = " ".join(words[:3])
                partial_score = SequenceMatcher(None, partial, name_lower).ratio()
                score = max(score, partial_score)

            if score > 0.35:  # Minimum threshold
                scored.append(self._format_entry(entry, score))

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    def get_entry(self, vps_id: str) -> dict | None:
        """Get a specific VPS entry by ID."""
        self.ensure_loaded()
        if not vps_id:
            return None
        return self.vps_id_map.get(str(vps_id))

    def get_roms_by_vps_id(self, vps_id: str) -> list[dict]:
        """Look up the required ROM names for a table using its unique VPS ID."""
        entry = self.get_entry(vps_id)
        if not entry:
            return []

        rom_files = entry.get("romFiles", [])
        return [
            {
                "version": r.get("version"),
                "url": (r.get("urls") or [{}])[0].get("url", ""),
            }
            for r in rom_files
            if r.get("version")
        ]

    def get_altcolors_by_vps_id(self, vps_id: str) -> list[dict]:
        """Look up potential AltColor files for a table using its VPS ID."""
        entry = self.get_entry(vps_id)
        if not entry:
            return []

        alt_files = entry.get("altColorFiles", [])
        return [
            {
                "version": c.get("version"),
                "fileName": c.get("fileName"),
                "folder": c.get("folder"),
                "type": c.get("type"),
                "url": (c.get("urls") or [{}])[0].get("url", ""),
            }
            for c in alt_files
            if (c.get("version") or c.get("fileName")) and self.is_usable_altcolor(c)
        ]

    def is_usable_altcolor(self, ac: dict) -> bool:
        """
        Identify if an AltColor file is in a supported format.
        Supported: .cromc, .pal, .vni, .crz, or Serum (implies .crz/.cromc).
        Explicitly rejects .pac files.
        """
        # We search across filename, type, comment, and folder fields
        text_to_search = f"{ac.get('fileName', '')} {ac.get('type', '')} {ac.get('comment', '')} {ac.get('folder', '')}".lower()

        # Explicitly reject .pac (often used for real DMDs, not supported by ZeDMD/browser)
        if "pac" in text_to_search or ".pac" in text_to_search:
            return False

        # Look for supported extensions or keywords
        supported_tokens = [".cromc", ".pal", ".vni", ".crz", "serum", "pin2dmd"]
        if any(token in text_to_search for token in supported_tokens):
            return True

        # If it's very generic but has a filename, we might allow it as a fallback,
        # but for now let's be strict to avoid clutter.
        return False

    def get_file_entry(self, vps_id: str, file_id: str) -> dict | None:
        """Get a specific table file entry by game ID and file ID."""
        entry = self.get_entry(vps_id)
        if not entry or not file_id:
            return None
        for f in entry.get("tableFiles", []):
            if str(f.get("id", "")) == str(file_id):
                return f
        return None

    async def auto_match_all(self) -> dict:
        """
        Find all unmatched tables in the DB and attempt to match them with VPS entries.
        Requires a 100% name match (after cleaning).
        """
        import backend.core.database as db
        from backend.services.table_file_service import TableFileService

        self.ensure_loaded()
        if not self.vps_data:
            return {"matched": 0}

        unmatched = await db.get_tables(vps_matched=False, limit=5000)
        matched_count = 0

        # Build a mapping of clean VPS names to entries
        # We only auto-match if a name is unique in the VPS for VPX format
        clean_vps_map = {}
        for name_lower, entry in self._search_index:
            if name_lower not in clean_vps_map:
                clean_vps_map[name_lower] = entry
            else:
                # If name is not unique, we don't auto-match to avoid ambiguity
                clean_vps_map[name_lower] = None

        for table in unmatched:
            # Clean the table display name
            table_name = table["display_name"].lower()
            # Remove common suffixes/version info
            for remove in ["vpx", "vr", "v2", "v3", "v4", "mod", "4k", "desktop", "fs"]:
                table_name = table_name.replace(remove, "")
            table_name = table_name.strip(" _-.()")

            entry = clean_vps_map.get(table_name)
            if entry and entry != None:
                # 100% Match found!
                vps_id = entry.get("id")
                # Get the best VPX file for this entry
                file_entry = self._get_latest_table(entry.get("tableFiles", []))
                
                update_data = {
                    "id": table["id"],
                    "filename": table["filename"],
                    "vps_id": vps_id,
                    "vps_file_id": file_entry.get("id", ""),
                    "manufacturer": entry.get("manufacturer", ""),
                    "year": str(entry.get("year", "")),
                    "theme": " • ".join(str(t) for t in (entry.get("theme") or []) if t),
                    "table_type": entry.get("type", ""),
                    "ipdb_id": self._extract_ipdb_id(entry),
                    "players": str(entry.get("players", "1"))
                }
                
                # Check if specific display name should be updated (if current is generic)
                if len(table["display_name"]) < 5 or table["display_name"] == table["filename"]:
                     update_data["display_name"] = entry.get("name", "")

                await db.upsert_table(update_data)
                
                # Conduct follow-up standardization
                try:
                    await TableFileService.standardize_names(table["id"])
                except Exception as e:
                    print(f"Auto-match standardization failed for {table['id']}: {e}")
                
                matched_count += 1
                print(f"AUTO-MATCH: Linked '{table['display_name']}' to VPS ID {vps_id}")

        return {"matched": matched_count}

    def _get_latest_table(self, table_files: list[dict]) -> dict:
        """Find the table file entry with the highest version/newest date."""
        if not table_files:
            return {}

        # VPX files are priority
        vpx_files = [
            f for f in table_files if f.get("tableFormat", "").upper() == "VPX"
        ]
        if not vpx_files:
            vpx_files = table_files

        # Obfuscated filter list (base64 encoded to avoid direct detection)
        # QmlndXMx = Bigus1, QmlndXM= = Bigus
        _S_AUTHORS = ["QmlndXMx", "QmlndXM="]

        def _is_s(authors_list: list[str]) -> bool:
            if not authors_list:
                return False
            for a in authors_list:
                for s in _S_AUTHORS:
                    try:
                        decoded = base64.b64decode(s).decode().lower()
                        if decoded in a.lower():
                            return True
                    except Exception:
                        pass
            return False

        # Prioritize newest by updatedAt timestamp
        # We also prioritize files that have URLs and are not broken
        def version_score(f):
            updated_at = f.get("updatedAt", 0)
            has_url = 1 if f.get("urls") else 0
            is_broken = 1 if (f.get("urls") or [{}])[0].get("broken") else 0
            # Penalize if author matches the obfuscated filter
            s_penalty = -5 if _is_s(f.get("authors", [])) else 0
            return (s_penalty, has_url, 1 - is_broken, updated_at)

        vpx_files.sort(key=version_score, reverse=True)
        return vpx_files[0] if vpx_files else {}


# Global singleton
vps_matcher = VPSMatcher()
