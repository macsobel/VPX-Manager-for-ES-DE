"""
Application configuration with Pydantic settings.
Persists to ~/Library/Application Support/VPX Manager for ES-DE/vpx_manager.json.
"""

import base64
import json
import marshal
import os
import platform
import shutil
import sys
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, validator


def _load_version():
    """Load version from version.txt."""
    v_file = Path(__file__).parent / "version.txt"
    if v_file.exists():
        try:
            return v_file.read_text().strip()
        except Exception:
            pass

    return "Dev Build"


VERSION = _load_version()


# Cross-platform support directory detection
if platform.system() == "Darwin":
    # Standard macOS location for the user
    APP_SUPPORT_DIR = (
        Path.home() / "Library" / "Application Support" / "VPX Manager for ES-DE"
    )
else:
    # Standard Linux location (XDG_CONFIG_HOME fallback)
    APP_SUPPORT_DIR = Path.home() / ".config" / "vpx-manager-for-es-de"

CONFIG_FILE = APP_SUPPORT_DIR / "vpx_manager.json"
LOG_FILE = APP_SUPPORT_DIR / "vpx_manager.log"


def _scramble(data: str) -> str:
    """XOR-based scrambling with a fixed key."""
    key = os.environ.get("VPX_GENERAL_KEY") or "vpx_secret_key_2026"
    return "".join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(data))


def encode_password(pwd: str) -> str:
    """Scramble and encode password."""
    if not pwd:
        return ""
    # Scramble first, then base64 for safe storage
    scrambled = _scramble(pwd)
    return base64.b64encode(scrambled.encode()).decode()


def decode_password(encoded: str) -> str:
    """Decode and unscramble password."""
    if not encoded:
        return ""
    try:
        # Check if it's base64
        decoded_bytes = base64.b64decode(encoded.encode())
        # Try to unscramble
        return _scramble(decoded_bytes.decode())
    except Exception:
        # If decoding fails, it might be legacy plain text (or already decoded)
        return encoded


def relativize_path(p: Optional[str]) -> str:
    """Contract absolute paths in the home directory to user-relative (~/)."""
    if not p:
        return ""
    abs_p = os.path.abspath(os.path.expanduser(p))
    home = os.path.expanduser("~")
    if abs_p.startswith(home):
        # Only replace if it's at the start of a path segment
        return abs_p.replace(home, "~", 1)
    return abs_p


def migrate_legacy_data():
    """Move data from legacy locations to the new consolidated folder."""
    legacy_config = Path.home() / ".vpx_manager.json"
    legacy_log = Path.home() / "vpx_manager.log"
    legacy_support_old = Path.home() / "Library" / "Application Support" / "VPinballX"
    legacy_launcher_dir = Path.home() / ".vpinmanager"
    legacy_support_empty = (
        Path.home() / "Library" / "Application Support" / "VPX Manager"
    )

    # Create new support dir
    APP_SUPPORT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Migrate Config File
    if legacy_config.exists() and not CONFIG_FILE.exists():
        try:
            shutil.copy2(legacy_config, CONFIG_FILE)
            print(f"Migrated config to {CONFIG_FILE}")
        except Exception as e:
            print(f"Error migrating config: {e}")

    # 2. Migrate Database and VPS DB
    if legacy_support_old.exists():
        # DB
        old_db = legacy_support_old / "vpinmanager.db"
        new_db = APP_SUPPORT_DIR / "vpxmanager.db"
        if old_db.exists() and not new_db.exists():
            try:
                shutil.copy2(old_db, new_db)
                print(f"Migrated database to {new_db}")
            except Exception as e:
                print(f"Error migrating database: {e}")

        # VPS DB
        old_vps = legacy_support_old / "vpsdb.json"
        new_vps = APP_SUPPORT_DIR / "vpsdb.json"
        if old_vps.exists() and not new_vps.exists():
            try:
                shutil.copy2(old_vps, new_vps)
                print(f"Migrated VPS database to {new_vps}")
            except Exception as e:
                print(f"Error migrating VPS database: {e}")

    # 3. Migrate Launcher Script
    if legacy_launcher_dir.exists():
        old_script = legacy_launcher_dir / "vpx_launcher.sh"
        new_script = APP_SUPPORT_DIR / "vpx_launcher.sh"
        if old_script.exists() and not new_script.exists():
            try:
                shutil.copy2(old_script, new_script)
                print(f"Migrated launcher script to {new_script}")
            except Exception as e:
                print(f"Error migrating launcher script: {e}")

    # 4. Migrate Log File
    if legacy_log.exists() and not LOG_FILE.exists():
        try:
            shutil.move(legacy_log, LOG_FILE)
            print(f"Migrated log file to {LOG_FILE}")
        except Exception as e:
            print(f"Error migrating log file: {e}")

    # 5. Cleanup empty legacy folder from rumps
    if legacy_support_empty.exists() and legacy_support_empty.is_dir():
        # Only remove if it's empty to be safe
        try:
            if not any(legacy_support_empty.iterdir()):
                legacy_support_empty.rmdir()
                print(f"Removed empty legacy folder: {legacy_support_empty}")
        except Exception:
            pass


