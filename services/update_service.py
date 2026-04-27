import logging

import httpx

from config import VERSION

logger = logging.getLogger(__name__)

GITHUB_REPO = "macsobel/VPX-Manager-for-ES-DE"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"


class UpdateService:
    @staticmethod
    async def check_for_updates():
        """
        Check GitHub for the latest release and compare with local version.
        Returns a dict with update status and details.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(GITHUB_API_URL)
                response.raise_for_status()
                release_data = response.json()

                latest_tag = release_data.get("tag_name", "").replace("v", "")
                if not latest_tag:
                    return {
                        "update_available": False,
                        "error": "No version found on GitHub",
                    }

                # Simple integer comparison
                try:
                    current_v = int(VERSION)
                    latest_v = int(latest_tag)
                    is_newer = latest_v > current_v
                except (ValueError, TypeError):
                    # Handle "Dev Build" or mixed formats
                    is_newer = latest_tag != VERSION and VERSION != "Dev Build"

                return {
                    "update_available": is_newer,
                    "latest_version": latest_tag,
                    "current_version": VERSION,
                    "release_notes": release_data.get("html_url"),
                    "download_url": (
                        release_data.get("assets", [{}])[0].get("browser_download_url")
                        if release_data.get("assets")
                        else release_data.get("html_url")
                    ),
                    "published_at": release_data.get("published_at"),
                    "body": release_data.get("body", ""),
                }
        except httpx.HTTPStatusError as e:
            logger.error(f"GitHub API error: {e}")
            return {
                "update_available": False,
                "error": f"GitHub API error: {e.response.status_code}",
            }
        except Exception as e:
            logger.error(f"Failed to check for updates: {e}")
            return {"update_available": False, "error": str(e)}


update_service = UpdateService()
