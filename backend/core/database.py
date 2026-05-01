from __future__ import annotations

"""
SQLite database layer using aiosqlite.
Manages tables, media, and collections.
"""
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

import aiosqlite

from backend.core.config import config, relativize_path as _relativize_path

DB_PATH = config.db_path


def _expand_path(p: str | None) -> str:
    """Expand user-relative paths (~/) to absolute paths."""
    if not p:
        return ""
    return os.path.expanduser(p)


SCHEMA = """
CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    display_name TEXT NOT NULL,
    manufacturer TEXT DEFAULT '',
    year TEXT DEFAULT '',
    table_type TEXT DEFAULT '',
    vps_id TEXT DEFAULT '',
    ipdb_id TEXT DEFAULT '',
    vps_version TEXT DEFAULT '',
    vps_table_url TEXT DEFAULT '',
    version TEXT DEFAULT '',
    author TEXT DEFAULT '',
    vps_file_id TEXT DEFAULT '',
    ignored_version TEXT DEFAULT '',
    has_b2s INTEGER DEFAULT 0,
    has_rom INTEGER DEFAULT 0,
    has_pup INTEGER DEFAULT 0,
    has_altcolor INTEGER DEFAULT 0,
    has_altsound INTEGER DEFAULT 0,
    has_music INTEGER DEFAULT 0,
    folder_path TEXT DEFAULT '',
    date_added TEXT NOT NULL,
    rating INTEGER DEFAULT 0,
    theme TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    features TEXT DEFAULT '{}',
    vbs_hash TEXT DEFAULT '',
    ss_id TEXT DEFAULT '',
    has_manual INTEGER DEFAULT 0,
    mtime INTEGER DEFAULT 0,
    players TEXT DEFAULT '1',
    UNIQUE(filename)
);

CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT DEFAULT '',
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    filter_rules TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_tables (
    collection_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    PRIMARY KEY (collection_id, table_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tables_vps ON tables(vps_id);
CREATE INDEX IF NOT EXISTS idx_tables_name ON tables(display_name);
CREATE INDEX IF NOT EXISTS idx_media_table ON media(table_id);
"""

