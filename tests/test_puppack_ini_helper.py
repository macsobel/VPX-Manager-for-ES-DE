from pathlib import Path
from backend.services.puppack.ini_helper import update_puppack_ini_config, read_puppack_ini_config

def test_puppack_ini_config(tmp_path: Path):
    ini_file = tmp_path / "test.ini"

    # Create an initial INI file
    ini_file.write_text("[Player]\nVolume = 100\n[Standalone]\nExistingKey = 1\n")

    # Update config
    updates = {
        "PUPBackglassWindow": 1,
        "PUPBackglassScreen": 2,
        "PUPBackglassWindowX": 0,
        "PUPBackglassWindowY": 0,
        "PUPBackglassWindowWidth": 1920,
        "PUPBackglassWindowHeight": 1080
    }

    success = update_puppack_ini_config(ini_file, updates)
    assert success

    # Read config back
    config = read_puppack_ini_config(ini_file)
    assert config["pupbackglasswindow"] == 1
    assert config["pupbackglassscreen"] == 2
    assert config["pupbackglasswindowwidth"] == 1920
