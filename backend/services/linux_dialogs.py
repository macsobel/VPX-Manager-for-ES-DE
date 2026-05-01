import subprocess
import shutil
import logging

logger = logging.getLogger("vpx_manager.linux_dialogs")

def _run_zenity(args):
    """Internal helper to run zenity commands."""
    zenity_path = shutil.which("zenity")
    if not zenity_path:
        logger.error("zenity not found. Native dialogs unavailable.")
        return None
    
    try:
        result = subprocess.run(
            [zenity_path] + args,
            capture_output=True,
            text=True,
            check=False
        )
        return result
    except Exception as e:
        logger.error(f"Error running zenity: {e}")
        return None

def show_info(title, message):
    """Show an information dialog."""
    _run_zenity(["--info", "--title", title, "--text", message, "--no-wrap"])

def ask_yes_no(title, message):
    """Show a question dialog. Returns True for Yes/OK, False otherwise."""
    result = _run_zenity(["--question", "--title", title, "--text", message, "--no-wrap"])
    return result is not None and result.returncode == 0

def pick_folder(prompt):
    """Open a folder selection dialog."""
    result = _run_zenity(["--file-selection", "--directory", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    return None

def pick_file(prompt):
    """Open a file selection dialog."""
    result = _run_zenity(["--file-selection", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    return None
