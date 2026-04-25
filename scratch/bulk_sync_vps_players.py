import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.append("/Users/macsobel/Coding/VPX Manager for ES-DE")

import database as db
from services.vps_matcher import vps_matcher
from services.gamelist_manager import GamelistManager
from config import config

async def bulk_sync_vps_players():
    print("Starting bulk sync of VPS player counts...")
    await db.init_db()
    
    # Ensure VPS is loaded
    if not vps_matcher._loaded:
        await vps_matcher._load_cached_async()
    
    tables = await db.get_tables(vps_matched=True, limit=1000)
    print(f"Found {len(tables)} VPS-matched tables.")
    
    gm = GamelistManager(str(config.get_gamelist_xml_path()))
    
    for table in tables:
        vps_id = table.get("vps_id")
        if not vps_id: continue
        
        entry = vps_matcher.get_entry(vps_id)
        if not entry: continue
        
        players = str(entry.get("players", "1"))
        print(f"Table: {table['display_name']} -> Players: {players}")
        
        # Update DB
        await db.upsert_table({
            "id": table["id"],
            "players": players
        })
        
        # Update Gamelist
        # Resolve folder name from physical path to ensure XML matching
        folder_name = Path(table["folder_path"]).name
        game_stem = Path(table["filename"]).stem
        rom_rel_path = f"./{folder_name}/{table['filename']}"
        
        gm.update_game(rom_rel_path, {"players": players})
        
    print("Bulk sync complete!")

if __name__ == "__main__":
    asyncio.run(bulk_sync_vps_players())
