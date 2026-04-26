"""
VPX Manager for ES-DE — FastAPI Application Entry Point
A web-based table management app for Visual Pinball X on macOS.
"""
import uvicorn
import uvicorn.config
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os

import database as db
from config import LOG_FILE, VERSION
from routers import tables, upload, vps, media, collections, settings as settings_router, scraper, patches, tools, vbs_manager, ini_manager, updates
import socket

# ── Logging & Security ──────────────────────────────────────────────
import logging
import re
from logging.handlers import RotatingFileHandler

# Delete legacy server.log if it exists in the project root
legacy_server_log = Path(__file__).parent / "server.log"
if legacy_server_log.exists():
    try:
        legacy_server_log.unlink()
    except Exception:
        pass

class RedactingFilter(logging.Filter):
    """
    Global filter to redact sensitive credentials from all log messages.
    Scans for patterns like devid=..., sspassword=..., etc.
    """
    def filter(self, record):
        msg = record.getMessage()
        # Sensitive keys to watch for
        keys = ["devid", "devpassword", "ssid", "sspassword"]
        for key in keys:
            # Match key=value, key:value, or key="value"
            pattern = rf'({key}[=:\(\"\'\s]+)([^&\s\)\"\',]+)'
            msg = re.sub(pattern, r'\1[REDACTED]', msg, flags=re.IGNORECASE)
        
        record.msg = msg
        record.args = None
        return True

# Configure standard logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3),
        logging.StreamHandler()
    ]
)

# Apply filter to ALL handlers in the root logger
for handler in logging.root.handlers:
    handler.addFilter(RedactingFilter())

# Configure Uvicorn's internal logging to also use the filter
UVICORN_LOG_CONFIG = uvicorn.config.LOGGING_CONFIG
for name in ["access", "default"]:
    if f"uvicorn.{name}" not in UVICORN_LOG_CONFIG["loggers"]:
        UVICORN_LOG_CONFIG["loggers"][f"uvicorn.{name}"] = {"handlers": ["default"], "level": "INFO"}
    
# We need to make sure the uvicorn handlers also get the filter
# But uvicorn config is a dict, so we'll have to inject it into uvicorn.run or similar.
# Actually, the simplest way to catch uvicorn logs is to ensure they propagate.
logging.getLogger("uvicorn").propagate = True
logging.getLogger("uvicorn.access").propagate = True
logging.getLogger("uvicorn.error").propagate = True

logger = logging.getLogger("vpx_manager")
logger.info("VPX Manager for ES-DE starting up...")

# Try to set the process name for Activity Monitor / macOS UI
try:
    import setproctitle
    setproctitle.setproctitle('VPX Manager for ES-DE')
    
    import ctypes
    import ctypes.util
    libc = ctypes.CDLL(ctypes.util.find_library('c'))
    if hasattr(libc, 'setprogname'):
        libc.setprogname(b'VPX Manager for ES-DE')
except Exception:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    await db.init_db()

    # Log local IP for LAN access
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        logger.info(f"VPX Manager for ES-DE is accessible on your local network at: http://{local_ip}:8746")
    except Exception:
        logger.info("VPX Manager for ES-DE is running locally.")

    yield


app = FastAPI(
    title="VPX Manager for ES-DE",
    description="A Visual Pinball file management system for macOS and Linux with media file management for Emulation Station.",
    version=VERSION,
    lifespan=lifespan,
)

# ── API Routers ─────────────────────────────────────────────────────
app.include_router(tables.router)
app.include_router(upload.router)
app.include_router(vps.router)
app.include_router(media.router)
app.include_router(collections.router)
app.include_router(settings_router.router)
app.include_router(scraper.router)
app.include_router(patches.router)
app.include_router(tools.router)
app.include_router(vbs_manager.router)
app.include_router(ini_manager.router)
app.include_router(updates.router)

# ── Static Frontend ─────────────────────────────────────────────────
from config import APP_SUPPORT_DIR
MOBILE_BUILDS_DIR = APP_SUPPORT_DIR / "Mobile Builds"
MOBILE_BUILDS_DIR.mkdir(parents=True, exist_ok=True)

FRONTEND_DIR = (Path(__file__).parent / "frontend").resolve()
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Mobile builds are now served via the /api/tables/downloads/{filename} endpoint
# to support Chrome-safe headers and proper filename encoding.


@app.get("/")
async def serve_index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "VPX Manager for ES-DE API is running. Frontend not found."}


@app.get("/{path:path}")
async def catch_all(path: str):
    """SPA catch-all — serve the index for any non-API route."""
    # Don't catch API routes
    if path.startswith("api/"):
        return {"error": "Not found"}
    # Try to serve static file first
    try:
        static_path = (FRONTEND_DIR / path).resolve()
        if static_path.is_relative_to(FRONTEND_DIR) and static_path.is_file():
            return FileResponse(static_path)
    except (ValueError, RuntimeError):
        # Handle cases where .resolve() might fail or is_relative_to is False
        pass

    # Fall back to index.html for SPA routing
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "VPX Manager for ES-DE API"}


