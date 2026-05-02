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
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file for local development
load_dotenv()

# ── Sub-process Handlers (Prevents recursive app launching in bundled builds) ──
if len(sys.argv) > 1:
    if "--backglass" in sys.argv:
        from backend.services.backglass.backglass_companion import BackglassCompanion
        s_idx = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        priority = sys.argv[3].split(',') if len(sys.argv) > 3 else ["fanart", "covers", "logos", "marquees"]
        companion = BackglassCompanion(screen_index=s_idx)
        companion.priority = priority
        companion.run()
        sys.exit(0)
    
    if "--identify" in sys.argv:
        from backend.services.backglass.identify import identify_screen
        s_idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        identify_screen(s_idx)
        sys.exit(0)

import backend.core.database as db
from backend.core.config import LOG_FILE, VERSION
from backend.routers import (
    tables,
    upload,
    vps,
    media,
    # collections,
    settings as settings_router,
    scraper,
    patches,
    tools,
    vbs_manager,
    ini_manager,
    updates,
    backglass,
)
from backend.services.esde_sync_service import esde_sync
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
            pattern = rf"({key}[=:\(\"\'\s]+)([^&\s\)\"\',]+)"
            msg = re.sub(pattern, r"\1[REDACTED]", msg, flags=re.IGNORECASE)

        record.msg = msg
        record.args = None
        return True


# Configure standard logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3),
        logging.StreamHandler(),
    ],
)

# Apply filter to ALL handlers in the root logger
for handler in logging.root.handlers:
    handler.addFilter(RedactingFilter())

# Configure Uvicorn's internal logging to also use the filter
UVICORN_LOG_CONFIG = uvicorn.config.LOGGING_CONFIG
for name in ["access", "default"]:
    if f"uvicorn.{name}" not in UVICORN_LOG_CONFIG["loggers"]:
        UVICORN_LOG_CONFIG["loggers"][f"uvicorn.{name}"] = {
            "handlers": ["default"],
            "level": "INFO",
        }

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

    setproctitle.setproctitle("VPX Manager for ES-DE")

    import ctypes
    import ctypes.util

    libc = ctypes.CDLL(ctypes.util.find_library("c"))
    if hasattr(libc, "setprogname"):
        libc.setprogname(b"VPX Manager for ES-DE")
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
        logger.info(
            f"VPX Manager for ES-DE is accessible on your local network at: http://{local_ip}:8746"
        )
    except Exception:
        logger.info("VPX Manager for ES-DE is running locally.")
    
    # Baseline sync with EmulationStation collections (Disabled)
    # import asyncio
    # asyncio.create_task(esde_sync.sync_all())

    # Start Backglass Monitor
    from backend.services.backglass.monitor_service import backglass_monitor
    backglass_monitor.start()

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
# app.include_router(collections.router)
app.include_router(settings_router.router)
app.include_router(scraper.router)
app.include_router(patches.router)
app.include_router(tools.router)
app.include_router(vbs_manager.router)
app.include_router(ini_manager.router)
app.include_router(updates.router)
app.include_router(backglass.router)

# ── Static Frontend ─────────────────────────────────────────────────
from backend.core.config import APP_SUPPORT_DIR

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


