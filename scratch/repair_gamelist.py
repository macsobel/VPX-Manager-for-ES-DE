import xml.etree.ElementTree as ET
from pathlib import Path

xml_path = Path("/Users/macsobel/ES-DE/gamelists/vpinball/gamelist.xml")

if not xml_path.exists():
    print("gamelist.xml not found")
    exit(1)

tree = ET.parse(xml_path)
root = tree.getroot()

games = root.findall("game")
folders_to_add = {}

for game in games:
    path_elem = game.find("path")
    if path_elem is None: continue
    
    p = path_elem.text.replace("./", "").replace("\\", "/")
    if "/" in p:
        folder_path = str(Path(p).parent).replace("\\", "/")
        
        # Collect metadata from the game to apply to the folder
        metadata = {}
        for child in game:
            if child.tag != "path":
                metadata[child.tag] = child.text
        
        folders_to_add[folder_path] = metadata

# Remove existing folders first to avoid dupes
for fol in root.findall("folder"):
    root.remove(fol)

# Add them back
for folder_path, metadata in folders_to_add.items():
    print(f"Adding folder metadata for: {folder_path}")
    fol_elem = ET.SubElement(root, "folder")
    path_elem = ET.SubElement(fol_elem, "path")
    path_elem.text = f"./{folder_path}"
    
    for tag, val in metadata.items():
        child = ET.SubElement(fol_elem, tag)
        child.text = val

# Re-indent
def indent(elem, level=0):
    i = "\n" + level * "    "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = i + "    "
        if not elem.tail or not elem.tail.strip():
            elem.tail = i
        for child in elem:
            indent(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = i
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = i

indent(root)
tree.write(xml_path, encoding="utf-8", xml_declaration=True)
print(f"Restored metadata for {len(folders_to_add)} folders.")