_shared_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    """Get a database connection."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    await db.execute("PRAGMA synchronous=NORMAL")
    return db


async def close_db():
    """No-op for compatibility, connections now close per-request."""
    pass


async def init_db():
    """Initialize the database schema and handle migrations."""
    db = await get_db()
    try:
        await db.executescript(SCHEMA)

        # Migration: Add columns if missing
        cursor = await db.execute("PRAGMA table_info(tables)")
        columns = [row[1] for row in await cursor.fetchall()]

        if "vps_version" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN vps_version TEXT DEFAULT ''"
            )
        if "vps_table_url" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN vps_table_url TEXT DEFAULT ''"
            )
        if "version" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN version TEXT DEFAULT ''")
        if "author" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN author TEXT DEFAULT ''")
        if "vps_file_id" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN vps_file_id TEXT DEFAULT ''"
            )
        if "ignored_version" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN ignored_version TEXT DEFAULT ''"
            )
        if "vbs_hash" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN vbs_hash TEXT DEFAULT ''")
        if "ss_id" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN ss_id TEXT DEFAULT ''")
        if "has_manual" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN has_manual INTEGER DEFAULT 0"
            )
        if "mtime" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN mtime INTEGER DEFAULT 0")
        if "has_pup" not in columns:
            await db.execute("ALTER TABLE tables ADD COLUMN has_pup INTEGER DEFAULT 0")
        if "has_altcolor" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN has_altcolor INTEGER DEFAULT 0"
            )
        if "has_altsound" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN has_altsound INTEGER DEFAULT 0"
            )
        if "has_music" not in columns:
            await db.execute(
                "ALTER TABLE tables ADD COLUMN has_music INTEGER DEFAULT 0"
            )
        try:
            await db.execute("ALTER TABLE tables ADD COLUMN theme TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # Column already exists

        try:
            await db.execute("ALTER TABLE tables ADD COLUMN players TEXT DEFAULT '1'")
        except sqlite3.OperationalError:
            pass

        # Migration: Relativize paths for portability
        await db.execute(
            "UPDATE tables SET folder_path = '~/ROMs/vpinball/' || SUBSTR(folder_path, INSTR(folder_path, '/ROMs/vpinball/') + 15) WHERE folder_path LIKE '%/ROMs/vpinball/%' AND folder_path NOT LIKE '~/%%'"
        )
        await db.execute(
            "UPDATE media SET file_path = '~/ROMs/vpinball/' || SUBSTR(file_path, INSTR(file_path, '/ROMs/vpinball/') + 15) WHERE file_path LIKE '%/ROMs/vpinball/%' AND file_path NOT LIKE '~/%%'"
        )

        await db.commit()
    finally:
        await db.close()


# ── Table CRUD ──────────────────────────────────────────────────────


async def upsert_table(data: dict) -> int:
    """Insert or update a table record. Returns the row id."""
    db = await get_db()
    try:
        table_id = data.get("id")
        row = None

        # 1. Check if exists by ID
        if table_id:
            cursor = await db.execute("SELECT id FROM tables WHERE id = ?", (table_id,))
            row = await cursor.fetchone()

        # 2. Check if exists by filename (if not found by ID or ID not provided)
        if not row and "filename" in data:
            cursor = await db.execute(
                "SELECT id FROM tables WHERE filename = ?", (data["filename"],)
            )
            row = await cursor.fetchone()
            if row:
                table_id = row[0]

        if row:
            # Update
            fields = {k: v for k, v in data.items() if k != "id"}
            if fields:
                # Relativize folder_path on update
                if "folder_path" in fields:
                    fields["folder_path"] = _relativize_path(fields["folder_path"])

                set_clause = ", ".join(f"{k} = ?" for k in fields)
                await db.execute(
                    f"UPDATE tables SET {set_clause} WHERE id = ?",
                    (*fields.values(), table_id),
                )
            await db.commit()
            return table_id
        else:
            # Insert
            data.setdefault("date_added", datetime.now().isoformat())
            if "filename" in data:
                data.setdefault("display_name", Path(data["filename"]).stem)

            # Relativize folder_path on save
            if "folder_path" in data:
                data["folder_path"] = _relativize_path(data["folder_path"])

            cols = ", ".join(data.keys())
            placeholders = ", ".join("?" for _ in data)
            cursor = await db.execute(
                f"INSERT INTO tables ({cols}) VALUES ({placeholders})",
                tuple(data.values()),
            )
            await db.commit()
            return cursor.lastrowid
    except Exception as e:
        await db.rollback()
        raise e
    finally:
        await db.close()


async def upsert_tables_batch(tables_data: list[dict]):
    """Batch upsert tables in a single transaction."""
    db = await get_db()
    try:
        # Use an INSERT OR REPLACE approach for SQLite to simplify batching
        # We need a fixed set of columns. We'll use the ones from the first item
        if not tables_data:
            return

        # Prepare data: relativize paths
        processed = []
        for d in tables_data:
            item = d.copy()
            if "folder_path" in item:
                item["folder_path"] = _relativize_path(item["folder_path"])
            if "date_added" not in item:
                item["date_added"] = datetime.now().isoformat()
            processed.append(item)

        # We'll do individual executes in one transaction for maximum safety with UNIQUE(filename)
        # as different items might have different subsets of columns
        for item in processed:
            filename = item.get("filename")
            if not filename:
                continue

            # Check existence (case-insensitive for macOS compatibility)
            cursor = await db.execute(
                "SELECT id FROM tables WHERE filename = ? COLLATE NOCASE", (filename,)
            )
            row = await cursor.fetchone()

            if row:
                # Update
                table_id = row[0]
                fields = {
                    k: v for k, v in item.items() if k != "id" and k != "filename"
                }
                if fields:
                    set_clause = ", ".join(f"{k} = ?" for k in fields)
                    await db.execute(
                        f"UPDATE tables SET {set_clause} WHERE id = ?",
                        (*fields.values(), table_id),
                    )
            else:
                # Insert
                cols = ", ".join(item.keys())
                placeholders = ", ".join("?" for _ in item)
                await db.execute(
                    f"INSERT INTO tables ({cols}) VALUES ({placeholders})",
                    tuple(item.values()),
                )

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e
    finally:
        await db.close()


async def get_tables(
    search: str = "",
    manufacturer: str = "",
    year: str = "",
    table_type: str = "",
    has_b2s: int | None = None,
    vps_matched: bool | None = None,
    collection_id: int | None = None,
    sort_by: str = "display_name",
    sort_dir: str = "asc",
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Fetch tables with filtering, sorting, and pagination."""
    db = await get_db()
    try:
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(display_name LIKE ? OR filename LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        if manufacturer:
            where_clauses.append("manufacturer = ?")
            params.append(manufacturer)
        if year:
            where_clauses.append("year = ?")
            params.append(year)
        if table_type:
            where_clauses.append("table_type = ?")
            params.append(table_type)
        if has_b2s is not None:
            where_clauses.append("has_b2s = ?")
            params.append(has_b2s)
        if vps_matched is True:
            where_clauses.append("vps_id != ''")
        elif vps_matched is False:
            where_clauses.append("(vps_id = '' OR vps_id IS NULL)")

        query_parts = ["SELECT t.* FROM tables t"]

        if collection_id is not None:
            query_parts.append("JOIN collection_tables ct ON ct.table_id = t.id")
            where_clauses.append("ct.collection_id = ?")
            params.append(collection_id)

        if where_clauses:
            query_parts.append("WHERE " + " AND ".join(where_clauses))

        allowed_sorts = {"display_name", "date_added", "manufacturer", "year", "rating"}
        sort_col = sort_by if sort_by in allowed_sorts else "display_name"
        direction = "DESC" if sort_dir.lower() == "desc" else "ASC"

        query_parts.append("ORDER BY t." + sort_col + " " + direction)
        query_parts.append("LIMIT ? OFFSET ?")
        params.extend([limit, offset])

        query = " ".join(query_parts)

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        results = [dict(r) for r in rows]
        for r in results:
            if r.get("folder_path"):
                r["folder_path"] = _expand_path(r["folder_path"])
                # Add calculated full path for convenience
                r["vpx_path"] = str(Path(r["folder_path"]) / r["filename"])
            else:
                r["vpx_path"] = r["filename"]
        return results
    finally:
        await db.close()


async def get_table(table_id: int) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tables WHERE id = ?", (table_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("folder_path"):
            res["folder_path"] = _expand_path(res["folder_path"])
            res["vpx_path"] = str(Path(res["folder_path"]) / res["filename"])
        else:
            res["vpx_path"] = res["filename"]
        return res
    finally:
        await db.close()


async def get_table_by_filename(filename: str) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM tables WHERE filename = ?", (filename,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("folder_path"):
            res["folder_path"] = _expand_path(res["folder_path"])
            res["vpx_path"] = str(Path(res["folder_path"]) / res["filename"])
        else:
            res["vpx_path"] = res["filename"]
        return res
    finally:
        await db.close()
async def get_table_by_path(full_path: str) -> dict | None:
    """Find a table by its full absolute path."""
    p = Path(full_path).expanduser()
    filename = p.name
    # Need to relativize the folder path to match DB storage
    folder_path = _relativize_path(str(p.parent))

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM tables WHERE filename = ? AND folder_path = ?",
            (filename, folder_path),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("folder_path"):
            res["folder_path"] = _expand_path(res["folder_path"])
            res["vpx_path"] = str(Path(res["folder_path"]) / res["filename"])
        else:
            res["vpx_path"] = res["filename"]
        return res
    finally:
        await db.close()


async def delete_table(table_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM tables WHERE id = ?", (table_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def get_table_count(search: str = "", vps_matched: bool | None = None) -> int:
    db = await get_db()
    try:
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(display_name LIKE ? OR filename LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

        if vps_matched is True:
            where_clauses.append("vps_id != ''")
        elif vps_matched is False:
            where_clauses.append("(vps_id = '' OR vps_id IS NULL)")

        query_parts = ["SELECT COUNT(*) FROM tables"]
        if where_clauses:
            query_parts.append("WHERE " + " AND ".join(where_clauses))

        query = " ".join(query_parts)
        cursor = await db.execute(query, params)
        row = await cursor.fetchone()
        return row[0]
    finally:
        await db.close()


async def get_distinct_values(column: str) -> list[str]:
    """Get distinct values for a column (for filter dropdowns)."""
    allowed = {"manufacturer", "year", "table_type"}
    if column not in allowed:
        return []
    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT DISTINCT {column} FROM tables WHERE {column} != '' ORDER BY {column}"
        )
        rows = await cursor.fetchall()
        return [row[0] for row in rows]
    finally:
        await db.close()


# ── Media CRUD ──────────────────────────────────────────────────────


async def upsert_media(
    table_id: int, media_type: str, file_path: str, thumbnail_path: str = ""
) -> int:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM media WHERE table_id = ? AND media_type = ?",
            (table_id, media_type),
        )
        row = await cursor.fetchone()
        if row:
            await db.execute(
                "UPDATE media SET file_path = ?, thumbnail_path = ? WHERE id = ?",
                (_relativize_path(file_path), thumbnail_path, row[0]),
            )
            await db.commit()
            return row[0]
        else:
            # Use raw file_path from DB
            cursor = await db.execute(
                "INSERT INTO media (table_id, media_type, file_path, thumbnail_path) VALUES (?, ?, ?, ?)",
                (table_id, media_type, _relativize_path(file_path), thumbnail_path),
            )
            await db.commit()
            return cursor.lastrowid
    finally:
        await db.close()


async def get_media_for_table(table_id: int) -> list[dict]:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM media WHERE table_id = ?", (table_id,))
        rows = await cursor.fetchall()
        results = [dict(r) for r in rows]
        for r in results:
            if r.get("file_path"):
                r["file_path"] = _expand_path(r["file_path"])
        return results
    finally:
        await db.close()


# ── Collection CRUD ─────────────────────────────────────────────────


async def create_collection(
    name: str, description: str = "", filter_rules: dict = None
) -> int:
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO collections (name, description, filter_rules, created_at) VALUES (?, ?, ?, ?)",
            (
                name,
                description,
                json.dumps(filter_rules or {}),
                datetime.now().isoformat(),
            ),
        )
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()