# Run migration before loading
migrate_legacy_data()


class AppConfig(BaseModel):
    tables_dir: str = "~/ROMs/vpinball"
    # Master Orientation Setting
    master_orientation: str = ""  # Empty for auto-detect, or "0", "90", "180", "270"

    # ES-DE Integration Settings
    vpx_standalone_app_path: str = (
        "/Applications/VPinballX_BGFX.app"
        if platform.system() == "Darwin"
        else "vpinballx"
    )
    vpx_use_flavor: str = "BGFX"
    vpx_display_mode: str = "Desktop"
    esde_app_path: str = (
        "/Applications/ES-DE.app" if platform.system() == "Darwin" else "es-de"
    )
    media_storage_mode: str = "standard"  # Options: "portable", "standard", "custom"
    esde_media_dir: str = "~/ES-DE/downloaded_media/vpinball"
    # New: Separate directory for ES-DE gamelists (typically ~/ES-DE/gamelists/vpinball)
    esde_gamelists_dir: str = ""
    # ScreenScraper integration
    screenscraper_username: str = ""
    screenscraper_password: str = ""  # This will be encoded in the JSON
    screenscraper_devid: str = ""  # Not saved to JSON
    screenscraper_devpassword: str = ""  # Not saved to JSON
    screenscraper_dev_user: str = ""  # Not saved to JSON
    screenscraper_dev_pass: str = ""  # Not saved to JSON

    # Backglass Companion Settings
    backglass_enabled: bool = False
    backglass_screen_index: int = 1
    backglass_screen_name: str = ""

    # Media Preferences
    media_preferences: dict = {
        "covers": [
            {"source": "vpinmediadb", "key": "wheel.png"},
            {"source": "screenscraper", "key": "wheel-tarcisios"},
            {"source": "screenscraper", "key": "wheel"},
        ],
        "fanart": [
            {"source": "vpinmediadb", "key": "1k/bg.png"},
            {"source": "vpinmediadb", "key": "1k/table.png"},
            {"source": "vpinmediadb", "key": "4k/table.png"},
        ],
        "manuals": [
            {"source": "screenscraper", "key": "manuel"},
        ],
        "marquees": [
            {"source": "screenscraper", "key": "wheel"},
            {"source": "vpinmediadb", "key": "wheel.png"},
        ],
        "screenshots": [
            {"source": "vpinmediadb", "key": "1k/table.png"},
            {"source": "vpinmediadb", "key": "4k/table.png"},
            {"source": "screenscraper", "key": "ss"},
        ],
        "videos": [
            {"source": "vpinmediadb", "key": "1k/video.mp4"},
            {"source": "screenscraper", "key": "videotable"},
            {"source": "screenscraper", "key": "video-normalized"},
        ],
    }

    @validator(
        "tables_dir",
        "vpx_standalone_app_path",
        "esde_app_path",
        "esde_media_dir",
        "esde_gamelists_dir",
        pre=True,
        always=True,
    )
    def expand_paths(cls, v):
        if isinstance(v, str) and v.startswith("~"):
            return str(Path(v).expanduser())
        return v

    @property
    def support_dir(self) -> str:
        """Central support directory for the application."""
        return str(APP_SUPPORT_DIR)

    @property
    def vps_db_path(self) -> str:
        """Path to the Virtual Pinball Spreadsheet database."""
        return str(APP_SUPPORT_DIR / "vpsdb.json")

    @property
    def db_path(self) -> str:
        """Path to the main application SQLite database."""
        return str(APP_SUPPORT_DIR / "vpxmanager.db")

    @property
    def media_cache_dir(self) -> Path:
        """Derived cache directory for thumbnails."""
        path = Path(self.support_dir) / "MediaCache"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def expanded_tables_dir(self) -> Path:
        """Dynamically resolved tables directory."""
        return Path(self.tables_dir).expanduser()

    @property
    def expanded_esde_media_dir(self) -> Path:
        """Dynamically resolved ES-DE downloaded media directory."""
        return Path(self.esde_media_dir).expanduser()

    @property
    def expanded_esde_gamelists_dir(self) -> Path:
        """Dynamically resolved ES-DE gamelists directory."""
        if not self.esde_gamelists_dir:
            # Auto-derive from media dir if in standard mode
            if (
                self.media_storage_mode == "standard"
                and "downloaded_media" in self.esde_media_dir
            ):
                return Path(
                    self.esde_media_dir.replace("downloaded_media", "gamelists")
                ).expanduser()
            return self.expanded_tables_dir
        return Path(self.esde_gamelists_dir).expanduser()

    @property
    def esde_media_base(self) -> Path:
        """Base directory for ES-DE media subfolders."""
        if self.media_storage_mode == "portable":
            return self.expanded_tables_dir / "media"
        return self.expanded_esde_media_dir

    def get_gamelist_xml_path(self) -> Path:
        """Get the full path to the gamelist.xml file."""
        return self.expanded_esde_gamelists_dir / "gamelist.xml"


