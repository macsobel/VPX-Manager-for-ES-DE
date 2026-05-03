import sys
from unittest.mock import MagicMock, patch

# Mock olefile before it is imported by services.vpx_parser
# as it is not installed in the environment.
mock_olefile = MagicMock()
sys.modules['olefile'] = mock_olefile

import pytest
from backend.services.vpx_parser import VPXParser

@pytest.fixture(autouse=True)
def reset_mock():
    """Reset the mock before each test."""
    mock_olefile.reset_mock(side_effect=True, return_value=True)
    # Re-setup the context manager mock after reset
    mock_ole = MagicMock()
    mock_olefile.OleFileIO.return_value.__enter__.return_value = mock_ole
    yield

@patch('backend.services.vpx_parser.olefile.isOleFile')
def test_get_metadata_not_ole_file(mock_is_ole_file):
    """Test get_metadata safely handles non-OLE files by returning default metadata."""
    mock_is_ole_file.return_value = False
    metadata = VPXParser.get_metadata("test.vpx")
    assert metadata == {"version": "", "author": "", "display_name": ""}

def test_get_metadata_success():
    """Test get_metadata successfully extracting all fields."""
    vpx_path = "test_table.vpx"
    mock_olefile.isOleFile.return_value = True

    mock_ole = mock_olefile.OleFileIO.return_value.__enter__.return_value

    def mock_exists(path):
        return path in ['TableInfo/TableVersion', 'TableInfo/AuthorName', 'TableInfo/TableName']

    mock_ole.exists.side_effect = mock_exists

    mock_stream_version = MagicMock()
    mock_stream_version.read.return_value = b'1.0.0\x00'

    mock_stream_author = MagicMock()
    mock_stream_author.read.return_value = b'John Doe\x00'

    mock_stream_name = MagicMock()
    mock_stream_name.read.return_value = b'My Table\x00'

    def mock_openstream(path):
        if path == 'TableInfo/TableVersion': return mock_stream_version
        if path == 'TableInfo/AuthorName': return mock_stream_author
        if path == 'TableInfo/TableName': return mock_stream_name
        return MagicMock()

    mock_ole.openstream.side_effect = mock_openstream

    metadata = VPXParser.get_metadata(vpx_path)

    assert metadata["version"] == "1.0.0"
    assert metadata["author"] == "John Doe"
    assert metadata["display_name"] == "My Table"

def test_get_metadata_fallback_to_filename():
    """Test get_metadata falling back to filename when display_name is missing."""
    vpx_path = "test_table.vpx"
    mock_olefile.isOleFile.return_value = True

    mock_ole = mock_olefile.OleFileIO.return_value.__enter__.return_value
    mock_ole.exists.return_value = False

    metadata = VPXParser.get_metadata(vpx_path)

    assert metadata["version"] == ""
    assert metadata["author"] == ""
    assert metadata["display_name"] == "test_table"

def test_get_metadata_exception():
    """Test get_metadata handling exceptions during parsing."""
    mock_olefile.isOleFile.return_value = True
    mock_olefile.OleFileIO.side_effect = Exception("Parsing error")

    metadata = VPXParser.get_metadata("test.vpx")
    assert metadata == {"version": "", "author": "", "display_name": ""}

def test_get_metadata_partial_fields():
    """Test get_metadata when only some fields are present."""
    vpx_path = "test_table.vpx"
    mock_olefile.isOleFile.return_value = True

    mock_ole = mock_olefile.OleFileIO.return_value.__enter__.return_value

    def mock_exists(path):
        return path in ['TableInfo/AuthorName']

    mock_ole.exists.side_effect = mock_exists

    mock_stream_author = MagicMock()
    mock_stream_author.read.return_value = b'John Doe\x00'

    def mock_openstream(path):
        if path == 'TableInfo/AuthorName': return mock_stream_author
        return MagicMock()

    mock_ole.openstream.side_effect = mock_openstream

    metadata = VPXParser.get_metadata(vpx_path)

    assert metadata["version"] == ""
    assert metadata["author"] == "John Doe"
    assert metadata["display_name"] == "test_table"
