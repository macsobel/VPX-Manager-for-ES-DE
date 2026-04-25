import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.append("/Users/macsobel/Coding/VPX Manager for ES-DE")

import database as db
from services.gamelist_manager import GamelistManager
from config import config

async def fix_multiword_manufacturers():
    print("Fixing multi-word manufacturers in DB and gamelist.xml...")
    await db.init_db()
    
    tables = await db.get_tables(limit=2000)
    print(f"Checking {len(tables)} tables.")
    
    gm = GamelistManager(str(config.get_gamelist_xml_path()))
    
    for table in tables:
        display_name = table.get("display_name", "")
        if not "(" in display_name: continue
        
        # Extract correct multi-word manufacturer
        parts = display_name.split("(")
        meta_str = parts[-1].rstrip(")")
        tokens = meta_str.split()
        m_parts = []
        year = table.get("year", "")
        for t in tokens:
            if t.isdigit() and len(t) == 4:
                year = t
            else:
                m_parts.append(t)
        
        if not m_parts: continue
        manufacturer = " ".join(m_parts)
        
        # If it changed, update!
        if manufacturer != table.get("manufacturer"):
            print(f"Updating: {table['display_name']} -> {manufacturer}")
            
            # Update DB
            await db.upsert_table({
                "id": table["id"],
                "manufacturer": manufacturer
            })
            
            # Update Gamelist
            folder_name = Path(table["folder_path"]).name
            rom_rel_path = f"./{folder_name}/{table['filename']}"
            
            # Remember our new multi-sync logic: 
            # manufacturer -> developer, publisher, genre
            gm.update_game(rom_rel_path, {
                "manufacturer": manufacturer,
                "publisher": manufacturer,
                "genre": manufacturer
            })
            
    print("Repair complete!")

if __name__ == "__main__":
    asyncio.run(fix_multiword_manufacturers())
