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

        # Utility scripts that are NOT setup options
        EXCLUSIONS = {
            "pupinit.bat", "getcodec.bat", "getcodec2.bat", "getlen.bat",
            "normalizemp3.bat", "editthispuppack.bat", "vlc-kill.bat",
            "ffmpeg.bat", "ffprobe.bat"
        }

        # Look for .bat files recursively (up to 2 levels deep from identified root)
        for bat_file in pup_dir.glob("**/*.bat"):
            if bat_file.name.lower() in EXCLUSIONS:
                continue
            
            # Skip files in common internal folders or those that seem like component parts
            if "__macosx" in str(bat_file).lower():
                continue

            # Calculate relative path from pup_dir to use as file identifier
            try:
                rel_path = bat_file.relative_to(pup_dir)
            except ValueError:
                rel_path = Path(bat_file.name)
            
            options.append({
                "name": bat_file.stem,
                "file": str(rel_path),
                "path": str(bat_file)
            })

        # Sort options alphabetically
        options.sort(key=lambda x: x["name"])
        return options

    @staticmethod
    def apply_option(pup_dir: Path, bat_file_name: str) -> bool:
        """Parses a .bat file to find `copy` commands and applies them to the filesystem."""
        # bat_file_name might be a relative path (e.g. "Options/2-screen.bat")
        bat_path = pup_dir / bat_file_name
        if not bat_path.exists():
            logger.error(f"PUP Pack setup script not found: {bat_path}")
            return False

        # All relative paths in the .bat file should be relative to where the .bat file is
        base_dir = bat_path.parent

        logger.info(f"Applying PUP Pack option from script: {bat_file_name} (Base: {base_dir})")

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
                target_path = base_dir / target_clean
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
                if dst_clean == "." or dst_clean == "":
                    dst_path = base_dir
                else:
                    dst_path = base_dir / dst_clean

                # Check for wildcards
                if '*' in src_clean:
                    try:
                        # Glob matches are relative to base_dir
                        matches = list(base_dir.glob(src_clean))
                        if not matches:
                            logger.warning(f"No files matched glob pattern: {src_clean}")
                            continue

                        for match in matches:
                            # Calculate destination
                            if dst_path.is_dir() or dst_clean == "" or dst_clean == ".":
                                target = dst_path / match.name
                            else:
                                # If dst was a specific filename but we have multiple matches, 
                                # this is usually a script error, but we'll assume directory-style copy
                                target = dst_path / match.name

                            try:
                                target.parent.mkdir(parents=True, exist_ok=True)
                                if match.is_file():
                                    if target.name.lower() == "screens.pup":
                                        PupPackManager.process_screens_pup(match, target)
                                    else:
                                        shutil.copy2(match, target)
                                elif match.is_dir():
                                    shutil.copytree(match, target, dirs_exist_ok=True)
                            except Exception as e:
                                logger.error(f"Failed to copy match {match.name}: {e}")
                                success = False
                    except Exception as e:
                        logger.error(f"Glob processing failed for {src_clean}: {e}")
                        success = False
                    continue

                # Normal copy logic
                src_path = base_dir / src_clean
                if not src_path.exists():
                    logger.warning(f"Source path not found during PUP Pack setup: {src_path}")
                    success = False
                    continue

                try:
                    if src_path.is_file():
                        # If dst_path is a directory, append the filename
                        final_dst = dst_path / src_path.name if (dst_path.exists() and dst_path.is_dir()) or dst_clean == "" else dst_path
                        final_dst.parent.mkdir(parents=True, exist_ok=True)

                        if final_dst.name.lower() == "screens.pup":
                            PupPackManager.process_screens_pup(src_path, final_dst)
                        else:
                            shutil.copy2(src_path, final_dst)
                    elif src_path.is_dir():
                        shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
                except Exception as e:
                    logger.error(f"Failed to copy {src_clean} to {dst_clean}: {e}")
                    success = False

        except Exception as e:
            logger.error(f"Error parsing PUP Pack script {bat_file_name}: {e}")
            return False

        return success

    @staticmethod
    def process_screens_pup(src_path: Path, dst_path: Path) -> None:
        """Parses screens.pup CSV, scales coordinates according to the cabinet profile, and strips Windows-only params."""
        from backend.core.config import config

        # Load the global displays mapping to get scale factors for each role
        saved_displays = getattr(config, "displays", [])

        # Mapping from PUP ScreenNum to logical Role
        # Standard PUP layout:
        # 0: Topper
        # 1: DMD
        # 2: Backglass
        # 3: PlayField
        # 4: Music
        # 5: Menu
        # 6: Select
        # 7: Other1/BackGlass2
        # 8: Other2/Topper2
        # 9: GameInfo
        # 10: GameHelp

        role_map = {
            "0": "Topper",
            "1": "DMD",
            "2": "Backglass",
            "3": "Playfield",
            "5": "FullDMD",
            "7": "Backglass", # Backglass 2
            "8": "Topper",    # Topper 2
        }

        scale_map = {}
        for screen_num, role in role_map.items():
            display = next((d for d in saved_displays if d.get("role") == role), None)
            if display and display.get("scale_factor"):
                scale_map[screen_num] = float(display.get("scale_factor", 1.0))

        content = ""
        try:
            with open(src_path, 'r', encoding='utf-16', errors='replace') as f:
                content = f.read()
                if "ScreenNum" not in content:
                    raise UnicodeError()
        except:
            with open(src_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

        if not content:
            shutil.copy2(src_path, dst_path)
            return

        has_bom = content.startswith('\ufeff')
        if has_bom:
            content = content[1:]

        lines = content.splitlines()
        if not lines:
            shutil.copy2(src_path, dst_path)
            return

        try:
            # We want to output in UTF-8
            with open(dst_path, 'w', encoding='utf-8', newline='') as f:
                reader = csv.reader(lines)
                writer = csv.writer(f)

                header = next(reader, None)
                if not header:
                    shutil.copy2(src_path, dst_path)
                    return

                if has_bom:
                    f.write('\ufeff')

                writer.writerow(header)

                clean_header = [str(col).strip().lstrip('\ufeff') for col in header]

                try:
                    screen_num_idx = clean_header.index("ScreenNum")
                    custom_pos_idx = clean_header.index("CustomPos")
                except ValueError:
                    shutil.copy2(src_path, dst_path)
                    return

                for row in reader:
                    if not row:
                        continue

                    if len(row) <= max(screen_num_idx, custom_pos_idx):
                        writer.writerow(row)
                        continue

                    screen_num = str(row[screen_num_idx]).strip()

                    # CustomPos might spill into extra columns due to unquoted commas
                    custom_pos_parts = row[custom_pos_idx:]
                    custom_pos_str = ",".join(custom_pos_parts).strip()

                    if custom_pos_str:
                        parts = [p.strip() for p in custom_pos_str.split(',')]
                        if len(parts) >= 5:
                            parts = parts[:5]

                            scale_factor = scale_map.get(screen_num, 1.0)
                            if scale_factor != 1.0:
                                try:
                                    for i in range(1, 5):
                                        if parts[i]:
                                            val = float(parts[i])
                                            parts[i] = str(round(val * scale_factor, 2)).rstrip('0').rstrip('.')
                                except ValueError:
                                    pass

                            row = row[:custom_pos_idx] + parts

                    writer.writerow(row)

        except Exception as e:
            logger.error(f"Failed to process screens.pup, falling back to basic copy: {e}")
            shutil.copy2(src_path, dst_path)

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
            status_map = {
                "1": "ForceBack",
                "2": "ForcePop",
                "3": "MusicOnly",
                "4": "NoDisplay",
                "5": "Background"
            }
            
            for row in reader:
                # Clean keys (remove BOM or spaces)
                clean_row = {str(k).strip().lstrip('\ufeff'): v for k, v in row.items()}
                status_raw = clean_row.get("Active", "").strip()
                
                # Filter out inactive screens
                if not status_raw or status_raw == "0" or status_raw.lower() == "off":
                    continue
                
                # Use mapped name if it's a known number
                status_name = status_map.get(status_raw, status_raw)
                
                screens.append({
                    "description": clean_row.get("ScreenDes", "Unknown Screen"),
                    "status": status_name
                })
            logger.info(f"Found {len(screens)} active screens in {screens_path}")
        except Exception as e:
            logger.error(f"Error parsing screens.pup in {pup_dir}: {e}")

        return screens

    @staticmethod
    async def ensure_vbs_and_ini(table_dir: Path, vpx_filename: str) -> None:
        """
        Ensures that a .vbs and .ini file exist for the table,
        auto-extracting the script and creating a PuP-enabled INI if missing.
        """
        from backend.services.vbs_manager import vbs_manager
        from backend.services.puppack.ini_helper import update_puppack_ini_config
        from backend.core.display_utils import get_effective_rotation
        from backend.core.config import config

        vpx_path = table_dir / vpx_filename
        vbs_path = vpx_path.with_suffix(".vbs")
        ini_path = vpx_path.with_suffix(".ini")

        # 1. Extract and Enable VBS if missing or just extracted
        if not vbs_path.exists():
            try:
                logger.info(f"Auto-extracting VBS for {vpx_filename} because PuP Pack was uploaded.")
                await vbs_manager.extract_vbs(vpx_path)
            except Exception as e:
                logger.error(f"Failed to auto-extract VBS during PuP Pack setup: {e}")
        
        # 2. Ensure PuP is enabled in VBS if it has the setting
        if vbs_path.exists():
            try:
                with open(vbs_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                if vbs_manager.has_puppack_setting(content) and not vbs_manager.is_puppack_enabled(content):
                    logger.info(f"Auto-enabling PuP Pack in {vbs_path.name}")
                    new_content = vbs_manager.apply_regex_fix(content, "puppack", enable=True)
                    with open(vbs_path, "w", encoding="utf-8") as f:
                        f.write(new_content)
            except Exception as e:
                logger.error(f"Failed to auto-enable PuP Pack in VBS: {e}")

        # 2. Create/Update INI
        # Even if INI exists, we want to ensure [Plugin.PUP] is configured correctly
        # unless it was explicitly uploaded (checked by the caller usually, 
        # but here we just ensure the keys exist).
        try:
            # If missing, create a base INI first
            if not ini_path.exists():
                rot = get_effective_rotation(config.master_orientation)
                base_content = f"[Player]\nRotation = {rot}\nCabinetAutofitMode = 1\nCabinetAutofitPos = 0.1\n"
                with open(ini_path, "w", encoding="utf-8") as f:
                    f.write(base_content)
                logger.info(f"Created base INI for {vpx_filename}")

            # Now add PuP Plugin section
            from backend.routers.puppack import resolve_pup_root
            pup_root = resolve_pup_root(table_dir / "pupvideos")
            
            config_updates = {
                "Enable": 1,
                "PUPFolder": f'"{pup_root}"'
            }
            
            update_puppack_ini_config(ini_path, config_updates)
            logger.info(f"Ensured [Plugin.PUP] is enabled in {ini_path.name}")
        except Exception as e:
            logger.error(f"Failed to ensure PuP INI config for {vpx_filename}: {e}")

pup_pack_manager = PupPackManager()
