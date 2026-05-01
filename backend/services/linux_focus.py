import subprocess
import logging
import shutil

logger = logging.getLogger(__name__)

def focus_window(window_name: str):
    """
    Attempts to bring a window to the front on Linux using wmctrl or xdotool.
    """
    # Try wmctrl first
    wmctrl = shutil.which("wmctrl")
    if wmctrl:
        try:
            # -a: activate (bring to front)
            # Use partial matching for the window name
            subprocess.run([wmctrl, "-a", window_name], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info(f"Used wmctrl to focus '{window_name}'")
            return True
        except Exception as e:
            logger.debug(f"wmctrl focus failed: {e}")

    # Try xdotool as fallback
    xdotool = shutil.which("xdotool")
    if xdotool:
        try:
            # search for window and activate it
            subprocess.run([xdotool, "search", "--name", window_name, "windowactivate"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info(f"Used xdotool to focus '{window_name}'")
            return True
        except Exception as e:
            logger.debug(f"xdotool focus failed: {e}")

    logger.warning("No Linux window management tools (wmctrl, xdotool) found to manage focus.")
    return False
