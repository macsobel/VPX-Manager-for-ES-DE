import subprocess
import logging
import shutil

logger = logging.getLogger(__name__)

def focus_window(window_name: str):
    """
    Attempts to bring a window to the front on Linux using wmctrl or xdotool.
    """
    # Try wmctrl first
    wmctrl_cmd = shutil.which("wmctrl")
    if wmctrl_cmd:
        try:
            # -a: activate (bring to front)
            res = subprocess.run([wmctrl_cmd, "-a", window_name], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if res.returncode == 0:
                logger.info(f"Used wmctrl to focus '{window_name}'")
                return True
        except Exception as e:
            logger.debug(f"wmctrl focus failed: {e}")

    # Try xdotool as fallback
    xdotool = shutil.which("xdotool")
    if xdotool:
        try:
            # search for window and activate it
            res = subprocess.run([xdotool, "search", "--name", window_name, "windowactivate"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if res.returncode == 0:
                logger.info(f"Used xdotool to focus '{window_name}'")
                return True
        except Exception as e:
            logger.debug(f"xdotool focus failed: {e}")

    logger.warning(f"Failed to focus '{window_name}' using available Linux tools.")
    return False
