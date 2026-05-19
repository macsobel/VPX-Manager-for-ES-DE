import os
import subprocess
import signal
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from pathlib import Path
from backend.core.config import config, save_config

router = APIRouter(prefix="/api/backglass", tags=["backglass"])

class BackglassSettings(BaseModel):
    enabled: bool
    screen_index: Optional[int] = 0
    screen_name: Optional[str] = ""
    displays: list = []

def get_displays():
    """Safely get a list of connected displays and their names."""
    import sys
    displays = []

    if sys.platform == "darwin":
        try:
            import subprocess
            output = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], timeout=2).decode()
            lines = output.split('\n')
            in_displays = False
            for line in lines:
                if "Displays:" in line:
                    in_displays = True
                    continue
                if in_displays:
                    indent = len(line) - len(line.lstrip())
                    if indent > 0 and indent < 8:
                        in_displays = False
                        continue
                    if indent == 8 and line.strip().endswith(":"):
                        displays.append({"index": len(displays), "name": line.strip()[:-1]})
        except:
            pass

    # Fallback if no displays found or not on macOS
    if not displays:
        try:
            # pyrefly: ignore [missing-import]
            import pygame
            if not pygame.display.get_init():
                pygame.display.init()
            count = pygame.display.get_num_displays()
            pygame.display.quit()
            for i in range(count):
                displays.append({"index": i, "name": f"Display {i}"})
        except:
            displays = [{"index": 0, "name": "Primary Display"}]

    return displays

def get_display_count():
    """Safely get the number of connected displays."""
    return len(get_displays())

@router.get("/settings", response_model=BackglassSettings)
async def get_settings():
    # Find the display assigned to the 'Backglass' role in the global config
    bg_display = next((d for d in config.displays if d.get("role") == "Backglass"), None)
    
    return BackglassSettings(
        enabled=config.backglass_enabled,
        screen_index=bg_display.get("index", 0) if bg_display else 0,
        screen_name=bg_display.get("name", "") if bg_display else "",
        displays=get_displays()
    )

@router.post("/settings")
async def update_settings(settings: BackglassSettings):
    config.backglass_enabled = settings.enabled
    
    # We no longer save individual screen_index for the backglass helper.
    # It purely follows the 'Backglass' role in config.displays.
    save_config(config)
    return {"success": True}

@router.get("/status")
async def get_status():
    from backend.services.backglass.monitor_service import backglass_monitor
    import psutil
    is_running = False
    pid = None
    if backglass_monitor._companion_process and backglass_monitor._companion_process.poll() is None:
        is_running = True
        pid = backglass_monitor._companion_process.pid
    else:
        # Fallback to global process check to handle Uvicorn worker process separation
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmd_line = " ".join(proc.info.get('cmdline') or [])
                    if "--backglass" in cmd_line and not any(sig in cmd_line for sig in ["antigravity", "grep"]):
                        is_running = True
                        pid = proc.pid
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    continue
        except Exception:
            pass
    
    bg_display = next((d for d in config.displays if d.get("role") == "Backglass"), None)
    
    return {
        "running": is_running,
        "pid": pid,
        "enabled": config.backglass_enabled,
        "screen_index": bg_display.get("index", 0) if bg_display else 0
    }

@router.post("/identify")
async def identify_screens():
    import sys
    if getattr(sys, "frozen", False):
        python = sys.executable
    else:
        base_dir = Path(__file__).resolve().parent.parent.parent
        venv = base_dir / ".venv" / "bin" / "python"
        python = str(venv) if venv.exists() else "python3"

    try:
        import asyncio
        count = get_display_count()
        # Launch a separate process for each actual display
        for i in range(count):
            cmd = [python]
            if not getattr(sys, "frozen", False):
                # When running from source, we need to specify the main.py script
                main_script = Path(__file__).resolve().parent.parent.parent / "main.py"
                cmd.append(str(main_script))
            
            cmd.extend(["--identify", str(i)])
            subprocess.Popen(cmd, start_new_session=True)
            
            # Moderate non-blocking delay to prevent display collisions on macOS
            await asyncio.sleep(0.3)
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch identify: {str(e)}")

# Legacy endpoints for backward compatibility with existing Dashboard UI (if still used)
@router.post("/start")
async def start_companion():
    from backend.services.backglass.monitor_service import backglass_monitor
    backglass_monitor.start_companion()
    return {"message": "Started"}

@router.post("/stop")
async def stop_companion():
    from backend.services.backglass.monitor_service import backglass_monitor
    backglass_monitor.stop_companion()
    return {"message": "Stopped"}
