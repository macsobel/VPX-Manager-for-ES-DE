import pygame
import sys
import time
import platform
import ctypes
import ctypes.util

def hide_dock_icon_macos():
    """Hide the app icon from the macOS Dock at runtime."""
    if platform.system() != "Darwin":
        return
    try:
        # Load AppKit
        appkit_path = ctypes.util.find_library('AppKit')
        if not appkit_path: return
        appkit = ctypes.cdll.LoadLibrary(appkit_path)
        
        # Get NSApp
        # [NSApplication sharedApplication]
        ns_app = appkit.NSApplication.sharedApplication()
        
        # NSApplicationActivationPolicyProhibited = 2 (No Dock, No Menu)
        # NSApplicationActivationPolicyAccessory = 1 (No Menu, shows in Command-Tab)
        # We use 2 to be completely invisible
        appkit.objc_msgSend.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_long]
        appkit.objc_msgSend.restype = ctypes.c_void_p
        
        # sel_registerName("setActivationPolicy:")
        set_policy_sel = appkit.sel_registerName(b"setActivationPolicy:")
        
        appkit.objc_msgSend(ns_app, set_policy_sel, 2)
    except Exception as e:
        # Fallback if something goes wrong with ctypes
        pass

def draw_tapered_segment(screen, p1, p2, thickness, color):
    # Draws a segment with tapered ends for that "LCD" look
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist = (dx**2 + dy**2)**0.5
    if dist == 0: return
    
    ux, uy = dx/dist, dy/dist
    vx, vy = -uy, ux # perpendicular
    
    half_t = thickness / 2
    inner_len = dist - thickness
    
    # Points for a hexagon-ish segment
    points = [
        (p1[0] + vx*0, p1[1] + vy*0),
        (p1[0] + ux*half_t + vx*half_t, p1[1] + uy*half_t + vy*half_t),
        (p2[0] - ux*half_t + vx*half_t, p2[1] - uy*half_t + vy*half_t),
        (p2[0] + vx*0, p2[1] + vy*0),
        (p2[0] - ux*half_t - vx*half_t, p2[1] - uy*half_t - vy*half_t),
        (p1[0] + ux*half_t - vx*half_t, p1[1] + uy*half_t - vy*half_t)
    ]
    pygame.draw.polygon(screen, color, points)

def draw_elite_digit(screen, digit, x, y, size, color):
    w = size
    h = size * 1.8
    t = size // 5
    
    # Points for 7-segment
    # 0: Top, 1: TL, 2: TR, 3: Mid, 4: BL, 5: BR, 6: Bot
    pts = [
        ((x+t, y), (x+w-t, y)),         # 0
        ((x, y+t), (x, y+h/2-t/2)),     # 1
        ((x+w, y+t), (x+w, y+h/2-t/2)), # 2
        ((x+t, y+h/2), (x+w-t, y+h/2)), # 3
        ((x, y+h/2+t/2), (x, y+h-t)),   # 4
        ((x+w, y+h/2+t/2), (x+w, y+h-t)), # 5
        ((x+t, y+h), (x+w-t, y+h))      # 6
    ]
    
    digit_map = {
        0: [0, 1, 2, 4, 5, 6], 1: [2, 5], 2: [0, 2, 3, 4, 6], 3: [0, 2, 3, 5, 6],
        4: [1, 2, 3, 5], 5: [0, 1, 3, 5, 6], 6: [0, 1, 3, 4, 5, 6],
        7: [0, 2, 5], 8: [0, 1, 2, 3, 4, 5, 6], 9: [0, 1, 2, 3, 5, 6]
    }
    
    for i in digit_map.get(digit, []):
        draw_tapered_segment(screen, pts[i][0], pts[i][1], t, color)

def identify_screen(display_index):
    # Hide from Dock on macOS immediately
    hide_dock_icon_macos()
    
    # Disable SDL's HID/joystick layer to prevent IOHIDManager corruption
    import os
    os.environ["SDL_JOYSTICK_DISABLED"] = "1"
    os.environ["SDL_HINT_JOYSTICK_HIDAPI"] = "0"
    os.environ["SDL_HINT_NO_SIGNAL_HANDLERS"] = "1"
    
    # Attempt to wake up display driver
    pygame.display.init()
    for _ in range(3):
        if pygame.display.get_num_displays() > display_index: break
        pygame.display.quit()
        time.sleep(0.1)
        pygame.display.init()

    try:
        # Get target display resolution for responsive scaling
        sizes = pygame.display.get_desktop_sizes()
        if display_index < len(sizes):
            screen_w, screen_h = sizes[display_index]
        else:
            screen_w, screen_h = 800, 800 # Fallback
            
        # Target ~70% of the screen height, capped at reasonable 800px
        win_size = int(min(screen_h * 0.7, screen_w * 0.7, 800))
        # Ensure it's not too tiny on very low-res screens
        win_size = max(win_size, 300)
        
        # Use 0x00008000 (SDL_WINDOW_ALWAYS_ON_TOP) to force window to the front
        flags = pygame.NOFRAME | 0x00008000
        screen = pygame.display.set_mode((win_size, win_size), flags, display=display_index)
        
        # Ensure window is registered with the OS and focused
        pygame.event.pump()
        
        # Force foreground on macOS
        if sys.platform == "darwin":
            try:
                # Tell macOS to bring the Python windows to the front
                import subprocess
                subprocess.Popen(["osascript", "-e", 'tell application "Python" to activate'])
            except:
                pass
                
        screen.fill((10, 12, 20))
        
        # Grid/Scanline effect scaled to window
        for i in range(0, win_size, max(2, win_size // 150)):
            pygame.draw.line(screen, (15, 18, 30), (0, i), (win_size, i))
            
        # Borders
        border_t = max(8, win_size // 40)
        pygame.draw.rect(screen, (79, 140, 255), (0, 0, win_size, win_size), border_t)
        pygame.draw.rect(screen, (40, 50, 80), (border_t, border_t, win_size - 2*border_t, win_size - 2*border_t), 2)
        
        # Central Number - Scaled and Centered
        digit_size = win_size // 3
        # Calculate centering
        dx = (win_size - digit_size) // 2
        dy = (win_size - int(digit_size * 1.8)) // 2
        draw_elite_digit(screen, display_index % 10, dx, dy, digit_size, (255, 255, 255))
        
        # Footer
        footer_h = win_size // 12
        footer_w = win_size // 4
        pygame.draw.rect(screen, (79, 140, 255), 
                         ((win_size - footer_w)//2, win_size - footer_h - border_t*2, footer_w, footer_h), 
                         border_radius=max(5, win_size // 60))
        
        # Tiny ID in footer
        tiny_digit = footer_h // 2
        tdx = (win_size - tiny_digit) // 2
        tdy = win_size - footer_h - border_t*2 + (footer_h - int(tiny_digit*1.8))//2
        draw_elite_digit(screen, display_index % 10, tdx, tdy, tiny_digit, (255, 255, 255))
        
        pygame.display.flip()
        pygame.display.flip()
        
        start_time = time.time()
        while time.time() - start_time < 5:
            for event in pygame.event.get():
                if time.time() - start_time < 3: continue
                if event.type in [pygame.QUIT, pygame.KEYDOWN]: return
            time.sleep(0.1)
    finally:
        pygame.display.quit()

if __name__ == "__main__":
    import sys
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    identify_screen(idx)
