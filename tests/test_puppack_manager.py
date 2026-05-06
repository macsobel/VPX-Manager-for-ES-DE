import pytest
import os
import shutil
from pathlib import Path
from backend.services.puppack.manager import PupPackManager

@pytest.fixture
def setup_pup_dir(tmp_path):
    pup_dir = tmp_path / "pupvideos"
    pup_dir.mkdir()

    # Create some mock options
    opt1 = pup_dir / "Option 1 - 2 Screen.bat"
    opt1.write_text("copy /Y \"PuP-Pack_Options\\Option 1\\screens.pup\" \"screens.pup\"")

    opt2 = pup_dir / "Option 2 - 3 Screen.bat"
    opt2.write_text("xcopy /Y /E \"PuP-Pack_Options\\Option 2\" \".\\\"")

    # Create the source files
    src1 = pup_dir / "PuP-Pack_Options" / "Option 1"
    src1.mkdir(parents=True)
    (src1 / "screens.pup").write_text("screen1")

    src2 = pup_dir / "PuP-Pack_Options" / "Option 2"
    src2.mkdir(parents=True)
    (src2 / "screens.pup").write_text("screen2")

    return pup_dir

def test_identify_options(setup_pup_dir):
    options = PupPackManager.identify_options(setup_pup_dir)
    assert len(options) == 2
    assert options[0]["name"] == "Option 1 - 2 Screen"
    assert options[1]["name"] == "Option 2 - 3 Screen"

def test_apply_option_copy(setup_pup_dir):
    success = PupPackManager.apply_option(setup_pup_dir, "Option 1 - 2 Screen.bat")
    assert success is True
    assert (setup_pup_dir / "screens.pup").exists()
    assert (setup_pup_dir / "screens.pup").read_text() == "screen1"

def test_apply_option_xcopy(setup_pup_dir):
    success = PupPackManager.apply_option(setup_pup_dir, "Option 2 - 3 Screen.bat")
    assert success is True
    assert (setup_pup_dir / "screens.pup").exists()
    assert (setup_pup_dir / "screens.pup").read_text() == "screen2"

def test_auto_configure(setup_pup_dir):
    opt = PupPackManager.auto_configure(setup_pup_dir, 3)
    assert opt == "Option 2 - 3 Screen"
    assert (setup_pup_dir / "screens.pup").exists()
    assert (setup_pup_dir / "screens.pup").read_text() == "screen2"