import asyncio
import sys
import threading

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
    # ── Single Instance Check ──────────────────────────────────────────
    # Check if the server port is already in use.
    # If so, we assume the app is already running and just open the UI.
    def is_port_in_use(port):
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0

    if is_port_in_use(8746):
        import webbrowser
        logger.info("VPX Manager is already running. Opening web interface.")
        webbrowser.open("http://localhost:8746")
        sys.exit(0)

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    import os
    import platform

    def _shutdown_server():
        global server_instance
        if server_instance:
            server_instance.should_exit = True
        if server_thread.is_alive():
            server_thread.join(timeout=2.0)

    # Launch System Tray / Menu Bar based on OS
    if platform.system() == "Darwin":
        try:
            import rumps

            class VPXMenuBarApp(rumps.App):
                def __init__(self):
                    super(VPXMenuBarApp, self).__init__("", quit_button=None)

                    # Asset resolution for the icon
                    icon_path = None
                    icon_filename = "MenuBarIconColor.png"
                    if getattr(sys, "frozen", False):
                        # PyInstaller path
                        base_path = sys._MEIPASS
                        icon_path = os.path.join(base_path, "resources", icon_filename)
                    else:
                        # Running from script
                        icon_path = os.path.join(
                            os.path.dirname(__file__), "resources", icon_filename
                        )

                    if os.path.exists(icon_path):
                        # Set the icon. rumps handles absolute paths well,
                        # but we ensure it's not treated as a template.
                        self.icon = icon_path
                        self.template = False

                    # Define initial menu structure
                    self.status_item = rumps.MenuItem("Managing 0 Tables")
                    # Make it grayed out/unclickable
                    self.status_item.set_callback(None)

                    self.update_item = rumps.MenuItem(
                        "Check for Updates...", callback=self.check_for_updates
                    )
                    
                    # Set icon for Check for Updates
                    check_icon_path = os.path.join(os.path.dirname(__file__), "resources", "check_circle.png")
                    if os.path.exists(check_icon_path):
                        self.update_item.icon = check_icon_path
                        self.update_item.template = True

                    self.about_item = rumps.MenuItem("About VPX Manager", callback=self.about_window)
                    # Set icon for About
                    info_icon_path = os.path.join(os.path.dirname(__file__), "resources", "info_circle.png")
                    if os.path.exists(info_icon_path):
                        self.about_item.icon = info_icon_path
                        self.about_item.template = True

                    self.settings_item = rumps.MenuItem("Settings...", callback=self.open_settings)
                    # Set icon for Settings
                    settings_icon_path = os.path.join(os.path.dirname(__file__), "resources", "settings_gear.png")
                    if os.path.exists(settings_icon_path):
                        self.settings_item.icon = settings_icon_path
                        self.settings_item.template = True

                    self.menu = [
                        self.status_item,
                        None,  # Separator
                        self.about_item,
                        self.update_item,
                        self.settings_item,
                        None,  # Separator
                        rumps.MenuItem("Open Web Interface", callback=self.open_web_ui),
                        rumps.MenuItem("Open Emulation Station", callback=self.open_es),
                        None,  # Separator
                        rumps.MenuItem("Restart", callback=self.restart),
                        rumps.MenuItem("Quit", callback=self.quit_app),
                    ]

                def open_web_ui(self, sender):
                    import webbrowser
                    webbrowser.open("http://localhost:8746")

                def open_settings(self, sender):
                    import webbrowser
                    webbrowser.open("http://localhost:8746/#settings")

                def about_window(self, sender):
                    rumps.alert(
                        title="VPX Manager for ES-DE",
                        message=f"Version {VERSION}\n\nA Visual Pinball file management system for macOS and Linux with media file management for Emulation Station.\n\nDeveloped by Aaron Sobel",
                        ok="Close",
                    )

                def check_for_updates(self, sender):
                    from backend.services.update_service import update_service

                    try:
                        result = asyncio.run(update_service.check_for_updates())
                        if result.get("update_available"):
                            if rumps.alert(
                                title="Update Available",
                                message=f"A new version ({result['latest_version']}) is available.\n\nWould you like to open the download page?",
                                ok="Download",
                                cancel="Later",
                            ):
                                import webbrowser

                                webbrowser.open(result["download_url"])
                        elif result.get("error"):
                            rumps.alert("Update Check Failed", result["error"])
                        else:
                            rumps.alert(
                                "Up to Date",
                                f"You are running the latest version ({VERSION}).",
                            )
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
                    from backend.core.config import config

                    es_path = config.esde_app_path
                    try:
                        import subprocess

                        subprocess.run(["open", es_path], check=False)
                    except Exception as e:
                        logger.error(f"Failed to open Emulation Station: {e}")

                def restart(self, sender):
                    try:
                        import subprocess

                        if getattr(sys, "frozen", False):
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
                        _shutdown_server()
                        rumps.quit_application()

                def quit_app(self, sender):
                    _shutdown_server()
                    rumps.quit_application()

            # Run the app
            VPXMenuBarApp().run()

        except ImportError:
            # Fallback if rumps is missing
            try:
                while True:
                    import time

                    time.sleep(1)
            except KeyboardInterrupt:
                sys.exit(0)

    elif platform.system() == "Linux":
        # Strategy: Prefer GTK (gi) for the full 'menubar' experience (menu on left-click),
        # but fall back to pystray if gi is not available in the bundle.
        tray_started = False

        # --- Attempt 1: GTK (gi) ---
        try:
            import gi
            gi.require_version('Gtk', '3.0')
            from gi.repository import Gtk, GLib
            import threading

            # Resolve icon path
            icon_filename = "icon.png"
            if getattr(sys, "frozen", False):
                icon_path = os.path.join(sys._MEIPASS, "resources", icon_filename)
            else:
                icon_path = os.path.join(os.path.dirname(__file__), "resources", icon_filename)

            if not os.path.exists(icon_path):
                icon_filename = "MenuBarIconColor.png"
                if getattr(sys, "frozen", False):
                    icon_path = os.path.join(sys._MEIPASS, "resources", icon_filename)
                else:
                    icon_path = os.path.join(os.path.dirname(__file__), "resources", icon_filename)

            tray_icon = Gtk.StatusIcon()
            if os.path.exists(icon_path):
                tray_icon.set_from_file(icon_path)
            else:
                tray_icon.set_from_icon_name("application-x-executable")
            
            tray_icon.set_tooltip_text("VPX Manager for ES-DE")
            tray_icon.set_visible(True)

            def build_gtk_menu():
                menu = Gtk.Menu()
                try:
                    count = asyncio.run(db.get_table_count())
                except Exception:
                    count = 0
                status_item = Gtk.MenuItem(label=f"Managing {count} Tables")
                status_item.set_sensitive(False)
                menu.append(status_item)
                menu.append(Gtk.SeparatorMenuItem())

                about_item = Gtk.MenuItem(label="About VPX Manager")
                def on_about(w):
                    from backend.services.linux_dialogs import show_info
                    threading.Thread(target=show_info, args=(
                        "About VPX Manager for ES-DE",
                        f"Version {VERSION}\n\nA Visual Pinball file management system for macOS and Linux.\n\nDeveloped by Aaron Sobel"
                    ), daemon=True).start()
                about_item.connect("activate", on_about)
                menu.append(about_item)

                updates_item = Gtk.MenuItem(label="Check for Updates...")
                def on_check_updates(w):
                    from backend.services.update_service import update_service
                    from backend.services.linux_dialogs import show_info, ask_yes_no
                    def _check():
                        try:
                            result = asyncio.run(update_service.check_for_updates())
                            if result.get("update_available"):
                                if ask_yes_no("Update Available", f"A new version ({result['latest_version']}) is available.\n\nOpen download page?"):
                                    import webbrowser
                                    webbrowser.open(result["download_url"])
                            elif result.get("error"):
                                show_info("Update Check Failed", result["error"])
                            else:
                                show_info("Up to Date", f"You are running the latest version ({VERSION}).")
                        except Exception as e:
                            logger.error(f"Error checking for updates: {e}")
                            show_info("Update Check Failed", str(e))
                    threading.Thread(target=_check, daemon=True).start()
                updates_item.connect("activate", on_check_updates)
                menu.append(updates_item)

                settings_item = Gtk.MenuItem(label="Settings...")
                import webbrowser
                settings_item.connect("activate", lambda w: webbrowser.open("http://localhost:8746/#settings"))
                menu.append(settings_item)
                menu.append(Gtk.SeparatorMenuItem())

                web_item = Gtk.MenuItem(label="Open Web Interface")
                web_item.connect("activate", lambda w: webbrowser.open("http://localhost:8746"))
                menu.append(web_item)

                es_item = Gtk.MenuItem(label="Open Emulation Station")
                def on_open_es(w):
                    from backend.core.config import config
                    try:
                        import subprocess
                        subprocess.Popen([config.esde_app_path])
                    except Exception as e:
                        logger.error(f"Failed to open Emulation Station: {e}")
                es_item.connect("activate", on_open_es)
                menu.append(es_item)
                menu.append(Gtk.SeparatorMenuItem())

                restart_item = Gtk.MenuItem(label="Restart")
                def on_restart(w):
                    try:
                        import subprocess
                        appimage = os.environ.get("APPIMAGE")
                        if appimage:
                            subprocess.Popen([appimage])
                        elif getattr(sys, "frozen", False):
                            subprocess.Popen([sys.executable])
                        else:
                            subprocess.Popen([sys.executable, *sys.argv])
                    except Exception as e:
                        logger.error(f"Failed to restart: {e}")
                    finally:
                        _shutdown_server()
                        GLib.idle_add(Gtk.main_quit)
                restart_item.connect("activate", on_restart)
                menu.append(restart_item)

                quit_item = Gtk.MenuItem(label="Quit")
                def on_quit(w):
                    _shutdown_server()
                    GLib.idle_add(Gtk.main_quit)
                quit_item.connect("activate", on_quit)
                menu.append(quit_item)

                menu.show_all()
                return menu

            def on_gtk_popup(icon, button, time):
                menu = build_gtk_menu()
                menu.popup(None, None, Gtk.StatusIcon.position_menu, icon, button, time)

            tray_icon.connect("popup-menu", on_gtk_popup)
            tray_icon.connect("activate", lambda i: on_gtk_popup(i, 0, Gtk.get_current_event_time()))

            logger.info("Started GTK tray icon.")
            tray_started = True
            Gtk.main()

        except (ImportError, ValueError, Exception) as e:
            logger.warning(f"GTK tray icon unavailable: {e}. Falling back to pystray.")

        # --- Attempt 2: pystray (Fallback) ---
        if not tray_started:
            try:
                import subprocess
                import webbrowser
                import threading
                from PIL import Image
                import pystray
                from pystray import MenuItem as item

                # Resolve icon path
                icon_filename = "icon.png"
                if getattr(sys, "frozen", False):
                    icon_path = os.path.join(sys._MEIPASS, "resources", icon_filename)
                else:
                    icon_path = os.path.join(os.path.dirname(__file__), "resources", icon_filename)

                def on_open_web(icon, item):
                    webbrowser.open("http://localhost:8746")

                def on_open_settings(icon, item):
                    webbrowser.open("http://localhost:8746/#settings")

                def on_about(icon, item):
                    from backend.services.linux_dialogs import show_info
                    threading.Thread(target=show_info, args=(
                        "About VPX Manager for ES-DE",
                        f"Version {VERSION}\n\nA Visual Pinball file management system for macOS and Linux.\n\nDeveloped by Aaron Sobel"
                    ), daemon=True).start()

                def on_check_updates(icon, item):
                    from backend.services.update_service import update_service
                    from backend.services.linux_dialogs import show_info, ask_yes_no
                    def _check():
                        try:
                            result = asyncio.run(update_service.check_for_updates())
                            if result.get("update_available"):
                                if ask_yes_no("Update Available", f"A new version ({result['latest_version']}) is available.\n\nOpen download page?"):
                                    webbrowser.open(result["download_url"])
                            elif result.get("error"):
                                show_info("Update Check Failed", result["error"])
                            else:
                                show_info("Up to Date", f"You are running the latest version ({VERSION}).")
                        except Exception as e:
                            logger.error(f"Error checking for updates: {e}")
                            show_info("Update Check Failed", str(e))
                    threading.Thread(target=_check, daemon=True).start()

                def on_open_es(icon, item):
                    from backend.core.config import config
                    try:
                        subprocess.Popen([config.esde_app_path])
                    except Exception as e:
                        logger.error(f"Failed to open Emulation Station: {e}")

                def on_restart(icon, item):
                    try:
                        appimage = os.environ.get("APPIMAGE")
                        if appimage:
                            subprocess.Popen([appimage])
                        elif getattr(sys, "frozen", False):
                            subprocess.Popen([sys.executable])
                        else:
                            subprocess.Popen([sys.executable, *sys.argv])
                    except Exception as e:
                        logger.error(f"Failed to restart: {e}")
                    finally:
                        _shutdown_server()
                        icon.stop()

                def on_quit(icon, item):
                    _shutdown_server()
                    icon.stop()

                def get_table_count_text(item):
                    try:
                        count = asyncio.run(db.get_table_count())
                        return f"Managing {count} Tables"
                    except Exception:
                        return "Managing 0 Tables"

                # Create the menu
                menu = pystray.Menu(
                    item(get_table_count_text, lambda: None, enabled=False),
                    pystray.Menu.SEPARATOR,
                    item("About VPX Manager", on_about),
                    item("Check for Updates...", on_check_updates),
                    item("Settings...", on_open_settings),
                    pystray.Menu.SEPARATOR,
                    item("Open Web Interface", on_open_web, default=True),
                    item("Open Emulation Station", on_open_es),
                    pystray.Menu.SEPARATOR,
                    item("Restart", on_restart),
                    item("Quit", on_quit)
                )

                if os.path.exists(icon_path):
                    image = Image.open(icon_path)
                    image.thumbnail((128, 128), Image.Resampling.LANCZOS)
                else:
                    image = Image.new('RGB', (64, 64), color='red')
                
                icon = pystray.Icon("vpx_manager", image, "VPX Manager for ES-DE", menu)
                logger.info("Started pystray tray icon.")
                tray_started = True
                icon.run()

            except Exception as e:
                logger.error(f"Failed to start fallback tray icon: {e}")

        # --- Final Fallback: Keep Server Alive ---
        if not tray_started:
            try:
                while True:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                sys.exit(0)

    else:
        # Fallback for other platforms
        try:
            while True:
                import time

                time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)
