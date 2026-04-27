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
        for game in root.findall("game"):
            path_elem = game.find("path")
            if (
                path_elem is not None
                and self._normalize_path(path_elem.text) == norm_rom_path
            ):
                game_elem = game
                break

        if game_elem is None:
            logger.info(f"Creating new <game> entry for {rom_path}")
            game_elem = ET.SubElement(root, "game")
            path_elem = ET.SubElement(game_elem, "path")
            # Preserve the original case for writing to the path tag
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
        found = False

        # 1. Rename <game> entries
        for game in root.findall("game"):
            path_elem = game.find("path")
            if (
                path_elem is not None
                and self._normalize_path(path_elem.text) == norm_old
            ):
                path_elem.text = (
                    new_rom_path
                    if new_rom_path.startswith("./")
                    else f"./{new_rom_path.lstrip('./')}"
                )
                found = True
                # Don't break, rename all matches if any (redundant but safe)

        # 2. Rename <folder> entries if nested
        old_rel = old_rom_path.replace("./", "").replace("\\", "/")
        new_rel = new_rom_path.replace("./", "").replace("\\", "/")

        if "/" in old_rel and "/" in new_rel:
            old_folder = str(Path(old_rel).parent).replace("\\", "/")
            new_folder = str(Path(new_rel).parent).replace("\\", "/")

            norm_old_folder = self._normalize_path(old_folder)

            for fol in root.findall("folder"):
                fpath_elem = fol.find("path")
                if (
                    fpath_elem is not None
                    and self._normalize_path(fpath_elem.text) == norm_old_folder
                ):
                    fpath_elem.text = (
                        new_folder
                        if new_folder.startswith("./")
                        else f"./{new_folder.lstrip('./')}"
                    )
                    found = True

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
