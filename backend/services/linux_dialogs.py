import os
import subprocess
import shutil
import logging
from backend.core.utils import get_clean_env

logger = logging.getLogger("vpx_manager.linux_dialogs")

def _run_zenity(args):
    """Internal helper to run zenity commands."""
    clean_env = get_clean_env()
    
    # Search for zenity using the clean env's PATH (not the AppImage's internal PATH)
    zenity_path = shutil.which("zenity", path=clean_env.get("PATH", ""))
    if not zenity_path:
        # Explicit fallback to common system paths
        for candidate in ["/usr/bin/zenity", "/usr/local/bin/zenity"]:
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                zenity_path = candidate
                break
    
    if not zenity_path:
        logger.error("zenity not found. Native dialogs unavailable via zenity.")
        return None
    
    try:
        result = subprocess.run(
            [zenity_path] + args,
            capture_output=True,
            text=True,
            check=False,
            env=clean_env
        )
        return result
    except Exception as e:
        logger.error(f"Error running zenity: {e}")
        return None


def _run_tkinter_fallback(dialog_type, prompt):
    """Fallback to tkinter if zenity is not installed."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox

        root = tk.Tk()
        root.withdraw()

        if dialog_type == "folder":
            result = filedialog.askdirectory(title=prompt)
        elif dialog_type == "file":
            result = filedialog.askopenfilename(title=prompt)
        elif dialog_type == "info":
            messagebox.showinfo(prompt[0], prompt[1])
            result = True
        elif dialog_type == "question":
            result = messagebox.askyesno(prompt[0], prompt[1])
        else:
            result = None

        root.destroy()
        return result
    except Exception as e:
        logger.error(f"Error running tkinter fallback: {e}")
        return None

def show_info(title, message):
    """Show an information dialog."""
    res = _run_zenity(["--info", "--title", title, "--text", message, "--no-wrap"])
    if res is None:
        _run_tkinter_fallback("info", (title, message))
    elif res.returncode != 0:
        logger.warning(f"zenity info dialog failed (code {res.returncode}): {res.stderr.strip()}")
        _run_tkinter_fallback("info", (title, message))


def ask_yes_no(title, message):
    """Show a question dialog. Returns True for Yes/OK, False otherwise."""
    result = _run_zenity(["--question", "--title", title, "--text", message, "--no-wrap"])
    if result is not None:
        return result.returncode == 0
    return _run_tkinter_fallback("question", (title, message))

def pick_folder(prompt):
    """Open a folder selection dialog."""
    result = _run_zenity(["--file-selection", "--directory", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    
    # If zenity was absent (result is None) or failed with an error (returncode != 1 which is cancel)
    # then we try the tkinter fallback.
    if result is None or (result and result.returncode != 1):
        logger.info(f"Zenity failed or missing (code {result.returncode if result else 'N/A'}), trying tkinter fallback.")
        return _run_tkinter_fallback("folder", prompt)
    return None

def pick_file(prompt):
    """Open a file selection dialog."""
    result = _run_zenity(["--file-selection", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    
    if result is None or (result and result.returncode != 1):
        logger.info(f"Zenity failed or missing (code {result.returncode if result else 'N/A'}), trying tkinter fallback.")
        return _run_tkinter_fallback("file", prompt)
    return None
