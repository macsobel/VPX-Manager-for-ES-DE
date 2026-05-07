import os
import sys
import subprocess
import time
from typing import List, Dict

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/displays", tags=["displays"])

def _get_macos_displays() -> List[Dict]:
    """Uses system_profiler to extract physical resolution vs logical resolution to calculate scale."""
    displays = []
    try:
        result = subprocess.run(
            ["system_profiler", "SPDisplaysDataType", "-xml"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0 and result.stdout:
            # Simple plist parsing (instead of importing plistlib to avoid strict typing issues with deeply nested plists)
            import plistlib
            plist = plistlib.loads(result.stdout.encode("utf-8"))
            if not plist or not isinstance(plist, list):
                return []

            # The structure is usually plist[0]['_items'][0]['spdisplays_ndrvs']
            items = plist[0].get("_items", [])
            for item in items:
                ndrvs = item.get("spdisplays_ndrvs", [])
                for idx, display in enumerate(ndrvs):
                    name = display.get("_name", f"Display {idx}")
                    resolution_str = display.get("_spdisplays_resolution", "")

                    # Retina check: _spdisplays_pixels contains the physical pixels, _spdisplays_resolution usually has the logical.
                    physical_pixels = display.get("_spdisplays_pixels", "")

                    scale_factor = 1.0
                    width, height = 1920, 1080

                    if resolution_str:
                        # e.g., "1920 x 1080 @ 60 Hz" or "2560 x 1440"
                        parts = resolution_str.lower().split("x")
                        if len(parts) >= 2:
                            try:
                                width = int(parts[0].strip())
                                height = int(parts[1].split()[0].strip())
                            except ValueError:
                                pass

                    if physical_pixels:
                        # e.g. "5120 x 2880"
                        parts = physical_pixels.lower().split("x")
                        if len(parts) >= 2:
                            try:
                                phys_w = int(parts[0].strip())
                                # Calculate ratio
                                if width > 0:
                                    ratio = phys_w / width
                                    if ratio >= 1.5:
                                        scale_factor = round(ratio)
                            except ValueError:
                                pass

                    displays.append({
                        "index": idx,
                        "name": name,
                        "uuid": display.get("_spdisplays_display-uuid", f"unknown-{idx}"),
                        "width": width,
                        "height": height,
                        "scale_factor": scale_factor,
                    })
    except Exception as e:
        print(f"Error parsing macOS displays: {e}")

    return displays

def _get_linux_displays() -> List[Dict]:
    """Uses pygame fallback for Linux since we don't have SPDisplaysDataType."""
    displays = []
    try:
        # We need to run this in a subprocess to avoid SDL initializing in the main Uvicorn thread
        # because importing pygame in the main thread can crash Uvicorn on some platforms.
        script = """
import pygame
pygame.init()
sizes = pygame.display.get_desktop_sizes()
for i, size in enumerate(sizes):
    print(f"{i}|Display {i}|{size[0]}|{size[1]}")
pygame.quit()
        """
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.strip().splitlines():
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 4:
                        displays.append({
                            "index": int(parts[0]),
                            "name": parts[1],
                            "uuid": f"linux-{parts[0]}",
                            "width": int(parts[2]),
                            "height": int(parts[3]),
                            "scale_factor": 1.0,
                        })
    except Exception as e:
        print(f"Error getting Linux displays: {e}")

    return displays


@router.get("")
async def list_displays():
    """Returns a list of all detected displays."""
    if sys.platform == "darwin":
        displays = _get_macos_displays()
    else:
        displays = _get_linux_displays()

    return {"displays": displays}


@router.post("/identify")
async def identify_displays():
    """Flashes the SDL2 identification overlay on all monitors."""
    import threading

    def run_identify():
        try:
            # We must launch the identify script in separate processes for each display
            # Or sequentially if we just want to flash them one by one.
            # Doing it sequentially is safer to avoid SDL context issues.
            displays_info = _get_macos_displays() if sys.platform == "darwin" else _get_linux_displays()

            script_path = os.path.join(os.path.dirname(__file__), "..", "services", "backglass", "identify.py")

            for d in displays_info:
                idx = d["index"]
                subprocess.Popen([sys.executable, script_path, str(idx)])

        except Exception as e:
            print(f"Error launching identify: {e}")

    threading.Thread(target=run_identify, daemon=True).start()
    return {"success": True, "message": "Identification overlays launched"}
