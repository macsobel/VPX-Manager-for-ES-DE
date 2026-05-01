import logging

import httpx

from backend.core.config import VERSION

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

                # Platform and Architecture detection
                import platform
                system = platform.system().lower() # 'darwin' or 'linux'
                machine = platform.machine().lower() # 'x86_64', 'arm64', 'aarch64'
                
                # Map architecture to build naming conventions
                is_arm = machine in ["arm64", "aarch64"]
                
                assets = release_data.get("assets", [])
                download_url = release_data.get("html_url") # Default to release page
                
                if assets:
                    # Try to find the perfect match
                    found_match = False
                    for asset in assets:
                        asset_name = asset.get("name", "").lower()
                        
                        if system == "darwin":
                            if "macos" in asset_name:
                                if (is_arm and ("arm" in asset_name or "silicon" in asset_name)) or (not is_arm and "intel" in asset_name):
                                    download_url = asset.get("browser_download_url")
                                    found_match = True
                                    break
                        elif system == "linux":
                            if ".zip" in asset_name and "linux" in asset_name:
                                if (is_arm and "aarch64" in asset_name) or (not is_arm and "x86_64" in asset_name):
                                    download_url = asset.get("browser_download_url")
                                    found_match = True
                                    break
                    
                    # Fallback to first OS-compatible asset if arch match fails
                    if not found_match:
                        for asset in assets:
                            asset_name = asset.get("name", "").lower()
                            if system == "darwin" and "macos" in asset_name:
                                download_url = asset.get("browser_download_url")
                                break
                            elif system == "linux" and ("linux" in asset_name):
                                download_url = asset.get("browser_download_url")
                                break
                        else:
                            # Final fallback: just use the first asset
                            download_url = assets[0].get("browser_download_url")

                return {
                    "update_available": is_newer,
                    "latest_version": latest_tag,
                    "current_version": VERSION,
                    "release_notes": release_data.get("html_url"),
                    "download_url": download_url,
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
