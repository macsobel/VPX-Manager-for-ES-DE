import pytest
import sqlite3
from backend.core.database import _format_table_row

def test_format_table_row():
    # Test None
    assert _format_table_row(None) is None

    # Test without folder_path
    row_no_folder = {"filename": "test.vpx", "display_name": "Test Table"}
    res = _format_table_row(row_no_folder)
    assert res["vpx_path"] == "test.vpx"
    assert "folder_path" not in res or res["folder_path"] == "" or res["folder_path"] is None

    # Test with folder_path
    row_folder = {"filename": "test.vpx", "folder_path": "~/tables"}
    res2 = _format_table_row(row_folder)
    assert res2["vpx_path"].endswith("test.vpx")
    assert res2["folder_path"] != "~/tables" # should be expanded
