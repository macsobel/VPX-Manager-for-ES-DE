import re
import os
import csv
import shutil
import logging
from pathlib import Path
from typing import Optional, List, Dict

logger = logging.getLogger("puppack_manager")

class PupPackManager:
    @staticmethod
    def identify_options(pup_dir: Path) -> List[Dict]:
        """Scans the PUP Pack directory for .bat files and extracts their names as options."""
        options = []
        if not pup_dir.exists() or not pup_dir.is_dir():
            return options

        # Look for .bat files that represent setup options
        for bat_file in pup_dir.glob("*.bat"):
            options.append({
                "name": bat_file.stem,
                "file": bat_file.name,
                "path": str(bat_file)
            })

        # Sort options alphabetically
        options.sort(key=lambda x: x["name"])
        return options

    @staticmethod
    def apply_option(pup_dir: Path, bat_file_name: str) -> bool:
        """Parses a .bat file to find `copy` commands and applies them to the filesystem."""
        bat_path = pup_dir / bat_file_name
        if not bat_path.exists():
            logger.error(f"PUP Pack setup script not found: {bat_path}")
            return False

        logger.info(f"Applying PUP Pack option from script: {bat_file_name}")

        success = True
        try:
            with open(bat_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            commands = []
            deletions = []
            
            for line in content.splitlines():
                line = line.strip()
                if not line or line.lower().startswith('rem'):
                    continue
                
                # Parse line into parts, respecting quotes
                parts = []
                current = []
                in_quotes = False
                for char in line:
                    if char == '"':
                        in_quotes = not in_quotes
                    elif char.isspace() and not in_quotes:
                        if current:
                            parts.append("".join(current))
                            current = []
                    else:
                        current.append(char)
                if current:
                    parts.append("".join(current))
                
                if not parts:
                    continue
                
                cmd = parts[0].lower()
                # Filter out flags (starting with /)
                args = [p for p in parts[1:] if not p.startswith('/')]
                
                if cmd in ('copy', 'xcopy'):
                    if len(args) == 1:
                        commands.append((args[0], "."))
                    elif len(args) >= 2:
                        commands.append((args[0], args[1]))
                elif cmd in ('del', 'erase'):
                    if len(args) >= 1:
                        deletions.append(args[0])

            if not commands and not deletions:
                logger.warning(f"No usable commands found in {bat_file_name}")
                return False

            # Handle deletions first
            for target in deletions:
                target_clean = target.replace('\\', '/')
                target_path = pup_dir / target_clean
                if target_path.exists():
                    try:
                        if target_path.is_file():
                            target_path.unlink()
                            logger.info(f"Deleted {target_clean}")
                        elif target_path.is_dir():
                            shutil.rmtree(target_path)
                            logger.info(f"Deleted directory {target_clean}")
                    except Exception as e:
                        logger.warning(f"Failed to delete {target_clean}: {e}")

            # Handle copies
            for src, dst in commands:
                # Normalize paths from Windows (\) to POSIX (/)
                src_clean = src.replace('\\', '/')
                dst_clean = dst.replace('\\', '/')

                if dst_clean.startswith("./"):
                    dst_clean = dst_clean[2:]
                if dst_clean == ".":
                    dst_clean = ""

                # Handle * at end of src (means copy contents of directory)
                if src_clean.endswith('/*'):
                    src_clean = src_clean[:-2]
                elif src_clean.endswith('*'):
                    src_clean = src_clean[:-1]

                # If after stripping *, src_clean ends with /, remove it
                if src_clean.endswith('/'):
                    src_clean = src_clean[:-1]

                # Resolve paths relative to the pup_dir
                src_path = pup_dir / src_clean
                dst_path = pup_dir / dst_clean

                if not src_path.exists():
                    logger.warning(f"Source path not found during PUP Pack setup: {src_path}")
                    success = False
                    continue

                try:
                    if src_path.is_file():
                        dst_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src_path, dst_path)
                        logger.info(f"Copied {src_clean} -> {dst_clean}")
                    elif src_path.is_dir():
                        # Copy contents of directory
                        shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
                        logger.info(f"Copied directory contents {src_clean} -> {dst_clean}")
                except Exception as e:
                    logger.error(f"Failed to copy {src_clean} to {dst_clean}: {e}")
                    success = False

        except Exception as e:
            logger.error(f"Error parsing PUP Pack script {bat_file_name}: {e}")
            return False

        return success

    @staticmethod
    def get_active_screens(pup_dir: Path) -> List[Dict]:
        """Parses screens.pup to find which screens are currently active/configured."""
        screens = []
        screens_path = pup_dir / "screens.pup"
        
        logger.info(f"Checking for screens.pup in {screens_path}")
        if not screens_path.exists():
            logger.warning(f"screens.pup not found at {screens_path}")
            return screens

        try:
            # Handle BOM and encoding
            content = ""
            try:
                with open(screens_path, 'r', encoding='utf-16', errors='replace') as f:
                    content = f.read()
                    if "ScreenNum" not in content: # Not UTF-16
                        raise UnicodeError()
            except:
                with open(screens_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

            if not content:
                return screens

            # Remove BOM if present
            if content.startswith('\ufeff'):
                content = content[1:]

            lines = content.splitlines()
            if not lines:
                return screens

            reader = csv.DictReader(lines)
            for row in reader:
                # Clean keys (remove BOM or spaces)
                clean_row = {str(k).strip().lstrip('\ufeff'): v for k, v in row.items()}
                status = clean_row.get("Active", "").strip()
                if status and status != "0":
                    screens.append({
                        "description": clean_row.get("ScreenDes", "Unknown Screen"),
                        "status": status
                    })
            logger.info(f"Found {len(screens)} active screens in {screens_path}")
        except Exception as e:
            logger.error(f"Error parsing screens.pup in {pup_dir}: {e}")

        return screens

pup_pack_manager = PupPackManager()
