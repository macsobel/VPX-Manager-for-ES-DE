
import asyncio
import sqlite3
import os
from pathlib import Path

async def check_table():
    db_path = Path.home() / "Library" / "Application Support" / "VPX Manager for ES-DE" / "vpxmanager.db"
    if not db_path.exists():
        print(f"DB not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("--- Searching for Back to the Future ---")
    cursor.execute("SELECT id, filename, display_name, manufacturer, year, vps_id FROM tables WHERE display_name LIKE '%Back to the Future%' OR filename LIKE '%Back to the Future%'")
    rows = cursor.fetchall()
    
    if not rows:
        print("No matching tables found.")
    else:
        for row in rows:
            print(dict(row))
    
    conn.close()

if __name__ == "__main__":
    asyncio.run(check_table())
