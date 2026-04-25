import json
from pathlib import Path
import os
import platform

# Detect support dir matching config.py
if platform.system() == "Darwin":
    APP_SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "VPX Manager for ES-DE"
else:
    APP_SUPPORT_DIR = Path(__file__).parent / "app_data"

CONFIG_FILE = APP_SUPPORT_DIR / "vpx_manager.json"

def reset_media_preferences():
    if not CONFIG_FILE.exists():
        print("No user config found. Nothing to reset.")
        return

    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
        
        # Hardcoded defaults matching our new config.py
        new_defaults = {
            "covers": [
                {"source": "vpinmediadb",  "key": "wheel.png"},
                {"source": "screenscraper", "key": "wheel-tarcisios"},
                {"source": "screenscraper", "key": "wheel"},
            ],
            "fanart": [
                {"source": "vpinmediadb",  "key": "1k/bg.png"},
                {"source": "vpinmediadb",  "key": "1k/table.png"},
                {"source": "vpinmediadb",  "key": "4k/table.png"},
            ],
            "manuals": [
                {"source": "screenscraper", "key": "manuel"},
            ],
            "marquees": [
                {"source": "screenscraper", "key": "wheel"},
                {"source": "vpinmediadb",  "key": "wheel.png"},
            ],
            "screenshots": [
                {"source": "vpinmediadb",  "key": "1k/table.png"},
                {"source": "vpinmediadb",  "key": "4k/table.png"},
                {"source": "screenscraper", "key": "ss"},
            ],
            "videos": [
                {"source": "vpinmediadb",  "key": "1k/video.mp4"},
                {"source": "screenscraper", "key": "videotable"},
                {"source": "screenscraper", "key": "video-normalized"},
            ]
        }
        
        data["media_preferences"] = new_defaults
        
        with open(CONFIG_FILE, "w") as f:
            json.dump(data, f, indent=4)
        
        print("Successfully reset media preferences in user config!")
    except Exception as e:
        print(f"Error resetting config: {e}")

if __name__ == "__main__":
    reset_media_preferences()
