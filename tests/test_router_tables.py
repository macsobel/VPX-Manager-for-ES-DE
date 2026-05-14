import sys
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

# --- Mocking missing third-party dependencies ---
# We mock these at the module level so they are available when backend.routers.tables is imported.
# We use a context manager in the test to ensure these mocks are temporary if needed,
# but for simplicity in this environment where they are completely missing, we set them in sys.modules.

class MockBaseModel:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
    def model_dump(self, **kwargs):
        return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}

mock_pydantic = MagicMock()
mock_pydantic.BaseModel = MockBaseModel
sys.modules["pydantic"] = mock_pydantic

mock_fastapi = MagicMock()
def mock_decorator(*args, **kwargs):
    def wrapper(func):
        return func
    return wrapper

mock_router = MagicMock()
mock_router.get.side_effect = mock_decorator
mock_router.post.side_effect = mock_decorator
mock_router.put.side_effect = mock_decorator
mock_router.delete.side_effect = mock_decorator

mock_fastapi.APIRouter.return_value = mock_router
sys.modules["fastapi"] = mock_fastapi
sys.modules["fastapi.responses"] = MagicMock()

# Mock other missing dependencies
sys.modules["aiosqlite"] = MagicMock()
sys.modules["backend.core.config"] = MagicMock()
sys.modules["backend.services.gamelist_manager"] = MagicMock()
sys.modules["backend.services.scanner"] = MagicMock()
sys.modules["backend.services.task_registry"] = MagicMock()
sys.modules["backend.services.vps_matcher"] = MagicMock()
sys.modules["backend.services.media_manager"] = MagicMock()
sys.modules["backend.services.vbs_manager"] = MagicMock()
sys.modules["backend.services.vpx_parser"] = MagicMock()
sys.modules["backend.services.table_file_service"] = MagicMock()

# Now it is safe to import the router and the database module
from backend.routers.tables import get_filter_options
import backend.core.database as db

def test_get_filter_options_success():
    """Verify get_filter_options returns the correct dropdown values when the database has data."""

    # Mock db.get_distinct_values to return different lists based on the column name.
    # It must be an AsyncMock because it is awaited in the router.
    async def mock_get_distinct_values(column):
        if column == "manufacturer":
            return ["Bally", "Williams"]
        if column == "year":
            return ["1992", "1993"]
        if column == "table_type":
            return ["SS", "EM"]
        return []

    with patch('backend.core.database.get_distinct_values', side_effect=mock_get_distinct_values):
        result = asyncio.run(get_filter_options())

        expected = {
            "manufacturers": ["Bally", "Williams"],
            "years": ["1992", "1993"],
            "types": ["SS", "EM"]
        }

        assert result == expected

def test_get_filter_options_empty():
    """Verify get_filter_options handles cases where no filter options are found in the database."""

    with patch('backend.core.database.get_distinct_values', new_callable=AsyncMock) as mock_get:
        mock_get.return_value = []

        result = asyncio.run(get_filter_options())

        expected = {
            "manufacturers": [],
            "years": [],
            "types": []
        }
        assert result == expected
        assert mock_get.call_count == 3
