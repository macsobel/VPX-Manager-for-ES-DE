import os
import sys
import platform

# These system PATH entries are always safe to have and ensure binaries like
# zenity, xdg-open, etc. can always be found even if PATH restoration fails.
_SYSTEM_PATH_FALLBACK = "/usr/local/bin:/usr/bin:/bin"

def get_clean_env():
    """
    Returns a cleaned environment dictionary for subprocesses.
    On Linux, when running inside an AppImage, removes AppImage-specific
    library paths to prevent conflicts with system binaries like zenity.
    Also ensures display variables and GTK theming are set correctly.
    """
    env = os.environ.copy()
    
    # In frozen builds, strip virtualenv variables to prevent the child process
    # from incorrectly loading packages from a local developer virtual environment.
    meipass = getattr(sys, "_MEIPASS", "")
    
    if getattr(sys, "frozen", False):
        env.pop("VIRTUAL_ENV", None)
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        path = env.get("PATH", "")
        if path:
            paths = path.split(os.pathsep)
            cleaned_paths = [p for p in paths if ".venv" not in p and "venv" not in p]
            env["PATH"] = os.pathsep.join(cleaned_paths)
            
    if platform.system() == "Linux":
        appdir = env.get("APPDIR", "")
        
        # Aggressively filter out any paths related to the AppImage or PyInstaller extraction payload
        for env_var in ["LD_LIBRARY_PATH", "LD_LIBRARY_PATH_ORIG", "GI_TYPELIB_PATH", "GI_TYPELIB_PATH_ORIG", "XDG_DATA_DIRS"]:
            if env_var in env:
                current_path = env.get(env_var, "")
                cleaned = []
                for p in current_path.split(":"):
                    if not p: continue
                    # If it's part of the AppImage FUSE mount or PyInstaller tmp payload, discard it
                    if appdir and p.startswith(appdir): continue
                    if meipass and p.startswith(meipass): continue
                    cleaned.append(p)
                
                if cleaned:
                    env[env_var] = ":".join(cleaned)
                else:
                    env.pop(env_var, None)
                    
        # If PyInstaller saved the original LD path before it injected its own, it was already
        # filtered by the loop above. We can safely overwrite the active LD_LIBRARY_PATH with it.
        if "LD_LIBRARY_PATH_ORIG" in env:
            env["LD_LIBRARY_PATH"] = env["LD_LIBRARY_PATH_ORIG"]
            
        if "GI_TYPELIB_PATH_ORIG" in env:
            env["GI_TYPELIB_PATH"] = env["GI_TYPELIB_PATH_ORIG"]

            # --- Restore PATH ---
            # CRITICAL: Never leave PATH empty — always include system bin dirs
            # so binaries like zenity are discoverable even if PATH_ORIG is empty.
            if "PATH_ORIG" in env:
                orig = env["PATH_ORIG"]
                restored = orig if orig else _SYSTEM_PATH_FALLBACK
            else:
                path = env.get("PATH", "")
                paths = [p for p in path.split(":") if p and appdir not in p]
                restored = ":".join(paths) if paths else _SYSTEM_PATH_FALLBACK

            # Merge restored PATH with system fallback to guarantee /usr/bin is present
            merged_paths = []
            seen = set()
            for p in (restored + ":" + _SYSTEM_PATH_FALLBACK).split(":"):
                if p and p not in seen:
                    merged_paths.append(p)
                    seen.add(p)
            env["PATH"] = ":".join(merged_paths)

            # --- Scrub PYTHONPATH ---
            python_path = env.get("PYTHONPATH", "")
            if python_path:
                paths = [p for p in python_path.split(":") if p and appdir not in p]
                if paths:
                    env["PYTHONPATH"] = ":".join(paths)
                else:
                    env.pop("PYTHONPATH", None)

        # --- Ensure display variables are present for GUI subprocesses ---
        # zenity needs DISPLAY or WAYLAND_DISPLAY to render a window.
        # These should already be in the env, but ensure they aren't accidentally scrubbed.
        for var in ("DISPLAY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"):
            if var not in env and var in os.environ:
                env[var] = os.environ[var]

        # --- Ensure modern GTK theming for system dialogs (zenity, etc.) ---
        # Forces Adwaita appearance on systems with older/different desktop themes.
        # Only set if not already configured by the user's environment.
        if not env.get("GTK_THEME"):
            env["GTK_THEME"] = "Adwaita"
        if not env.get("GTK_ICON_THEME"):
            env["GTK_ICON_THEME"] = "Adwaita"

    return env

