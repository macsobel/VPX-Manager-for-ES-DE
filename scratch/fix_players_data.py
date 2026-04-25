import xml.etree.ElementTree as ET
from pathlib import Path
import re

xml_path = Path("/Users/macsobel/ES-DE/gamelists/vpinball/gamelist.xml")

if not xml_path.exists():
    print("gamelist.xml not found")
    exit(1)

tree = ET.parse(xml_path)
root = tree.getroot()

def clean_players(elem):
    players = elem.find("players")
    if players is not None and players.text:
        # Check if it looks like a python dict string: {'text': '...'}
        match = re.search(r"{'text':\s*'([^']*)'}", players.text)
        if match:
            new_val = match.group(1)
            print(f"Cleaning players: {players.text} -> {new_val}")
            players.text = new_val

for game in root.findall("game"):
    clean_players(game)

for folder in root.findall("folder"):
    clean_players(folder)

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
print("Finished cleaning up players data.")
