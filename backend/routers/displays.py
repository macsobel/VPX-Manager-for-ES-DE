import os
import sys
import subprocess
import time
from typing import List, Dict

# pyrefly: ignore [missing-import]
from fastapi import APIRouter
from pathlib import Path

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


                    # Calculate basic X/Y offset assumptions based on index if exact offsets aren't in plist
                    # (This is a rudimentary fallback for positioning)
                    x_pos = 0
                    y_pos = 0
                    if idx > 0:
                        x_pos = sum([d["width"] for d in displays])

                    displays.append({
                        "index": idx,
                        "name": name,
                        "uuid": display.get("_spdisplays_display-uuid", f"unknown-{idx}"),
                        "width": width,
                        "height": height,
                        "x": x_pos,
                        "y": y_pos,
                        "scale_factor": scale_factor,
                    })
    except Exception as e:
        print(f"Error parsing macOS displays: {e}")

    return displays

def _get_linux_displays() -> List[Dict]:
    """Uses xrandr (primary) or pygame (fallback) for Linux display detection."""
    displays = []

    # 1. Try xrandr first (it's often available and doesn't require extra python packages)
    try:
        result = subprocess.run(["xrandr", "--query"], capture_output=True, text=True)
        if result.returncode == 0:
            import re
            # Match: "DP-1 connected primary 2560x1440+0+0 ..." or "HDMI-1 connected 1920x1080+2560+0 ..."
            pattern = re.compile(r"(\S+) connected (?:primary )?(\d+)x(\d+)\+(\d+)\+(\d+)")
            idx = 0
            for line in result.stdout.splitlines():
                match = pattern.search(line)
                if match:
                    name, w, h, x, y = match.groups()
                    displays.append({
                        "index": idx,
                        "name": name,
                        "uuid": f"linux-{idx}",
                        "width": int(w),
                        "height": int(h),
                        "x": int(x),
                        "y": int(y),
                        "scale_factor": 1.0,
                    })
                    idx += 1
            
            if displays:
                return displays
    except Exception as e:
        print(f"Error getting Linux displays via xrandr: {e}")

    # 2. Fallback to pygame method if xrandr failed or found nothing
    try:
        # We need to run this in a subprocess to avoid SDL initializing in the main Uvicorn thread
        # because importing pygame in the main thread can crash Uvicorn on some platforms.
        script = """
try:
    import pygame
    pygame.init()
    sizes = pygame.display.get_desktop_sizes()
    for i, size in enumerate(sizes):
        print(f"{i}|Display {i}|{size[0]}|{size[1]}")
    pygame.quit()
except ImportError:
    pass
        """
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        if result.returncode == 0:
            x_offset = 0
            for line in result.stdout.strip().splitlines():
                if "|" in line:
                    parts = line.split("|")
                    if len(parts) == 4:
                        w = int(parts[2])
                        h = int(parts[3])
                        displays.append({
                            "index": int(parts[0]),
                            "name": parts[1],
                            "uuid": f"linux-{parts[0]}",
                            "width": w,
                            "height": h,
                            "x": x_offset,
                            "y": 0,
                            "scale_factor": 1.0,
                        })
                        x_offset += w
    except Exception as e:
        print(f"Error getting Linux displays via pygame: {e}")

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
            # Detect executable path
            if getattr(sys, "frozen", False):
                python_exe = sys.executable
                main_script = None
            else:
                # Use venv if it exists, otherwise system python
                base_dir = Path(__file__).resolve().parent.parent.parent
                venv_python = base_dir / ".venv" / "bin" / "python"
                python_exe = str(venv_python) if venv_python.exists() else sys.executable
                main_script = str(base_dir / "main.py")

            displays_info = _get_macos_displays() if sys.platform == "darwin" else _get_linux_displays()

            for d in displays_info:
                idx = d["index"]
                cmd = [python_exe]
                if main_script:
                    cmd.append(main_script)
                cmd.extend(["--identify", str(idx)])
                
                subprocess.Popen(cmd, start_new_session=True)
                # Small delay to prevent SDL collisions
                time.sleep(0.3)

        except Exception as e:
            print(f"Error launching identify: {e}")

    threading.Thread(target=run_identify, daemon=True).start()
    return {"success": True, "message": "Identification overlays launched"}
