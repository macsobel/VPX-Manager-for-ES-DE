import pytest
from backend.services.vbs_manager import VBSManagerService

def test_apply_regex_fix_colordmd():
    manager = VBSManagerService()

    # Test UseColorDMD = 0 to 1
    content = "Const UseColorDMD = 0"
    fixed = manager.apply_regex_fix(content, "colordmd")
    assert fixed == "Const UseColorDMD = 1"

    content = "'UseColorDMD=0"
    fixed = manager.apply_regex_fix(content, "colordmd")
    assert fixed == "'UseColorDMD=1"

    # Already 1, should not change
    content = "UseColorDMD = 1"
    fixed = manager.apply_regex_fix(content, "colordmd")
    assert fixed == "UseColorDMD = 1"

def test_apply_regex_fix_b2s():
    manager = VBSManagerService()

    content = "Set Controller = CreateObject(\"B2S.Server\")"
    fixed = manager.apply_regex_fix(content, "b2s")
    assert fixed == "Set Controller = CreateObject(\"VPinMAME.Controller\")"

    content = "LaunchBackglass \"backglass.directb2s\", True"
    fixed = manager.apply_regex_fix(content, "b2s")
    assert fixed == "'LaunchBackglass \"backglass.directb2s\", True"

def test_apply_regex_fix_rom_swap():
    manager = VBSManagerService()

    content = "Const cGameName = \"old_rom\""
    fixed = manager.apply_regex_fix(content, "rom_swap", "new_rom")
    assert fixed == "Const cGameName = \"new_rom\""

    content = "GameName=\"test1\""
    fixed = manager.apply_regex_fix(content, "rom_swap", "test2")
    assert fixed == "GameName=\"test2\""
