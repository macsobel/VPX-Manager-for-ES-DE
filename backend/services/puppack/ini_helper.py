import re
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

def update_puppack_ini_config(ini_path: Path, config_updates: dict) -> bool:
    """Updates the [Plugin.PUP] section of the INI with PuP configuration."""
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

    # First pass: strip old values from ANY section
    for line in lines:
        stripped = line.strip().lower()
        is_key = False
        for key in keys_to_update:
            if stripped.startswith(key + "=") or stripped.startswith(key + " ="):
                is_key = True
                break
        if not is_key:
            new_lines.append(line)

    # Find [Plugin.PUP] section
    section_idx = -1
    for i, line in enumerate(new_lines):
        if line.strip().lower() == "[plugin.pup]":
            section_idx = i
            break

    if section_idx == -1:
        new_lines.append("")
        new_lines.append("[Plugin.PUP]")
        section_idx = len(new_lines) - 1

    # Insert new values after [Plugin.PUP] header
    insert_idx = section_idx + 1
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
    """Reads the [Plugin.PUP] section of the INI for PuP configuration.
    Returns pad values keyed by the VPX format (e.g. bgpadleft, svpadtop)
    and also synthesized legacy keys for the frontend (e.g. pupbackglasswindow).
    """
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
    in_plugin_pup = False

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith((";", "#")):
            continue

        if stripped.lower().startswith("["):
            in_plugin_pup = (stripped.lower() == "[plugin.pup]")
            continue

        if in_plugin_pup and "=" in stripped:
            key, val = [p.strip() for p in stripped.split("=", 1)]
            try:
                if "." in val:
                    config[key.lower()] = float(val)
                else:
                    config[key.lower()] = int(val)
            except ValueError:
                config[key.lower()] = val

    # Synthesize legacy keys from VPX pad values so the frontend can
    # convert to X, Y, Width, Height using its monitor dimensions.
    # Frontend reads: pupbackglasswindow, bgpadleft, bgpadtop, bgpadright, bgpadbottom
    # and similarly for DMD (svpad*).
    PAD_TO_SCREEN = {
        "bgpad": "pupbackglass",
        "svpad": "pupdmd",
    }

    for pad_prefix, screen_prefix in PAD_TO_SCREEN.items():
        has_pads = f"{pad_prefix}left" in config
        if has_pads:
            config[f"{screen_prefix}window"] = 1
        # Also mark FullDMD as enabled if SV pads exist
        if pad_prefix == "svpad" and has_pads:
            config["pupfulldmdwindow"] = 1

    return config


def ensure_plugin_pup_section(ini_path: Path) -> bool:
    """Ensures the [Plugin.PUP] section exists with Enable = 1."""
    content = ""
    try:
        with open(ini_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception:
        try:
            with open(ini_path, "r", encoding="windows-1252") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Error reading INI for Plugin.PUP section: {e}")
            return False

    lines = content.splitlines()

    # Find existing [Plugin.PUP] section
    section_start = -1
    section_end = -1
    for i, line in enumerate(lines):
        stripped = line.strip().lower()
        if stripped == "[plugin.pup]":
            section_start = i
        elif section_start >= 0 and stripped.startswith("["):
            section_end = i
            break

    if section_start == -1:
        # Section doesn't exist — append it
        lines.append("")
        lines.append("[Plugin.PUP]")
        lines.append(f"Enable = 1")
    else:
        # Section exists — update Enable and PUPFolder in place
        if section_end == -1:
            section_end = len(lines)

        # Remove old Enable/PUPFolder lines within the section
        new_section_lines = []
        for i in range(section_start + 1, section_end):
            key = lines[i].strip().lower().split("=")[0].strip() if "=" in lines[i] else ""
            if key not in ("enable"):
                new_section_lines.append(lines[i])

        # Rebuild: everything before section, section header, new values, remaining section lines, rest of file
        rebuilt = lines[:section_start + 1]
        rebuilt.append(f"Enable = 1")
        rebuilt.extend(new_section_lines)
        rebuilt.extend(lines[section_end:])
        lines = rebuilt

    final_content = "\n".join(lines) + "\n"

    try:
        with open(ini_path, "w", encoding="utf-8") as f:
            f.write(final_content)
        return True
    except Exception as e:
        logger.error(f"Failed to write [Plugin.PUP] section: {e}")
        return False
