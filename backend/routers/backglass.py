import os
import subprocess
import signal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from backend.core.config import config, save_config

router = APIRouter(prefix="/api/backglass", tags=["backglass"])

class BackglassSettings(BaseModel):
    enabled: bool
    screen_index: int
    screen_name: str = ""
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
    # Never import or use pygame here on macOS as it crashes the Uvicorn thread
    return BackglassSettings(
        enabled=config.backglass_enabled,
        screen_index=config.backglass_screen_index,
        screen_name=config.backglass_screen_name,
        displays=get_displays()
    )

@router.post("/settings")
async def update_settings(settings: BackglassSettings):
    config.backglass_enabled = settings.enabled
    config.backglass_screen_index = settings.screen_index
    config.backglass_screen_name = settings.screen_name
    save_config(config)
    
    # If we just enabled it, the monitor service will pick it up on its next loop
    # If we just disabled it, the monitor service will kill the process
    return {"success": True}

@router.get("/status")
async def get_status():
    from backend.services.backglass.monitor_service import backglass_monitor
    is_running = False
    pid = None
    if backglass_monitor._companion_process and backglass_monitor._companion_process.poll() is None:
        is_running = True
        pid = backglass_monitor._companion_process.pid
    
    return {
        "running": is_running,
        "pid": pid,
        "enabled": config.backglass_enabled,
        "screen_index": config.backglass_screen_index
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
