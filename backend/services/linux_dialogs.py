import os
import subprocess
import shutil
import threading
import logging
import platform
from backend.core.utils import get_clean_env

logger = logging.getLogger("vpx_manager.linux_dialogs")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _run_gtk_dialog_in_thread(dialog_type, title, message, result_holder):
    """
    Show a GTK3 dialog directly via gi.repository.Gtk — no subprocess, no env
    issues. This is the primary path when running from an AppImage because the
    GTK3 typelibs are already bundled inside the AppImage for the tray icon.
    result_holder is a 1-element list; the result is placed in [0].
    """
    try:
        import gi
        gi.require_version("Gtk", "3.0")
        from gi.repository import Gtk, GLib

        def _show():
            if dialog_type == "info":
                dlg = Gtk.MessageDialog(
                    transient_for=None,
                    flags=0,
                    message_type=Gtk.MessageType.INFO,
                    buttons=Gtk.ButtonsType.OK,
                    text=message,  # body text only — title bar set separately below
                )
                dlg.set_title(title)
                dlg.run()
                dlg.destroy()
                result_holder[0] = True

            elif dialog_type == "question":
                dlg = Gtk.MessageDialog(
                    transient_for=None,
                    flags=0,
                    message_type=Gtk.MessageType.QUESTION,
                    buttons=Gtk.ButtonsType.YES_NO,
                    text=message,  # body text only — title bar set separately below
                )
                dlg.set_title(title)
                response = dlg.run()
                dlg.destroy()
                result_holder[0] = (response == Gtk.ResponseType.YES)

            elif dialog_type == "folder":
                dlg = Gtk.FileChooserDialog(
                    title=title,
                    action=Gtk.FileChooserAction.SELECT_FOLDER,
                )
                dlg.add_buttons(
                    Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                    Gtk.STOCK_OPEN,   Gtk.ResponseType.OK,
                )
                response = dlg.run()
                path = dlg.get_filename() if response == Gtk.ResponseType.OK else None
                dlg.destroy()
                result_holder[0] = path

            elif dialog_type == "file":
                dlg = Gtk.FileChooserDialog(
                    title=title,
                    action=Gtk.FileChooserAction.OPEN,
                )
                dlg.add_buttons(
                    Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                    Gtk.STOCK_OPEN,   Gtk.ResponseType.OK,
                )
                response = dlg.run()
                path = dlg.get_filename() if response == Gtk.ResponseType.OK else None
                dlg.destroy()
                result_holder[0] = path

            Gtk.main_quit()

        Gtk.init([])
        GLib.idle_add(_show)
        Gtk.main()
        return True  # success

    except Exception as e:
        logger.error(f"GTK dialog error: {e}")
        return False


def _show_gtk_dialog(dialog_type, title, message=None):
    """Run a GTK3 dialog in a dedicated thread and return the result."""
    result_holder = [None]
    t = threading.Thread(
        target=_run_gtk_dialog_in_thread,
        args=(dialog_type, title, message, result_holder),
        daemon=True,
    )
    t.start()
    t.join(timeout=120)  # 2-minute max wait
    return result_holder[0]


def _find_zenity():
    """
    Locate the system zenity binary using both PATH and hardcoded locations.
    Returns (zenity_path, clean_env) or (None, clean_env).
    """
    clean_env = get_clean_env()

    zenity_path = shutil.which("zenity", path=clean_env.get("PATH", ""))
    if not zenity_path:
        for candidate in ["/usr/bin/zenity", "/usr/local/bin/zenity", "/bin/zenity"]:
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                zenity_path = candidate
                break

    if zenity_path:
        logger.debug(f"Found zenity at: {zenity_path}")
    else:
        logger.warning("zenity not found on this system.")

    return zenity_path, clean_env


def _run_zenity(args):
    """Run zenity as a subprocess with a clean environment."""
    zenity_path, clean_env = _find_zenity()
    if not zenity_path:
        return None

    try:
        result = subprocess.run(
            [zenity_path] + args,
            capture_output=True,
            text=True,
            check=False,
            env=clean_env,
        )
        return result
    except Exception as e:
        logger.error(f"Error running zenity: {e}")
        return None


def _run_tkinter_fallback(dialog_type, prompt):
    """Last-resort fallback using tkinter (shows ugly 'Dialog' windows)."""
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
        logger.error(f"tkinter fallback error: {e}")
        return None


# ---------------------------------------------------------------------------
# Priority order for dialogs (when running on Linux inside an AppImage):
#   1. Zenity subprocess  — gives the native system look (zenity 4.x = beautiful)
#   2. GTK3 via gi        — bundled in AppImage, consistent look, no subprocess issues
#   3. tkinter            — last resort (shows "Dialog" title bar, avoid if possible)
# ---------------------------------------------------------------------------

def _is_inside_appimage():
    return bool(os.environ.get("APPDIR"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def show_info(title, message):
    """Show an information dialog."""
    # Try zenity first (best look on systems with zenity 4.x)
    res = _run_zenity([
        "--info", "--title", title, "--text", message, "--no-wrap",
        "--icon-name=dialog-information",
        "--width=400",
    ])
    if res is not None and res.returncode == 0:
        return  # success

    if res is not None and res.returncode != 0:
        logger.warning(f"zenity failed (code {res.returncode}): {res.stderr.strip()}")

    # Fall back to bundled GTK3 dialog (avoids tkinter "Dialog" look)
    logger.info("Attempting GTK3 dialog fallback for show_info.")
    success = _show_gtk_dialog("info", title, message)
    if success:
        return

    # Last resort
    _run_tkinter_fallback("info", (title, message))


def ask_yes_no(title, message):
    """Show a yes/no question dialog. Returns True for Yes, False otherwise."""
    res = _run_zenity([
        "--question", "--title", title, "--text", message, "--no-wrap",
        "--icon-name=dialog-question",
        "--width=400",
    ])
    if res is not None:
        return res.returncode == 0

    logger.info("Attempting GTK3 dialog fallback for ask_yes_no.")
    result = _show_gtk_dialog("question", title, message)
    if result is not None:
        return result

    return _run_tkinter_fallback("question", (title, message))


def pick_folder(prompt):
    """Open a folder-selection dialog. Returns path string or None."""
    result = _run_zenity(["--file-selection", "--directory", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    if result is None or result.returncode not in (0, 1):
        logger.info("Attempting GTK3 dialog fallback for pick_folder.")
        path = _show_gtk_dialog("folder", prompt)
        if path is not None:
            return path
        return _run_tkinter_fallback("folder", prompt)
    return None


def pick_file(prompt):
    """Open a file-selection dialog. Returns path string or None."""
    result = _run_zenity(["--file-selection", "--title", prompt])
    if result and result.returncode == 0:
        return result.stdout.strip()
    if result is None or result.returncode not in (0, 1):
        logger.info("Attempting GTK3 dialog fallback for pick_file.")
        path = _show_gtk_dialog("file", prompt)
        if path is not None:
            return path
        return _run_tkinter_fallback("file", prompt)
    return None
