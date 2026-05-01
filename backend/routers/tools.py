import io
import logging
import os
import shutil
import stat
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
import platform

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from backend.core.config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])

# ── NVRAM Repository Logic ──────────────────────────────────────────


def get_nvram_repo_dir() -> Path:
    return Path(config.support_dir) / "nvrams"


def ensure_nvram_repo():
    get_nvram_repo_dir().mkdir(parents=True, exist_ok=True)


@router.post("/nvram/upload")
async def upload_nvram(file: UploadFile = File(...)):
    """Uploads .nv files or a .zip containing .nv files to the master repository."""
    ensure_nvram_repo()

    filename = file.filename or "unknown"
    content = await file.read()
    added_count = 0

    if filename.lower().endswith(".zip"):
        try:
            with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
                for zip_info in zf.infolist():
                    if zip_info.filename.lower().endswith(".nv"):
                        # Extract just the file name without directories
                        nv_filename = Path(zip_info.filename).name
                        if nv_filename:
                            target_path = get_nvram_repo_dir() / nv_filename
                            with zf.open(zip_info) as source, open(
                                target_path, "wb"
                            ) as target:
                                shutil.copyfileobj(source, target)
                            added_count += 1
            return {"success": True, "added": added_count}
        except zipfile.BadZipFile:
            return {"success": False, "error": "Invalid zip file."}
        except Exception as e:
            return {"success": False, "error": f"Failed to extract zip: {e}"}

    elif filename.lower().endswith(".nv"):
        try:
            target_path = get_nvram_repo_dir() / filename
            with open(target_path, "wb") as f:
                f.write(content)
            return {"success": True, "added": 1}
        except Exception as e:
            return {"success": False, "error": f"Failed to save .nv file: {e}"}

    return {
        "success": False,
        "error": "Unsupported file type. Please upload .nv or .zip files.",
    }


@router.get("/nvram/list")
async def list_nvrams():
    """List all .nv files in the master repository."""
    repo_dir = get_nvram_repo_dir()
    if not repo_dir.exists():
        return {"files": []}

    files = []
    try:
        # Use rglob to be recursive in case of nested folders from zip uploads
        for f in repo_dir.rglob("*.nv"):
            if f.is_file():
                files.append(f.name)

        # Sort and return
        files = sorted(list(set(files)))  # deduplicate just in case
        logger.info(f"NVRAM Repo Scan: Found {len(files)} files in {repo_dir}")
        return {"files": files}
    except Exception as e:
        logger.error(f"Failed to list NVRAM repository: {e}")
        return {"files": [], "error": str(e)}


@router.delete("/nvram/{filename}")
async def delete_nvram(filename: str):
    """Delete a file from the master repository."""
    repo_dir = get_nvram_repo_dir()
    # Support subdirectories if any, but usually they are flat
    file_path = repo_dir / filename
    if file_path.exists():
        try:
            file_path.unlink()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    return {"success": False, "error": "File not found"}


@router.post("/nvram/install")
async def install_nvrams():
    """Bulk install NVRAMs from repo to matching table folders."""
    import backend.core.database as db
    from backend.services.vpx_parser import VPXParser

    repo_dir = get_nvram_repo_dir()
    if not repo_dir.exists():
        return {"success": False, "error": "NVRAM repository does not exist."}

    repo_files = {
        f.name.lower(): f
        for f in repo_dir.iterdir()
        if f.is_file() and f.suffix.lower() == ".nv"
    }
    if not repo_files:
        return {"success": False, "error": "NVRAM repository is empty."}

    tables = await db.get_tables(limit=2000)  # Get all tables
    installed_count = 0
    failures = []

    for table in tables:
        try:
            folder_path = Path(table["folder_path"])
            if not folder_path.exists():
                continue

            # Identify ROMs for this table
            vpx_path = folder_path / table["filename"]
            if not vpx_path.exists():
                continue

            # detect_rom returns the most likely ROM name as a string
            rom_name = VPXParser.detect_rom(vpx_path, vps_id=table.get("vps_id"))
            if not rom_name:
                continue

            nv_filename = f"{rom_name.lower()}.nv"
            if nv_filename in repo_files:
                # Target: <table_dir>/pinmame/nvram/<rom>.nv
                nv_dest_dir = folder_path / "pinmame" / "nvram"
                nv_dest_dir.mkdir(parents=True, exist_ok=True)

                # Copy with original case from repo if possible, though .nv is usually lowercase
                shutil.copy2(
                    repo_files[nv_filename], nv_dest_dir / repo_files[nv_filename].name
                )
                installed_count += 1
        except Exception as e:
            failures.append(f"Error installing for {table['display_name']}: {str(e)}")

    return {"success": True, "installed": installed_count, "failures": failures}


