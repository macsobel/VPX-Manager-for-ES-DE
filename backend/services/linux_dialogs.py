import subprocess
import shutil
import logging

logger = logging.getLogger("vpx_manager.linux_dialogs")

def _run_zenity(args):
    """Internal helper to run zenity commands."""
    zenity_path = shutil.which("zenity")
    if not zenity_path:
        logger.error("zenity not found. Native dialogs unavailable via zenity.")
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
    # Zenity might have failed to run or the user cancelled. If Zenity was absent (res was None), try tkinter.
    if result is None:
        return _run_tkinter_fallback("folder", prompt)
    return None

def pick_file(prompt):
    """Open a file selection dialog."""
    result = _run_zenity(["--file-selection", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    if result is None:
        return _run_tkinter_fallback("file", prompt)
    return None