async def get_collections() -> list[dict]:
    db = await get_db()
    try:
        query = """
            SELECT c.*, COUNT(ct.table_id) as table_count
            FROM collections c
            LEFT JOIN collection_tables ct ON c.id = ct.collection_id
            GROUP BY c.id
            ORDER BY c.name
        """
        cursor = await db.execute(query)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_collection(collection_id: int) -> dict | None:
    db = await get_db()
    try:
        query = """
            SELECT c.*, COUNT(ct.table_id) as table_count
            FROM collections c
            LEFT JOIN collection_tables ct ON c.id = ct.collection_id
            WHERE c.id = ?
            GROUP BY c.id
        """
        cursor = await db.execute(query, (collection_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def update_collection(
    collection_id: int,
    name: str = None,
    description: str = None,
    filter_rules: dict = None,
) -> bool:
    db = await get_db()
    try:
        fields = {}
        if name is not None:
            fields["name"] = name
        if description is not None:
            fields["description"] = description
        if filter_rules is not None:
            fields["filter_rules"] = json.dumps(filter_rules)
        if not fields:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        cursor = await db.execute(
            f"UPDATE collections SET {set_clause} WHERE id = ?",
            (*fields.values(), collection_id),
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def delete_collection(collection_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM collections WHERE id = ?", (collection_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def add_table_to_collection(collection_id: int, table_id: int) -> bool:
    db = await get_db()
    try:
        await db.execute(
            "INSERT OR IGNORE INTO collection_tables (collection_id, table_id) VALUES (?, ?)",
            (collection_id, table_id),
        )
        await db.commit()
        return True
    except Exception:
        return False
    finally:
        await db.close()


async def remove_table_from_collection(collection_id: int, table_id: int) -> bool:
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM collection_tables WHERE collection_id = ? AND table_id = ?",
            (collection_id, table_id),
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()
