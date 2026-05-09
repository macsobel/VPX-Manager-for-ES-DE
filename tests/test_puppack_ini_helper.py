from pathlib import Path
from backend.services.puppack.ini_helper import update_puppack_ini_config, read_puppack_ini_config

def test_puppack_ini_config(tmp_path: Path):
    ini_file = tmp_path / "test.ini"

    # Create an initial INI file
    ini_file.write_text("[Player]\nVolume = 100\n[Standalone]\nExistingKey = 1\n")

    # Update config with new BGPad style
    updates = {
        "Enable": 1,
        "PUPFolder": '"/Users/macsobel/My Folder"',
        "BGPadLeft": 100,
        "BGPadTop": 50,
        "BGPadRight": 200,
        "BGPadBottom": 150
    }

    success = update_puppack_ini_config(ini_file, updates)
    assert success

    # Read config back
    config = read_puppack_ini_config(ini_file)
    
    # Check padding values
    assert config["bgpadleft"] == 100
    assert config["bgpadright"] == 200
    
    # Check synthesized legacy keys (for frontend compatibility)
    assert config["pupbackglasswindow"] == 1
    
    # Check quoting
    assert config["pupfolder"] == '"/Users/macsobel/My Folder"'