def _scramble_dev(data: str) -> str:
    """XOR-based scrambling for dev secrets (matches build_utils.py)."""
    key = os.environ.get("VPX_DEV_KEY") or "dev_vpx_scrambler_99"
    return "".join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(data))


def load_config() -> AppConfig:
    """Load config from disk, falling back to defaults."""
    cfg_data = {}

    # 1. Start with defaults

    # 2. Check for obfuscated baked-in credentials
    if getattr(sys, "frozen", False):
        # PyInstaller bundles files in sys._MEIPASS
        dat_path = Path(sys._MEIPASS) / "config.dat"
    else:
        # Running from source - project root
        dat_path = Path(__file__).resolve().parent.parent.parent / "config.dat"

    if dat_path.exists():
        try:
            with open(dat_path, "r") as f:
                baked_in = json.load(f)
                if isinstance(baked_in, dict):
                    # Descramble dev secrets from JSON dat (Double XOR stack)
                    for k, v in baked_in.items():
                        if isinstance(v, str):
                            # Reverse order: dev_vpx_scrambler_99 THEN vpx_secret_key_2026
                            descrambled = _scramble(_scramble_dev(v))
                            baked_in[k] = descrambled
                    
                    devid = baked_in.get("screenscraper_devid", "")
                    print(f"Loaded baked-in config from {dat_path} (DevID length: {len(devid)})")
                    cfg_data.update(baked_in)
        except Exception as e:
            # Try marshal as fallback for legacy builds
            try:
                with open(dat_path, "rb") as f:
                    baked_in = marshal.load(f)
                    if isinstance(baked_in, dict):
                        for k, v in baked_in.items():
                            if isinstance(v, str):
                                baked_in[k] = _scramble(_scramble_dev(v))
                        cfg_data.update(baked_in)
            except:
                print(f"Warning: Could not load obfuscated config: {e}")

    # 3. Load user-specific config
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                user_data = json.load(f)

            # Map legacy keys if any
            if "vpinballx_support_dir" in user_data and "support_dir" not in user_data:
                user_data["support_dir"] = user_data.pop("vpinballx_support_dir")

            # Decode password if present
            if "screenscraper_password" in user_data:
                user_data["screenscraper_password"] = decode_password(
                    user_data["screenscraper_password"]
                )

            # Update with user data, filtering for valid fields (ignoring legacy paths)
            valid_user_data = {
                k: v for k, v in user_data.items() if k in AppConfig.model_fields
            }

            # Explicitly ensure internal paths are NOT taken from JSON
            for key in ["support_dir", "vps_db_path", "db_path"]:
                valid_user_data.pop(key, None)

            # CRITICAL: Do not let empty user strings override baked-in developer credentials
            for key in [
                "screenscraper_devid",
                "screenscraper_devpassword",
                "screenscraper_username",
                "screenscraper_password",
            ]:
                if (
                    key in valid_user_data
                    and not valid_user_data[key]
                    and cfg_data.get(key)
                ):
                    valid_user_data.pop(key)

            cfg_data.update(valid_user_data)
        except Exception as e:
            print(f"Warning: Could not load user config: {e}")

    # 4. Environment Overrides (Convenience for local development)
    if not cfg_data.get("screenscraper_devid"):
        cfg_data["screenscraper_devid"] = os.environ.get("SS_DEV_ID", "")
    if not cfg_data.get("screenscraper_devpassword"):
        cfg_data["screenscraper_devpassword"] = os.environ.get("SS_DEVPASS", "")
    if not cfg_data.get("screenscraper_dev_user"):
        cfg_data["screenscraper_dev_user"] = os.environ.get("SS_USER", "")
    if not cfg_data.get("screenscraper_dev_pass"):
        cfg_data["screenscraper_dev_pass"] = os.environ.get("SS_PASS", "")

    return AppConfig(**cfg_data) if cfg_data else AppConfig()


def save_config(cfg: AppConfig) -> None:
    """Persist config to disk."""
    try:
        data = cfg.model_dump()

        # Security: Encode user password
        if data.get("screenscraper_password"):
            data["screenscraper_password"] = encode_password(
                data["screenscraper_password"]
            )

        # Security: Never save dev credentials to JSON
        data.pop("screenscraper_devid", None)
        data.pop("screenscraper_devpassword", None)

        # Path Portability: Relativize paths to home directory
        path_keys = ["tables_dir", "esde_media_dir", "esde_gamelists_dir"]
        for pk in path_keys:
            if data.get(pk):
                data[pk] = relativize_path(data[pk])

        with open(CONFIG_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving config: {e}")


# Global singleton
config = load_config()
# Proactive save to ensure all credentials on disk are immediately obfuscated in the new format
save_config(config)
