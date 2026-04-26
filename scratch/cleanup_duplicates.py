
import asyncio
import sqlite3
import os
from pathlib import Path

async def cleanup_duplicates():
    db_path = Path.home() / "Library" / "Application Support" / "VPX Manager for ES-DE" / "vpxmanager.db"
    if not db_path.exists():
        print(f"DB not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("--- Searching for Duplicates ---")
    # Find all tables with the same display_name or filename (case-insensitive)
    cursor.execute("""
        SELECT id, filename, display_name, vps_id 
        FROM tables 
        WHERE display_name LIKE '%Back to the Future%'
    """)
    rows = cursor.fetchall()
    
    if len(rows) <= 1:
        print(f"Only {len(rows)} rows found. No duplicates to merge.")
        conn.close()
        return

    print(f"Found {len(rows)} candidates:")
    for row in rows:
        print(f"  ID: {row['id']}, Filename: {row['filename']}, VPS ID: '{row['vps_id']}'")

    # Strategy: Keep the one with a VPS ID. If both have/neither have, keep the oldest (lower ID).
    rows_with_vps = [r for r in rows if r['vps_id'] and r['vps_id'] != '']
    
    if rows_with_vps:
        keep_row = rows_with_vps[0]
        delete_rows = [r for r in rows if r['id'] != keep_row['id']]
    else:
        # Fallback to oldest
        rows_sorted = sorted(rows, key=lambda x: x['id'])
        keep_row = rows_sorted[0]
        delete_rows = rows_sorted[1:]

    print(f"\nDECISION: Keeping ID {keep_row['id']}, Deleting IDs {[r['id'] for r in delete_rows]}")
    
    for r in delete_rows:
        cursor.execute("DELETE FROM tables WHERE id = ?", (r['id'],))
        cursor.execute("DELETE FROM media WHERE table_id = ?", (r['id'],))
        print(f"  Deleted ID {r['id']}")

    conn.commit()
    conn.close()
    print("\nCleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup_duplicates())
