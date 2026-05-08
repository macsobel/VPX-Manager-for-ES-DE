import re
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def update_puppack_ini_config(ini_path: Path, config_updates: dict) -> bool:
    """Updates the [Standalone] section of the INI with PuP configuration."""
    content = ""
    try:
        with open(ini_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        try:
            with open(ini_path, "r", encoding="windows-1252") as f:
                content = f.read()
        except Exception as e2:
            logger.error(f"Error reading INI for PuP Pack config update: {e2}")
            return False

    lines = content.splitlines()
    new_lines = []

    # Get keys we are updating
    keys_to_update = [k.lower() for k in config_updates.keys()]

    # First pass: strip old values
    for line in lines:
        stripped = line.strip().lower()
        is_key = False
        for key in keys_to_update:
            if stripped.startswith(key + "=") or stripped.startswith(key + " ="):
                is_key = True
                break
        if not is_key:
            new_lines.append(line)

    # Find [Standalone] section
    standalone_idx = -1
    for i, line in enumerate(new_lines):
        if line.strip().lower() == "[standalone]":
            standalone_idx = i
            break

    if standalone_idx == -1:
        new_lines.append("")
        new_lines.append("[Standalone]")
        standalone_idx = len(new_lines) - 1

    # Insert new values
    insert_idx = standalone_idx + 1
    for key, value in config_updates.items():
        if value is not None:
            new_lines.insert(insert_idx, f"{key} = {value}")
            insert_idx += 1

    final_content = "\n".join(new_lines) + "\n"

    try:
        with open(ini_path, "w", encoding="utf-8") as f:
            f.write(final_content)
        return True
    except Exception as e:
        logger.error(f"Failed to write INI for PuP Pack config update: {e}")
        return False

def read_puppack_ini_config(ini_path: Path) -> dict:
    """Reads the [Standalone] section of the INI for PuP configuration."""
    content = ""
    if not ini_path.exists():
        return {}

    try:
        with open(ini_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        try:
            with open(ini_path, "r", encoding="windows-1252") as f:
                content = f.read()
        except Exception:
            return {}

    config = {}
    in_standalone = False

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith((";", "#")):
            continue

        if stripped.lower().startswith("["):
            in_standalone = (stripped.lower() == "[standalone]")
            continue

        if in_standalone and "=" in stripped:
            key, val = [p.strip() for p in stripped.split("=", 1)]
            if key.lower().startswith("pup"):
                # Parse numeric values
                try:
                    if "." in val:
                        config[key.lower()] = float(val)
                    else:
                        config[key.lower()] = int(val)
                except ValueError:
                    config[key.lower()] = val

    return config
