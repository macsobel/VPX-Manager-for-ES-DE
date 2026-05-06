import subprocess
import sys
import platform

def get_primary_display_rotation() -> str:
    """
    Detects the primary display's orientation (Landscape vs Portrait).
    Returns "0" for Landscape (Width >= Height) and "270" for Portrait (Height > Width).
    """
    width, height = 0, 0
    try:
        if platform.system() == "Darwin":
            # macOS: Use system_profiler with mini detail for speed
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType", "-detailLevel", "mini"],
                capture_output=True,
                text=True,
                check=True
            )
            
            current_w, current_h = 0, 0
            best_w, best_h = 0, 0
            
            for line in result.stdout.splitlines():
                line_stripped = line.strip()
                if "Resolution:" in line_stripped:
                    parts = line_stripped.split()
                    try:
                        idx = parts.index("Resolution:")
                        current_w = int(parts[idx + 1])
                        current_h = int(parts[idx + 3])
                        if best_w == 0:  # Fallback to the first display found
                            best_w, best_h = current_w, current_h
                    except (ValueError, IndexError):
                        pass
                elif "Main Display: Yes" in line_stripped:
                    best_w, best_h = current_w, current_h
                    break
                    
            width, height = best_w, best_h
        elif platform.system() == "Linux":
            # Linux: Use xrandr
            result = subprocess.run(
                ["xrandr"],
                capture_output=True,
                text=True,
                check=True
            )
            for line in result.stdout.splitlines():
                if " connected primary " in line or (" connected " in line and width == 0):
                    # e.g., "DP-1 connected primary 1920x1080+0+0 ..."
                    parts = line.split()
                    for p in parts:
                        if "x" in p and "+" in p:
                            res_part = p.split("+")[0]
                            w_str, h_str = res_part.split("x")
                            width = int(w_str)
                            height = int(h_str)
                            break
                    if width != 0:
                        break
        elif platform.system() == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            width = user32.GetSystemMetrics(0)
            height = user32.GetSystemMetrics(1)
    except Exception as e:
        print(f"Display detection failed: {e}")
        return "0"  # Fallback to landscape

    if width > 0 and height > 0:
        if height > width:
            return "270"  # Portrait

    return "0"  # Landscape default

def get_effective_rotation(master_orientation: str) -> str:
    """Returns the user configured orientation, or auto-detects if not set."""
    if master_orientation in ["0", "90", "180", "270"]:
        return master_orientation
    return get_primary_display_rotation()
