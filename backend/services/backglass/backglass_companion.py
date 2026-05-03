#!/usr/bin/env python3
import os
import sys
import time
import random
import queue
import tempfile
import threading
import platform
import subprocess
from pathlib import Path

# Completely disable SDL's HID/joystick layer BEFORE importing pygame.
# Without this, importing pygame loads SDL2, which registers IOHIDManager
# callbacks that corrupt shared HID state, causing ES-DE to segfault on its next launch.
os.environ["SDL_JOYSTICK_DISABLED"] = "1"
os.environ["SDL_HINT_JOYSTICK_HIDAPI"] = "0"
os.environ["SDL_HINT_NO_SIGNAL_HANDLERS"] = "1"

import pygame
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backglass_companion")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

if platform.system() == "Linux":
    ESDE_DIR = Path(os.path.expanduser("~/.emulationstation"))
    # Check if ~/ROMs/vpinball exists, otherwise fallback to ~/.emulationstation/roms/vpinball
    TABLES_DIR = Path(os.path.expanduser("~/ROMs/vpinball"))
    if not TABLES_DIR.exists():
        TABLES_DIR = ESDE_DIR / "roms" / "vpinball"
else:
    ESDE_DIR = Path(os.path.expanduser("~/ES-DE"))
    TABLES_DIR = Path(os.path.expanduser("~/ROMs/vpinball"))

MEDIA_DIR      = ESDE_DIR / "downloaded_media" / "vpinball"
COVERS_DIR     = MEDIA_DIR / "covers"
FANART_DIR     = MEDIA_DIR / "fanart"
CACHE_DIR      = Path(tempfile.gettempdir()) / "vpx_backglass_companion"
FADE_DURATION  = 0.25   # seconds for crossfade
BG_COLOR       = (0, 0, 0)
POLL_INTERVAL  = 0.05   # 50ms for turbo-polling

if getattr(sys, "frozen", False):
    # PyInstaller bundles files in sys._MEIPASS
    BASE_DIR = Path(sys._MEIPASS)
    DEFAULT_BG = BASE_DIR / "backend" / "services" / "backglass" / "default_bg.png"
    GENERIC_BGS_DIR = BASE_DIR / "resources" / "backglass_images"
    ESDE_BG = BASE_DIR / "resources" / "esde_bg.png"
else:
    BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
    DEFAULT_BG = Path(__file__).parent / "default_bg.png"
    GENERIC_BGS_DIR = BASE_DIR / "resources" / "backglass_images"
    ESDE_BG = BASE_DIR / "resources" / "esde_bg.png"

def get_random_backglass() -> Path:
    """Returns a random PNG from the generic backglass directory."""
    try:
        if GENERIC_BGS_DIR.exists():
            images = list(GENERIC_BGS_DIR.glob("*.png"))
            if images:
                return random.choice(images)
    except Exception as e:
        logger.error(f"Error picking random backglass: {e}")
    
    return DEFAULT_BG

# ─────────────────────────────────────────────────────────────────────────────
# Backglass resolver — finds the best image for a detected game name
# ─────────────────────────────────────────────────────────────────────────────

def find_backglass(game_name: str) -> Path:
    """
    Search for fanart (backglass) for the given game name.
    Falls back to a random generic backglass if not found.
    """
    if FANART_DIR.exists():
        for ext in (".png", ".jpg", ".jpeg", ".webp", ".tiff"):
            # 1. Check root level (standard)
            f = FANART_DIR / f"{game_name}{ext}"
            logger.info(f"Checking fanart path: {f}")
            if f.exists():
                return f
            # 2. Check subfolder (some ES-DE setups)
            f_sub = FANART_DIR / game_name / f"{game_name}{ext}"
            logger.info(f"Checking fanart path: {f_sub}")
            if f_sub.exists():
                return f_sub
    
    logger.info(f"No fanart found for {game_name}, falling back to generic.")

    # Final Default fallback
    return get_random_backglass()

# ─────────────────────────────────────────────────────────────────────────────
# High-Speed lsof Sniffer
# ─────────────────────────────────────────────────────────────────────────────

