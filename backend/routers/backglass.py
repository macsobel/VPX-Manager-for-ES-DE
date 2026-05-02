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
    priority: list[str]
    display_count: int = 1

def get_display_count():
    """Safely get the number of connected displays without crashing the main thread on macOS."""
    import sys
    if sys.platform == "darwin":
        try:
            import subprocess
            # Query system_profiler for the number of resolutions detected (one per active display)
            output = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], timeout=2).decode()
            count = output.count("Resolution:")
            return max(1, count)
        except:
            return 1
    else:
        try:
            import pygame
            if not pygame.display.get_init():
                pygame.display.init()
            count = pygame.display.get_num_displays()
            pygame.display.quit()
            return count
        except:
            return 1

@router.get("/settings", response_model=BackglassSettings)
async def get_settings():
    # Never import or use pygame here on macOS as it crashes the Uvicorn thread
    return BackglassSettings(
        enabled=config.backglass_enabled,
        screen_index=config.backglass_screen_index,
        priority=config.backglass_priority,
        display_count=get_display_count()
    )

@router.post("/settings")
async def update_settings(settings: BackglassSettings):
    config.backglass_enabled = settings.enabled
    config.backglass_screen_index = settings.screen_index
    config.backglass_priority = settings.priority
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
