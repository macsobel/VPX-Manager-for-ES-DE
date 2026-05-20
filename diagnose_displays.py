#!/usr/bin/env python3
import os
import sys
import time
import platform

print("====================================================")
print("   VPX Manager - Linux Display Diagnostic Script")
print("====================================================")

# 1. System Info
print(f"OS: {platform.system()} {platform.release()}")
print(f"Python version: {sys.version}")

# 2. Environment Variables
env_vars = ["XDG_SESSION_TYPE", "WAYLAND_DISPLAY", "DISPLAY", "SDL_VIDEODRIVER", "SDL_VIDEO_WINDOW_POS"]
print("\n--- Environment Variables ---")
for var in env_vars:
    print(f"{var}: {os.environ.get(var, 'NOT SET')}")

# 3. Try to import pygame
try:
    import pygame
    print(f"\nPygame version: {pygame.__version__}")
    print(f"SDL version: {'.'.join(map(str, pygame.get_sdl_version()))}")
except ImportError:
    print("\n❌ Pygame is not installed in this Python environment.")
    print("Please run this script using the project's virtual environment:")
    print("  .venv/bin/python3 scratch/diagnose_displays.py")
    sys.exit(1)

# 4. Initialize pygame display
print("\nInitializing pygame.display...")
try:
    pygame.display.init()
    print("✅ Pygame display initialized successfully.")
except Exception as e:
    print(f"❌ Failed to initialize pygame display: {e}")
    sys.exit(1)

# 5. Query Displays
print("\n--- Display Detection ---")
try:
    # Get desktop sizes (Pygame 2+)
    sizes = pygame.display.get_desktop_sizes()
    num_displays = len(sizes)
    print(f"Number of displays detected by Pygame: {num_displays}")
    for idx, size in enumerate(sizes):
        print(f"  Display {idx}: Resolution = {size[0]}x{size[1]}")
except Exception as e:
    print(f"Error getting desktop sizes: {e}")

# 6. Test Window Placement on each display
print("\n--- Window Placement Test ---")
print("We will attempt to open a colored window on each detected display.")
print("Watch your screens and note which screen each color appears on!")
print("Press ESC or any key on the test windows to proceed, or wait 3 seconds per window.")
time.sleep(2)

colors = [
    (255, 0, 0),     # Red for Display 0
    (0, 0, 255),     # Blue for Display 1
    (0, 255, 0),     # Green for Display 2
    (255, 255, 0),   # Yellow for Display 3
]

for idx in range(num_displays):
    size = sizes[idx]
    color = colors[idx % len(colors)]
    color_name = ["Red", "Blue", "Green", "Yellow"][idx % 4]
    
    print(f"\n👉 Attempting to open {color_name} window on Display {idx} ({size[0]}x{size[1]})...")
    
    try:
        # We try borderless mode
        flags = pygame.NOFRAME
        # On Wayland, we try both borderless and fullscreen. Let's try borderless first:
        screen = pygame.display.set_mode(size, flags, display=idx)
        
        # Color fill
        screen.fill(color)
        
        # Render display number text
        try:
            pygame.font.init()
            font = pygame.font.SysFont(None, 72)
            text = font.render(f"DISPLAY {idx} ({color_name})", True, (255, 255, 255))
            text_rect = text.get_rect(center=(size[0]//2, size[1]//2))
            screen.blit(text, text_rect)
            
            sub_text = font.render("Press any key to close", True, (200, 200, 200))
            sub_rect = sub_text.get_rect(center=(size[0]//2, (size[1]//2) + 60))
            screen.blit(sub_text, sub_rect)
        except Exception as fe:
            print(f"  (Could not render text: {fe})")
            
        pygame.display.flip()
        
        # Wait for keypress or timeout (3 seconds)
        start_time = time.time()
        waiting = True
        while waiting and (time.time() - start_time < 3.0):
            for event in pygame.event.get():
                if event.type in (pygame.QUIT, pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN):
                    waiting = False
            time.sleep(0.05)
            
        pygame.display.quit()
        pygame.display.init()
        print(f"  Closed window for Display {idx}.")
        
    except Exception as e:
        print(f"  ❌ Failed to open window on Display {idx}: {e}")

pygame.quit()
print("\n====================================================")
print("Diagnostic Finished.")
print("Please run this on the Linux machine and paste the output.")
print("====================================================")
