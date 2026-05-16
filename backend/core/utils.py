import os
import sys
import platform

def get_clean_env():
    """
    Returns a cleaned environment dictionary for subprocesses.
    On Linux, when running inside an AppImage, it removes AppImage-specific
    library paths to prevent conflicts with system binaries.
    """
    env = os.environ.copy()
    
    if platform.system() == "Linux":
        # AppImage environment variables
        # APPDIR is the mount point of the AppImage
        # LD_LIBRARY_PATH usually contains $APPDIR/usr/lib
        
        appdir = env.get("APPDIR")
        if appdir:
            # Restore original LD_LIBRARY_PATH if AppImageLauncher/AppRun saved it
            if "LD_LIBRARY_PATH_ORIG" in env:
                env["LD_LIBRARY_PATH"] = env["LD_LIBRARY_PATH_ORIG"]
            else:
                # If no original was saved, we should at least remove the AppImage paths
                # to allow system binaries (like zenity, vpinballx) to use system libs
                ld_path = env.get("LD_LIBRARY_PATH", "")
                paths = ld_path.split(":")
                new_paths = [p for p in paths if appdir not in p]
                if new_paths:
                    env["LD_LIBRARY_PATH"] = ":".join(new_paths)
                else:
                    env.pop("LD_LIBRARY_PATH", None)
            
            # Also scrub PYTHONPATH if it points to the AppImage
            python_path = env.get("PYTHONPATH", "")
            if python_path:
                paths = python_path.split(":")
                new_paths = [p for p in paths if appdir not in p]
                if new_paths:
                    env["PYTHONPATH"] = ":".join(new_paths)
                else:
                    env.pop("PYTHONPATH", None)

            # Scrub PATH to remove AppImage-specific bins if they interfere
            path = env.get("PATH", "")
            if path:
                paths = path.split(":")
                new_paths = [p for p in paths if appdir not in p]
                env["PATH"] = ":".join(new_paths)

    return env
