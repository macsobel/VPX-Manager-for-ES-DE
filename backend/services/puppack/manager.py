import re
import os
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

            # More robust regexes to capture copy/xcopy with or without quotes
            # and ignore / flags.
            copy_pattern = re.compile(r'copy\s+(?:/[A-Z]\s+)*(?:\"([^\"]+)\"|([^\s\"]+))\s+(?:\"([^\"]+)\"|([^\s\"]+))', re.IGNORECASE)
            xcopy_pattern = re.compile(r'xcopy\s+(?:/[A-Z]\s+)*(?:\"([^\"]+)\"|([^\s\"]+))\s+(?:\"([^\"]+)\"|([^\s\"]+))', re.IGNORECASE)

            def extract(pattern, text):
                results = []
                for match in pattern.findall(text):
                    src = match[0] if match[0] else match[1]
                    dst = match[2] if match[2] else match[3]
                    results.append((src, dst))
                return results

            commands = extract(copy_pattern, content) + extract(xcopy_pattern, content)

            if not commands:
                logger.warning(f"No copy commands found in {bat_file_name}")
                return False

            for src, dst in commands:
                # Normalize paths from Windows (\) to POSIX (/)
                src_clean = src.replace('\\', '/')
                dst_clean = dst.replace('\\', '/')

                if dst_clean.startswith("./"):
                    dst_clean = dst_clean[2:]
                if dst_clean == ".":
                    dst_clean = ""

                # Resolve paths relative to the pup_dir
                src_path = pup_dir / src_clean
                dst_path = pup_dir / dst_clean

                if not src_path.exists():
                    logger.warning(f"Source file not found during PUP Pack setup: {src_path}")
                    success = False
                    continue

                try:
                    dst_path.parent.mkdir(parents=True, exist_ok=True)
                    if src_path.is_file():
                        shutil.copy2(src_path, dst_path)
                        logger.info(f"Copied {src_clean} -> {dst_clean}")
                    elif src_path.is_dir():
                        if dst_path.exists() and not dst_path.samefile(pup_dir):
                            shutil.rmtree(dst_path)
                        # We need to copy contents of src_dir to dst_dir
                        shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
                        logger.info(f"Copied directory {src_clean} -> {dst_clean}")
                except Exception as e:
                    logger.error(f"Failed to copy {src_clean} to {dst_clean}: {e}")
                    success = False

        except Exception as e:
            logger.error(f"Error parsing PUP Pack script {bat_file_name}: {e}")
            return False

        return success

    @staticmethod
    def auto_configure(pup_dir: Path, display_count: int) -> Optional[str]:
        """Attempts to automatically select and apply the correct option based on display count."""
        options = PupPackManager.identify_options(pup_dir)
        if not options:
            return None

        target_str = f"{display_count} screen"
        target_str2 = f"{display_count}-screen"
        target_str3 = f"{display_count} screens"
        target_str4 = f"{display_count}-screens"

        best_match = None
        for opt in options:
            name_lower = opt["name"].lower()
            if target_str in name_lower or target_str2 in name_lower or target_str3 in name_lower or target_str4 in name_lower:
                best_match = opt
                break

        # Fallbacks: If no exact number match, but there are options, maybe pick the first one?
        # Or better to return None and let the user decide.
        if best_match:
            success = PupPackManager.apply_option(pup_dir, best_match["file"])
            if success:
                return best_match["name"]

        return None

pup_pack_manager = PupPackManager()