class BackglassCompanion:
    def __init__(self, screen_index=1):
        self.screen_index = screen_index
        self.last_game = None
        self.display_queue = queue.Queue()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def stdin_reader(self):
        """Read game names from standard input sent by the monitor service."""
        import sys
        logger.info("📡 Companion stdin listener started.")
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    time.sleep(0.1)
                    continue
                line = line.strip()
                if line.startswith("GAME:"):
                    game_name = line[5:]
                    if game_name != self.last_game:
                        logger.info(f"🎯 New Selection: {game_name}")
                        bg_path = find_backglass(game_name)
                        self.display_queue.put(bg_path)
                        self.last_game = game_name
                elif line == "DISCONNECT":
                    logger.info("📴 ES-DE disconnected.")
                    self.last_game = None
                    self.display_queue.put(ESDE_BG)
            except Exception as e:
                logger.error(f"Stdin read error: {e}")
                time.sleep(1)

    def run(self):
        # 1. Run display on main thread (required for SDL2/macOS)
        try:
            self.run_display()
        except KeyboardInterrupt:
            pass
        finally:
            print("\n👋  Shutting down...")

    def run_display(self):
        try:
            logger.info("Initializing Pygame...")
            
            # Only init the subsystems we actually need (display)
            pygame.display.init()
            logger.info("Pygame initialized (display only, HID disabled).")
            
            # On macOS, native fullscreen (0,0) can segfault on secondary monitors.
            # We try to get explicit dimensions first.
            try:
                desktop_sizes = pygame.display.get_desktop_sizes()
                num_displays = len(desktop_sizes)
                idx = self.screen_index if self.screen_index < num_displays else 0
                W, H = desktop_sizes[idx]
                logger.info(f"Target display {idx} resolution: {W}x{H}")
            except Exception as e:
                logger.warning(f"Could not get desktop sizes: {e}")
                idx = 0
                W, H = 800, 600

            # Try multiple flag combinations for stability
            attempt_modes = [
                # 1. Borderless Window (Most stable on macOS secondaries)
                (W, H, pygame.NOFRAME),
                # 2. Standard Window fallback
                (W, H, 0),
                # 3. Fullscreen Scaled
                (W, H, pygame.FULLSCREEN | pygame.SCALED),
            ]
            
            screen = None
            for w, h, flags in attempt_modes:
                try:
                    mode_name = "FULLSCREEN" if flags & pygame.FULLSCREEN else "WINDOWED"
                    if flags & pygame.NOFRAME: mode_name = "BORDERLESS"
                    if flags & pygame.SCALED: mode_name += " | SCALED"
                    
                    logger.info(f"Attempting {mode_name} at {w}x{h} on display {idx}...")
                    screen = pygame.display.set_mode((w, h), flags, display=idx)
                    
                    if screen:
                        W, H = screen.get_size()
                        logger.info(f"✅ Backglass display active on screen {idx} ({W}×{H}) using {mode_name}")
                        break
                except Exception as e:
                    logger.warning(f"Mode {mode_name} failed: {e}")

            if not screen:
                logger.error("Failed to initialize any display mode.")
                return

            # Mouse visibility changes on macOS secondary monitors can cause segfaults in SDL2.
            # We skip hiding the mouse cursor to ensure stability.
    
            clock = pygame.time.Clock()
            current_surf = pygame.Surface((W, H))
            current_surf.fill(BG_COLOR)
            next_surf = None
            fade_step = 0
            fade_steps = max(1, int(FADE_DURATION * 60))
    
            def load_img(path):
                try:
                    raw = pygame.image.load(str(path))
                    iw, ih = raw.get_size()
                    scale = min(W/iw, H/ih)
                    nw, nh = int(iw*scale), int(ih*scale)
                    scaled = pygame.transform.smoothscale(raw, (nw, nh))
                    surf = pygame.Surface((W, H))
                    surf.fill(BG_COLOR)
                    surf.blit(scaled, ((W-nw)//2, (H-nh)//2))
                    return surf
                except Exception as e:
                    logger.error(f"Failed to load image {path}: {e}")
                    return current_surf
    
            # Start stdin listener
            reader_thread = threading.Thread(target=self.stdin_reader, daemon=True)
            reader_thread.start()

            running = True
            while running:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                        running = False
    
                # Optimization: If there are multiple images in the queue, skip to the latest one
                new_image_path = None
                while not self.display_queue.empty():
                    try:
                        new_image_path = self.display_queue.get_nowait()
                    except queue.Empty:
                        break
                
                if new_image_path:
                    next_surf = load_img(new_image_path)
                    fade_step = 0 # Reset fade when a new image arrives
    
                if next_surf:
                    fade_step += 1
                    alpha = int((fade_step / fade_steps) * 255)
                    next_surf.set_alpha(min(alpha, 255))
                    screen.blit(current_surf, (0, 0))
                    screen.blit(next_surf, (0, 0))
                    if fade_step >= fade_steps:
                        current_surf = next_surf.copy()
                        current_surf.set_alpha(255)
                        next_surf = None
                else:
                    screen.blit(current_surf, (0, 0))
    
                pygame.display.flip()
                clock.tick(60)
            pygame.quit()
        except Exception as e:
            logger.error(f"Fatal error in display thread: {e}")
            pygame.quit()


if __name__ == "__main__":
    s_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    companion = BackglassCompanion(screen_index=s_idx)
    companion.run()
