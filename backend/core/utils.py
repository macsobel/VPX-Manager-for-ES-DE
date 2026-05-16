import os
import sys
import platform

def get_clean_env():
    """
    Returns a cleaned environment dictionary for subprocesses.
    On Linux, when running inside an AppImage, it removes AppImage-specific
    library paths to prevent conflicts with system binaries like zenity.
    """
    env = os.environ.copy()
    
    if platform.system() == "Linux":
        appdir = env.get("APPDIR")
        if appdir:
            # Restore original LD_LIBRARY_PATH
            if "LD_LIBRARY_PATH_ORIG" in env:
                if env["LD_LIBRARY_PATH_ORIG"]:
                    env["LD_LIBRARY_PATH"] = env["LD_LIBRARY_PATH_ORIG"]
                else:
                    env.pop("LD_LIBRARY_PATH", None)
            else:
                ld_path = env.get("LD_LIBRARY_PATH", "")
                paths = [p for p in ld_path.split(":") if p and appdir not in p]
                if paths:
                    env["LD_LIBRARY_PATH"] = ":".join(paths)
                else:
                    env.pop("LD_LIBRARY_PATH", None)

            # Restore original GI_TYPELIB_PATH (prevents zenity from using bundled typelibs)
            if "GI_TYPELIB_PATH_ORIG" in env:
                if env["GI_TYPELIB_PATH_ORIG"]:
                    env["GI_TYPELIB_PATH"] = env["GI_TYPELIB_PATH_ORIG"]
                else:
                    env.pop("GI_TYPELIB_PATH", None)
            else:
                gi_path = env.get("GI_TYPELIB_PATH", "")
                paths = [p for p in gi_path.split(":") if p and appdir not in p]
                if paths:
                    env["GI_TYPELIB_PATH"] = ":".join(paths)
                else:
                    env.pop("GI_TYPELIB_PATH", None)

            # Restore original PATH
            if "PATH_ORIG" in env:
                if env["PATH_ORIG"]:
                    env["PATH"] = env["PATH_ORIG"]
                else:
                    env.pop("PATH", None)
            else:
                path = env.get("PATH", "")
                paths = [p for p in path.split(":") if p and appdir not in p]
                env["PATH"] = ":".join(paths)

            # Scrub PYTHONPATH
            python_path = env.get("PYTHONPATH", "")
            if python_path:
                paths = [p for p in python_path.split(":") if p and appdir not in p]
                if paths:
                    env["PYTHONPATH"] = ":".join(paths)
                else:
                    env.pop("PYTHONPATH", None)

    return env

