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
    
    if platform.system() == "Linux":
        appdir = env.get("APPDIR")
        if appdir:
            # --- Restore LD_LIBRARY_PATH ---
            if "LD_LIBRARY_PATH_ORIG" in env:
                orig = env["LD_LIBRARY_PATH_ORIG"]
                if orig:
                    env["LD_LIBRARY_PATH"] = orig
                else:
                    env.pop("LD_LIBRARY_PATH", None)
            else:
                ld_path = env.get("LD_LIBRARY_PATH", "")
                paths = [p for p in ld_path.split(":") if p and appdir not in p]
                if paths:
                    env["LD_LIBRARY_PATH"] = ":".join(paths)
                else:
                    env.pop("LD_LIBRARY_PATH", None)

            # --- Restore GI_TYPELIB_PATH ---
            if "GI_TYPELIB_PATH_ORIG" in env:
                orig = env["GI_TYPELIB_PATH_ORIG"]
                if orig:
                    env["GI_TYPELIB_PATH"] = orig
                else:
                    env.pop("GI_TYPELIB_PATH", None)
            else:
                gi_path = env.get("GI_TYPELIB_PATH", "")
                paths = [p for p in gi_path.split(":") if p and appdir not in p]
                if paths:
                    env["GI_TYPELIB_PATH"] = ":".join(paths)
                else:
                    env.pop("GI_TYPELIB_PATH", None)

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

