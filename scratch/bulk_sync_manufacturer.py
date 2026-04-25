import xml.etree.ElementTree as ET
from pathlib import Path

xml_path = Path("/Users/macsobel/ES-DE/gamelists/vpinball/gamelist.xml")

if not xml_path.exists():
    print("gamelist.xml not found")
    exit(1)

tree = ET.parse(xml_path)
root = tree.getroot()

def update_element(elem):
    dev = elem.find("developer")
    pub = elem.find("publisher")
    gen = elem.find("genre")
    
    # Use whatever is in developer as the master manufacturer info
    val = ""
    if dev is not None and dev.text:
        val = dev.text
    elif pub is not None and pub.text:
        val = pub.text
    
    if val:
        if dev is None:
            dev = ET.SubElement(elem, "developer")
        dev.text = val
        
        if pub is None:
            pub = ET.SubElement(elem, "publisher")
        pub.text = val
        
        if gen is None:
            gen = ET.SubElement(elem, "genre")
        gen.text = val

for game in root.findall("game"):
    update_element(game)

for folder in root.findall("folder"):
    update_element(folder)

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
print("Updated all gamelist entries with synchronized Manufacturer/Genre/Publisher info.")
