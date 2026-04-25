import xml.etree.ElementTree as ET
from pathlib import Path

xml_path = Path("/Users/macsobel/ES-DE/gamelists/vpinball/gamelist.xml")

if not xml_path.exists():
    print("gamelist.xml not found")
    exit(1)

tree = ET.parse(xml_path)
root = tree.getroot()

folders = root.findall("folder")
for folder in folders:
    print(f"Removing folder metadata for: {folder.find('path').text}")
    root.remove(folder)

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
print(f"Cleaned up {len(folders)} folder entries.")
