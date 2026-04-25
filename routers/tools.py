from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel
from pathlib import Path
import os
import stat
import zipfile
import io
import shutil
import subprocess
import xml.etree.ElementTree as ET
from config import config
import logging

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
                            with zf.open(zip_info) as source, open(target_path, "wb") as target:
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

    return {"success": False, "error": "Unsupported file type. Please upload .nv or .zip files."}


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
        files = sorted(list(set(files))) # deduplicate just in case
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
    import database as db
    from services.vpx_parser import VPXParser
    
    repo_dir = get_nvram_repo_dir()
    if not repo_dir.exists():
        return {"success": False, "error": "NVRAM repository does not exist."}
    
    repo_files = {f.name.lower(): f for f in repo_dir.iterdir() if f.is_file() and f.suffix.lower() == ".nv"}
    if not repo_files:
        return {"success": False, "error": "NVRAM repository is empty."}
    
    tables = await db.get_tables(limit=2000) # Get all tables
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
                shutil.copy2(repo_files[nv_filename], nv_dest_dir / repo_files[nv_filename].name)
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
        # 1. Generate the launcher script
        app_support = Path(config.support_dir)
        app_support.mkdir(parents=True, exist_ok=True)

        script_path = app_support / "vpx_launcher.sh"

        vpx_app = Path(os.path.expanduser(config.vpx_standalone_app_path))

        vpx_binary_name = "VPinballX_GL" if config.vpx_use_flavor == "GL" else "VPinballX_BGFX"
        vpx_binary = vpx_app / "Contents" / "MacOS" / vpx_binary_name

        script_content = f"""#!/bin/bash
# Focus-aware launcher for VPX Standalone -> ES-DE
ROM="$1"
"{vpx_binary}" -play "$ROM"
osascript -e 'tell application "EmulationStation Desktop Edition" to activate'
"""
        with open(script_path, "w") as f:
            f.write(script_content)

        # Make script executable
        st = os.stat(script_path)
        os.chmod(script_path, st.st_mode | stat.S_IEXEC)

        # Remove quarantine flag
        subprocess.run(
            ["xattr", "-d", "com.apple.quarantine", str(script_path)],
            stderr=subprocess.DEVNULL,
            check=False
        )

        # 2. Modify ES-DE custom_systems.xml
        esde_dir = Path.home() / "ES-DE"
        custom_systems_dir = esde_dir / "custom_systems"
        custom_systems_dir.mkdir(parents=True, exist_ok=True)
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
            # Update command
            command_elem = vpinball_system.find("command")
            if command_elem is None:
                command_elem = ET.SubElement(vpinball_system, "command")
            command_elem.text = f'"{script_path}" %ROM%'
        else:
            # Create new system
            new_system = ET.SubElement(root, "system")
            ET.SubElement(new_system, "name").text = "vpinball"
            ET.SubElement(new_system, "fullname").text = "Visual Pinball"
            ET.SubElement(new_system, "path").text = str(config.expanded_tables_dir)
            ET.SubElement(new_system, "extension").text = ".vpx .VPX"
            ET.SubElement(new_system, "command").text = f'"{script_path}" %ROM%'

            ET.SubElement(new_system, "platform").text = "vpinball"
            ET.SubElement(new_system, "theme").text = "vpinball"

        tree.write(xml_file, encoding="utf-8", xml_declaration=True)

        # 3. Create flatten.txt in the ROMs directory
        flatten_file = Path(config.expanded_tables_dir) / "flatten.txt"
        if not flatten_file.exists():
            with open(flatten_file, "w") as f:
                f.write("")

        return ESDEIntegrationResponse(success=True, message="ES-DE Integration applied successfully.")
    except Exception as e:
        return ESDEIntegrationResponse(success=False, message=str(e))