import threading
import sys
import asyncio

# Global server reference for graceful shutdown
server_instance = None

def run_server():
    global server_instance
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8746,
        reload=False,
        log_level="info",
        log_config=UVICORN_LOG_CONFIG,
    )
    server_instance = uvicorn.Server(config)
    server_instance.run()

if __name__ == "__main__":
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Try to launch the macOS menubar app
    try:
        import rumps
        import os

        class VPXMenuBarApp(rumps.App):
            def __init__(self):
                super(VPXMenuBarApp, self).__init__("VPX Manager for ES-DE", title="VPX Manager", quit_button=None)

                # Asset resolution for the icon
                icon_path = None
                if getattr(sys, 'frozen', False):
                    # PyInstaller path
                    base_path = sys._MEIPASS
                    icon_path = os.path.join(base_path, 'resources', 'MenuBarIconTemplate.png')
                else:
                    # Running from script
                    icon_path = os.path.join(os.path.dirname(__file__), 'resources', 'MenuBarIconTemplate.png')

                if os.path.exists(icon_path):
                    self.icon = icon_path
                    self.template = True

                # Define initial menu structure
                self.status_item = rumps.MenuItem("Managing 0 Tables")
                # Make it grayed out/unclickable
                self.status_item.set_callback(None)

                self.menu = [
                    self.status_item,
                    None,  # Separator
                    rumps.MenuItem("Open Web UI", callback=self.open_web_ui),
                    rumps.MenuItem("Open Emulation Station", callback=self.open_es),
                    rumps.MenuItem("Check for Updates...", callback=self.check_for_updates),
                    rumps.MenuItem("About VPX Manager", callback=self.about_window),
                    rumps.MenuItem("Restart", callback=self.restart),
                    rumps.MenuItem("Quit", callback=self.quit_app)
                ]

            def open_web_ui(self, sender):
                import webbrowser
                webbrowser.open("http://localhost:8746")

            def about_window(self, sender):
                rumps.alert(
                    title="VPX Manager for ES-DE",
                    message=f"Version {VERSION}\n\nA Visual Pinball file management system for macOS and Linux with media file management for Emulation Station. Let's make some macOS pincabs!\n\nDeveloped by Aaron Sobel",
                    ok="Close"
                )

            def check_for_updates(self, sender):
                from services.update_service import update_service
                try:
                    result = asyncio.run(update_service.check_for_updates())
                    if result.get("update_available"):
                        if rumps.alert(
                            title="Update Available",
                            message=f"A new version ({result['latest_version']}) is available.\n\nWould you like to open the download page?",
                            ok="Download",
                            cancel="Later"
                        ):
                            import webbrowser
                            webbrowser.open(result["download_url"])
                    elif result.get("error"):
                        rumps.alert("Update Check Failed", result["error"])
                    else:
                        rumps.alert("Up to Date", f"You are running the latest version ({VERSION}).")
                except Exception as e:
                    logger.error(f"Error checking for updates from menubar: {e}")
                    rumps.alert("Update Check Failed", str(e))

            @rumps.timer(5)
            def update_status(self, _):
                # We need to run db operations in a new event loop or using asyncio.run
                # since we are in a synchronous callback on the main thread.
                try:
                    count = asyncio.run(db.get_table_count())
                    self.status_item.title = f"Managing {count} Tables"
                except Exception as e:
                    logger.error(f"Error updating table count in menubar: {e}")

            def open_es(self, sender):
                from config import config
                es_path = config.esde_app_path
                try:
                    import subprocess
                    subprocess.run(["open", es_path], check=False)
                except Exception as e:
                    logger.error(f"Failed to open Emulation Station: {e}")

            def _shutdown_server(self):
                global server_instance
                if server_instance:
                    server_instance.should_exit = True
                if server_thread.is_alive():
                    server_thread.join(timeout=2.0)

            def restart(self, sender):
                try:
                    import subprocess
                    if getattr(sys, 'frozen', False):
                        # Executable / .app bundle
                        bundle_path = sys.executable
                        # If inside a macOS .app, sys.executable is .../Contents/MacOS/VPX_Manager
                        # We want the .app path
                        if ".app/Contents/MacOS" in bundle_path:
                            bundle_path = bundle_path.split(".app")[0] + ".app"
                        subprocess.Popen(["open", "-n", bundle_path])
                    else:
                        # Script
                        subprocess.Popen([sys.executable, *sys.argv])
                except Exception as e:
                    logger.error(f"Failed to restart app: {e}")
                finally:
                    self._shutdown_server()
                    rumps.quit_application()

            def quit_app(self, sender):
                self._shutdown_server()
                rumps.quit_application()

        # Run the app
        VPXMenuBarApp().run()

    except ImportError:
        # Fallback if not on macOS or rumps is missing
        try:
            while True:
                import time
                time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)