# ── ES-DE Integration Logic ──────────────────────────────────────────


class ESDEIntegrationResponse(BaseModel):
    success: bool
    message: str


@router.post("/esde-integration", response_model=ESDEIntegrationResponse)
async def apply_esde_integration():
    try:
        is_linux = platform.system() == "Linux"
        
        if is_linux:
            esde_dir = Path.home() / ".emulationstation"
        else:
            esde_dir = Path.home() / "ES-DE"
            
        esde_scripts_dir = esde_dir / "scripts"
        esde_scripts_dir.mkdir(parents=True, exist_ok=True)
        script_path = esde_scripts_dir / "launch_vpinball.sh"

        vpx_path = config.vpx_standalone_app_path

        # We need the binary path to call it directly so bash waits for it to exit
        if vpx_path.endswith(".app"):
            # If they provided an .app path, try to guess the binary inside
            vpx_bin = vpx_path + "/Contents/MacOS/VPinballX_BGFX"
        else:
            vpx_bin = vpx_path

        # Focus logic for Linux using wmctrl
        linux_focus_logic = """
# Bring ES-DE back to the front on Linux
if command -v wmctrl >/dev/null 2>&1; then
    wmctrl -a "EmulationStation" || wmctrl -a "ES-DE"
elif command -v xdotool >/dev/null 2>&1; then
    xdotool search --name "EmulationStation" windowactivate || xdotool search --name "ES-DE" windowactivate
fi
""" if is_linux else ""

        # Focus logic for macOS using osascript
        macos_focus_logic = """
# Bring ES-DE back to the front only on macOS
if [ "$(uname)" = "Darwin" ]; then
osascript <<'EOF'
tell application "System Events"
    try
        set frontmost of process "ES-DE" to true
    on error
        try
            set frontmost of process "EmulationStation Desktop Edition" to true
        on error
            try
                tell application "ES-DE" to activate
            end try
        end try
    end try
end tell
EOF
fi
""" if not is_linux else ""

        script_content = f"""#!/bin/bash
# Visual Pinball Launch Script for ES-DE
# Usage: launch_vpinball.sh "/path/to/table.vpx"

# Handle both calling conventions:
# ES-DE may pass: script.sh -play /path/to/table.vpx
# or simply:      script.sh /path/to/table.vpx
if [ "$1" = "-play" ]; then
    TABLE_PATH="$2"
else
    TABLE_PATH="$1"
fi

VP_BIN="{vpx_bin}"
VP_DIR="$(dirname "$VP_BIN")"
TABLES_DIR="{config.expanded_tables_dir}"

# Ensure flatten.txt exists so ES-DE doesn't show subfolders
if [ ! -f "$TABLES_DIR/flatten.txt" ]; then
    touch "$TABLES_DIR/flatten.txt"
fi

# Check if the table file exists
if [ -z "$TABLE_PATH" ] || [ ! -f "$TABLE_PATH" ]; then
    echo "Error: Table file not found or empty: $TABLE_PATH"
    exit 1
fi

echo "Launching Visual Pinball with table: $(basename "$TABLE_PATH")"

# cd into the binary directory so it can find its relative dependencies
cd "$VP_DIR" || exit 1

# Call binary directly — bash waits for it to exit before continuing
"$VP_BIN" -play "$TABLE_PATH"

echo "Visual Pinball has exited."
{linux_focus_logic}{macos_focus_logic}
echo "Script completed successfully."
"""
        with open(script_path, "w") as f:
            f.write(script_content)

        # Make script executable
        st = os.stat(script_path)
        os.chmod(script_path, st.st_mode | stat.S_IEXEC)

        # Remove quarantine flag (macOS only)
        if not is_linux:
            subprocess.run(
                ["xattr", "-d", "com.apple.quarantine", str(script_path)],
                stderr=subprocess.DEVNULL,
                check=False,
            )

        # 2. Remove legacy systeminfo.txt if it exists to prevent system overrides
        tables_dir = Path(config.expanded_tables_dir)
        legacy_systeminfo = tables_dir / "systeminfo.txt"
        if legacy_systeminfo.exists():
            try:
                legacy_systeminfo.unlink()
            except Exception as e:
                logger.warning(f"Could not remove legacy systeminfo.txt: {e}")

        # 3. Setup es_find_rules.xml to point the %EMULATOR_VISUAL-PINBALL% variable to our script
        # esde_dir already set above
        custom_systems_dir = esde_dir / "custom_systems"
        custom_systems_dir.mkdir(parents=True, exist_ok=True)

        find_rules_file = custom_systems_dir / "es_find_rules.xml"
        if find_rules_file.exists():
            parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
            fr_tree = ET.parse(find_rules_file, parser=parser)
            fr_root = fr_tree.getroot()
        else:
            fr_root = ET.Element("ruleList")
            fr_tree = ET.ElementTree(fr_root)

        # Add or update VISUAL-PINBALL rule
        vp_rule = None
        for emu in fr_root.findall("emulator"):
            if emu.get("name") == "VISUAL-PINBALL":
                vp_rule = emu
                break

        if vp_rule is None:
            vp_rule = ET.SubElement(fr_root, "emulator", name="VISUAL-PINBALL")

        # Check if staticpath rule for our script exists
        rule_exists = False
        for rule in vp_rule.findall("rule"):
            if rule.get("type") == "staticpath":
                for entry in rule.findall("entry"):
                    if entry.text == str(script_path):
                        rule_exists = True
                        break

        if not rule_exists:
            new_rule = ET.SubElement(vp_rule, "rule", type="staticpath")
            ET.SubElement(new_rule, "entry").text = str(script_path)

        fr_tree.write(find_rules_file, encoding="utf-8", xml_declaration=True)

        # 4. Modify ES-DE custom_systems.xml
        xml_file = custom_systems_dir / "custom_systems.xml"

        # Read existing XML or create new
        if xml_file.exists():
            parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
            tree = ET.parse(xml_file, parser=parser)
            root = tree.getroot()
        else:
            root = ET.Element("systemList")
            tree = ET.ElementTree(root)

        vpinball_system = None
        for system in root.findall("system"):
            name = system.find("name")
            if name is not None and name.text == "vpinball":
                vpinball_system = system
                break

        if vpinball_system is not None:
            # Update root command
            command_elem = vpinball_system.find("command")
            if command_elem is None:
                command_elem = ET.SubElement(vpinball_system, "command")
            command_elem.set("label", "Visual Pinball X (Script)")
            command_elem.text = "%EMULATOR_VISUAL-PINBALL% %ROM%"

            # Remove old emulators block since we're using root command fallback now
            emulators = vpinball_system.find("emulators")
            if emulators is not None:
                vpinball_system.remove(emulators)
        else:
            # Create new system
            new_system = ET.SubElement(root, "system")
            ET.SubElement(new_system, "name").text = "vpinball"
            ET.SubElement(new_system, "fullname").text = "Visual Pinball"
            ET.SubElement(new_system, "path").text = str(config.expanded_tables_dir)
            ET.SubElement(new_system, "extension").text = ".vpx .VPX"
            cmd = ET.SubElement(new_system, "command")
            cmd.set("label", "Visual Pinball X (Script)")
            cmd.text = "%EMULATOR_VISUAL-PINBALL% %ROM%"

            ET.SubElement(new_system, "platform").text = "vpinball"
            ET.SubElement(new_system, "theme").text = "vpinball"

        tree.write(xml_file, encoding="utf-8", xml_declaration=True)

        # 5. Pre-set the preferred emulator without UI by modifying es_settings.xml
        for settings_path in [
            Path.home() / ".emulationstation" / "es_settings.xml",
            Path.home() / "ES-DE" / "settings" / "es_settings.xml",
        ]:
            if settings_path.exists():
                try:
                    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
                    s_tree = ET.parse(settings_path, parser=parser)
                    s_root = s_tree.getroot()

                    found = False
                    for string_elem in s_root.findall("string"):
                        if string_elem.get("name") == "AlternativeEmulator_vpinball":
                            string_elem.set("value", "Visual Pinball X (Script)")
                            found = True
                            break

                    if not found:
                        new_string = ET.SubElement(s_root, "string")
                        new_string.set("name", "AlternativeEmulator_vpinball")
                        new_string.set("value", "Visual Pinball X (Script)")

                    s_tree.write(settings_path, encoding="utf-8", xml_declaration=True)
                except Exception as e:
                    logger.warning(f"Could not update {settings_path}: {e}")

        # 6. Create flatten.txt in the ROMs directory
        flatten_file = tables_dir / "flatten.txt"
        if not flatten_file.exists():
            with open(flatten_file, "w") as f:
                f.write("")

        return ESDEIntegrationResponse(
            success=True, message="ES-DE Integration applied successfully."
        )
    except Exception as e:
        logger.error(f"Error applying ES-DE integration: {e}")
        return ESDEIntegrationResponse(success=False, message=str(e))
