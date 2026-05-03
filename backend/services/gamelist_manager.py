import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def _indent(elem, level=0):
    i = "\n" + level * "    "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + "    "
        if not elem.tail or not elem.tail.strip():
            elem.tail = i
        for elem in elem:
            _indent(elem, level + 1)
        if not elem.tail or not elem.tail.strip():
            elem.tail = i
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = i


class GamelistManager:
    def __init__(self, xml_path: str):
        self.xml_path = Path(xml_path)

    def _load_tree(self) -> tuple[ET.ElementTree, ET.Element]:
        if self.xml_path.exists():
            try:
                tree = ET.parse(self.xml_path)
                return tree, tree.getroot()
            except Exception as e:
                logger.error(f"Error parsing gamelist.xml: {e}")

        root = ET.Element("gameList")
        tree = ET.ElementTree(root)
        return tree, root

    def _normalize_path(self, p: str) -> str:
        """Standardize path for comparison: lowercase, forward slashes, strip whitespace, ensure ./ prefix."""
        if not p:
            return ""
        # Remove leading/trailing whitespace and normalize slashes
        norm = p.strip().replace("\\", "/")

        # ES-DE paths usually start with ./
        if not norm.startswith("./") and not norm.startswith("/"):
            norm = f"./{norm}"

        # Lowercase for case-insensitive matching (common in Windows/macOS)
        return norm.lower()

    def update_game(self, rom_path: str, metadata: Dict[str, str]):
        if not metadata:
            return

        tree, root = self._load_tree()
        norm_rom_path = self._normalize_path(rom_path)

        # 1. Update/Create <game>
        game_elem = None
        duplicates_to_remove = []
        for game in root.findall("game"):
            path_elem = game.find("path")
            if (
                path_elem is not None
                and self._normalize_path(path_elem.text) == norm_rom_path
            ):
                if game_elem is None:
                    game_elem = game
                else:
                    duplicates_to_remove.append(game)

        for dup in duplicates_to_remove:
            root.remove(dup)

        if game_elem is None:
            logger.info(f"Creating new <game> entry for {rom_path}")
            game_elem = ET.SubElement(root, "game")
            path_elem = ET.SubElement(game_elem, "path")
        else:
            path_elem = game_elem.find("path")

        if path_elem is not None:
            # Always update path to match current disk casing to prevent ES-DE duplicates
            path_elem.text = (
                rom_path if rom_path.startswith("./") else f"./{rom_path.lstrip('./')}"
            )

        self._set_metadata(game_elem, metadata)

        _indent(root)
        try:
            self.xml_path.parent.mkdir(parents=True, exist_ok=True)
            tree.write(self.xml_path, encoding="utf-8", xml_declaration=True)
            logger.debug(f"Successfully wrote {self.xml_path}")
        except Exception as e:
            logger.error(f"Failed to write gamelist.xml: {e}")

    def _set_metadata(self, element: ET.Element, metadata: Dict[str, str]):
        # Map our internal keys to ES tags
        TAG_MAP = {
            "display_name": "name",
            "manufacturer": "developer",
            "publisher": "publisher",
            "genre": "genre",
            "year": "releasedate",
            "rating": "rating",
            "desc": "desc",
            "players": "players",
        }

        logger.info(f"Setting metadata for {element.tag}: {metadata}")
        for key, value in metadata.items():
            if value is None:
                continue
            tag = TAG_MAP.get(key, key)

            # Special handling for release date (ES expects YYYYMMDDTHHMMSS)
            if tag == "releasedate" and len(str(value)) == 4:
                value = f"{value}0101T000000"

            elem = element.find(tag)
            if elem is None:
                elem = ET.SubElement(element, tag)

            logger.debug(f"Writing {tag} = {value}")
            elem.text = str(value)

    def get_game(self, rom_path: str) -> Optional[Dict[str, str]]:
        _, root = self._load_tree()
        norm_path = self._normalize_path(rom_path)
        for game in root.findall("game"):
            path_elem = game.find("path")
            if (
                path_elem is not None
                and self._normalize_path(path_elem.text) == norm_path
            ):
                res = {}
                for child in game:
                    res[child.tag] = child.text
                return res
        return None

    def rename_game(self, old_rom_path: str, new_rom_path: str):
        tree, root = self._load_tree()
        norm_old = self._normalize_path(old_rom_path)
        norm_new = self._normalize_path(new_rom_path)
        found = False

        # 1. Rename <game> entries
        game_matches = []
        for game in root.findall("game"):
            path_elem = game.find("path")
            if path_elem is not None:
                p_norm = self._normalize_path(path_elem.text)
                if p_norm == norm_old or p_norm == norm_new:
                    game_matches.append(game)

        if game_matches:
            # Keep the first match, update it, remove any others to prevent duplicates
            first_game = game_matches[0]
            path_elem = first_game.find("path")
            path_elem.text = (
                new_rom_path
                if new_rom_path.startswith("./")
                else f"./{new_rom_path.lstrip('./')}"
            )
            found = True

            # Update media tags to match new stem
            old_stem = Path(old_rom_path).stem
            new_stem = Path(new_rom_path).stem
            if old_stem != new_stem:
                for tag in ["image", "video", "marquee", "fanart", "thumbnail", "manual"]:
                    elem = first_game.find(tag)
                    if elem is not None and elem.text:
                        p = Path(elem.text.replace("\\", "/"))
                        if p.name.startswith(old_stem):
                            new_name = p.name.replace(old_stem, new_stem, 1)
                            new_text = str(p.parent / new_name).replace("\\", "/")
                            if elem.text.startswith("./") and not new_text.startswith("./"):
                                new_text = f"./{new_text}"
                            elif not elem.text.startswith("./") and new_text.startswith("./"):
                                new_text = new_text[2:]
                            elem.text = new_text

            for dup in game_matches[1:]:
                root.remove(dup)

        # 2. Rename <folder> entries if nested
        old_rel = old_rom_path.replace("./", "").replace("\\", "/")
        new_rel = new_rom_path.replace("./", "").replace("\\", "/")

        if "/" in old_rel and "/" in new_rel:
            old_folder = str(Path(old_rel).parent).replace("\\", "/")
            new_folder = str(Path(new_rel).parent).replace("\\", "/")

            norm_old_folder = self._normalize_path(old_folder)
            norm_new_folder = self._normalize_path(new_folder)

            folder_matches = []
            for fol in root.findall("folder"):
                fpath_elem = fol.find("path")
                if fpath_elem is not None:
                    p_norm = self._normalize_path(fpath_elem.text)
                    if p_norm == norm_old_folder or p_norm == norm_new_folder:
                        folder_matches.append(fol)

            if folder_matches:
                first_fol = folder_matches[0]
                fpath_elem = first_fol.find("path")
                fpath_elem.text = (
                    new_folder
                    if new_folder.startswith("./")
                    else f"./{new_folder.lstrip('./')}"
                )
                found = True

                for dup in folder_matches[1:]:
                    root.remove(dup)

        if found:
            _indent(root)
            try:
                self.xml_path.parent.mkdir(parents=True, exist_ok=True)
                tree.write(self.xml_path, encoding="utf-8", xml_declaration=True)
                logger.info(
                    f"Renamed game/folder entries from {old_rom_path} to {new_rom_path}"
                )
            except Exception as e:
                logger.error(f"Failed to write gamelist.xml after rename: {e}")
        return found

    def remove_game(self, rom_path: str) -> bool:
        tree, root = self._load_tree()
        norm_path = self._normalize_path(rom_path)
        found = False

        # 1. Remove <game> entries
        game_matches = []
        for game in root.findall("game"):
            path_elem = game.find("path")
            if (
                path_elem is not None
                and self._normalize_path(path_elem.text) == norm_path
            ):
                game_matches.append(game)

        for m in game_matches:
            root.remove(m)
            found = True

        # 2. Remove <folder> entry if this was a nested path
        rel_path = rom_path.replace("./", "").replace("\\", "/")
        if "/" in rel_path:
            folder_path = str(Path(rel_path).parent).replace("\\", "/")
            norm_folder_path = self._normalize_path(folder_path)

            folder_matches = []
            for fol in root.findall("folder"):
                fpath_elem = fol.find("path")
                if (
                    fpath_elem is not None
                    and self._normalize_path(fpath_elem.text) == norm_folder_path
                ):
                    folder_matches.append(fol)

            for m in folder_matches:
                root.remove(m)
                found = True

        if found:
            _indent(root)
            try:
                self.xml_path.parent.mkdir(parents=True, exist_ok=True)
                tree.write(self.xml_path, encoding="utf-8", xml_declaration=True)
                logger.info(
                    f"Removed game/folder entries for {rom_path} from gamelist.xml"
                )
            except Exception as e:
                logger.error(f"Failed to update gamelist.xml after removal: {e}")
        return found
