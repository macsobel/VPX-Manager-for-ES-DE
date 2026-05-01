from __future__ import annotations

import re
import struct
from pathlib import Path

import olefile


class VPXParser:
    """
    Parser for Visual Pinball X (.vpx) files.
    Extracts metadata from the OLE compound file structure.
    """

    @staticmethod
    def get_metadata(vpx_path: str | Path) -> dict:
        """
        Extract metadata from a .vpx file.
        Returns a dict with version, author, and display_name.
        """
        metadata = {
            "version": "",
            "author": "",
            "display_name": "",
        }

        if not olefile.isOleFile(str(vpx_path)):
            return metadata

        try:
            with olefile.OleFileIO(str(vpx_path)) as ole:
                # Extract from TableInfo storage
                if ole.exists("TableInfo/TableVersion"):
                    metadata["version"] = VPXParser._read_stream(
                        ole, "TableInfo/TableVersion"
                    )
                if ole.exists("TableInfo/AuthorName"):
                    metadata["author"] = VPXParser._read_stream(
                        ole, "TableInfo/AuthorName"
                    )
                if ole.exists("TableInfo/TableName"):
                    metadata["display_name"] = VPXParser._read_stream(
                        ole, "TableInfo/TableName"
                    )

                # Fallback: if display_name is empty, use the stem
                if not metadata["display_name"]:
                    metadata["display_name"] = Path(vpx_path).stem
        except Exception as e:
            print(f"Error parsing VPX metadata for {vpx_path}: {e}")

        return metadata

    @staticmethod
    def get_vbs_hash(vpx_path: str | Path) -> str:
        """
        Extract the VBScript and calculate its SHA256 hash.
        Matches VPinFE logic: decode as UTF-8 (ignore errors), ensure CRLF, then hash.
        """
        if not olefile.isOleFile(str(vpx_path)):
            return ""

        try:
            with olefile.OleFileIO(str(vpx_path)) as ole:
                if not ole.exists("GameData"):
                    return ""

                data = ole.openstream("GameData").read()
                idx = data.find(b"CODE")
                if idx == -1:
                    return ""

                script_len = struct.unpack("<I", data[idx + 4 : idx + 8])[0]
                script_bytes = data[idx + 8 : idx + 8 + script_len]

                # VPinFE logic:
                script_text = script_bytes.decode("utf-8", errors="ignore")

                # Ensure CRLF line endings
                if not (
                    "\r\n" in script_text
                    and "\n" not in script_text.replace("\r\n", "")
                ):
                    script_text = script_text.replace("\r\n", "\n").replace(
                        "\n", "\r\n"
                    )

                import hashlib

                return hashlib.sha256(script_text.encode("utf-8")).hexdigest()
        except Exception:
            return ""

    @staticmethod
    def get_script(vpx_path: str | Path) -> str:
        """
        Extract the VBScript code from a .vpx file.
        Prioritizes the robustly extracted sidecar if it exists.
        """
        vpx_path = Path(vpx_path)
        vbs_path = vpx_path.with_suffix(".vbs")

        # 1. Try sidecar first (always most accurate)
        if vbs_path.exists():
            try:
                with open(vbs_path, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()
            except Exception:
                pass

        # 2. Fallback to OLE scanning
        if not olefile.isOleFile(str(vpx_path)):
            return ""

        try:
            with olefile.OleFileIO(str(vpx_path)) as ole:
                if not ole.exists("GameData"):
                    return ""

                data = ole.openstream("GameData").read()
                idx = data.find(b"CODE")
                if idx == -1:
                    return ""

                script_len = struct.unpack("<I", data[idx + 4 : idx + 8])[0]
                script_bytes = data[idx + 8 : idx + 8 + script_len]

                # Decode error-tolerant
                for encoding in ["utf-8", "windows-1252", "latin-1"]:
                    try:
                        return script_bytes.decode(encoding)
                    except UnicodeDecodeError:
                        continue
                return script_bytes.decode("utf-8", errors="replace")
        except Exception:
            return ""

    @staticmethod
    def _read_stream(ole, path: str) -> str:
        """Read an OLE stream and decode it safely."""
        try:
            data = ole.openstream(path).read()
            # Decode latin-1 and strip null bytes
            return data.decode("latin-1").replace("\x00", "").strip()
        except Exception:
            return ""

    @staticmethod
    def process_vpx_table(
        vpx_filepath: str | Path, extract_sidecar: bool = True, vps_id: str = None
    ) -> list[str]:
        """
        Extract VBScript from .vpx (OLE container) and detect ROM names.
        Iterates over all streams to find the script, as stream names can vary.
        """
        import logging

        logger = logging.getLogger("vpin_manager")

        vpx_path = Path(vpx_filepath)
        if not olefile.isOleFile(str(vpx_path)):
            logger.warning(f"File is not a valid OLE file: {vpx_path}")
            return []

        roms_found = []

        # 1. Start with VPS lookup if ID provided (authoritative source)
        if vps_id:
            from backend.services.vps_matcher import vps_matcher

            vps_roms = vps_matcher.get_roms_by_vps_id(vps_id)
            if vps_roms:
                logger.info(
                    f"Using VPS-matched ROMs for table (ID: {vps_id}): {vps_roms}"
                )
                roms_found.extend(vps_roms)

        # 2. Extract script data for ROM detection
        script_text = ""
        vbs_sidecar = vpx_path.with_suffix(".vbs")

        # Check if sidecar already exists (extracted by robust VPinballX call)
        if vbs_sidecar.exists():
            try:
                # Try UTF-8 then fallback to latin-1
                with open(vbs_sidecar, "r", encoding="utf-8", errors="replace") as f:
                    script_text = f.read()
                logger.info(
                    f"Using robustly extracted sidecar for ROM detection: {vbs_sidecar}"
                )
            except Exception as e:
                logger.warning(f"Failed to read existing sidecar {vbs_sidecar}: {e}")

        # Fallback to OLE scanning only if script_text is still empty
        if not script_text:
            raw_bytes = None
            try:
                with olefile.OleFileIO(str(vpx_path)) as ole:
                    # Try known streams first for speed
                    for candidate in ["GameData/CODE", "GameStg/GameItem"]:
                        if ole.exists(candidate):
                            if candidate != "GameData/CODE":
                                raw_bytes = ole.openstream(candidate).read()
                                logger.info(
                                    f"Found script in standard stream: {candidate}"
                                )
                                break

                    # Special handling for GameData/CODE marker search
                    if not raw_bytes and ole.exists("GameData"):
                        data = ole.openstream("GameData").read()
                        idx = data.find(b"CODE")
                        if idx != -1:
                            script_len = struct.unpack("<I", data[idx + 4 : idx + 8])[0]
                            raw_bytes = data[idx + 8 : idx + 8 + script_len]
                            logger.info(f"Found script in GameData/CODE marker")

                    # If still not found, iterate all streams
                    if not raw_bytes:
                        logger.info("Scanning all streams for script data...")
                        for stream_parts in ole.listdir():
                            try:
                                if ole.get_type(stream_parts) == olefile.STGTY_STREAM:
                                    content = ole.openstream(stream_parts).read()
                                    if (
                                        b"cGameName" in content
                                        or b"GameName" in content
                                        or b"ROM" in content
                                    ):
                                        raw_bytes = content
                                        break
                            except Exception:
                                continue

                if raw_bytes:
                    # Decode error-tolerant
                    for encoding in ["windows-1252", "latin-1", "utf-8"]:
                        try:
                            script_text = raw_bytes.decode(encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    if not script_text:
                        script_text = raw_bytes.decode("utf-8", errors="replace")
            except Exception as e:
                logger.error(f"Error reading OLE for ROM detection: {e}")

        if not script_text:
            logger.info(f"No usable script data found for ROM detection in {vpx_path}")
            return list(dict.fromkeys(roms_found))

        # Regex patterns for ROM identification
        assignment_pattern = r'(?i)\b(?:cGameName|GameName|RomName|ROM)\s*=\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))'

        matches = re.finditer(assignment_pattern, script_text)
        for match in matches:
            if match.group(1):  # Matched a string literal
                roms_found.append(match.group(1).strip())
            elif match.group(2):  # Matched a variable
                var_name = match.group(2)
                var_pattern = rf'(?i)\b{re.escape(var_name)}\s*=\s*"([^"]+)"'
                var_match = re.search(var_pattern, script_text)
                if var_match:
                    roms_found.append(var_match.group(1).strip())

        # Deduplicate and finalize
        final_roms = []
        seen = set()
        for r in roms_found:
            # Handle both string (from script) and dict (from VPS)
            if isinstance(r, dict):
                ver = r.get("version")
                if ver and ver not in seen:
                    final_roms.append(r)
                    seen.add(ver)
            elif isinstance(r, str):
                if r not in seen:
                    final_roms.append({"version": r, "url": ""})
                    seen.add(r)

        logger.info(f"Final detected ROMs for {vpx_path.name}: {final_roms}")
        return final_roms

    @staticmethod
    def detect_rom(vpx_path: str | Path, vps_id: str = None) -> str:
        """Try to detect the main ROM name from the VBScript. Returns a string version."""
        roms = VPXParser.process_vpx_table(
            vpx_path, extract_sidecar=False, vps_id=vps_id
        )
        if roms and isinstance(roms[0], dict):
            return roms[0].get("version", "")
        return roms[0] if roms else ""
