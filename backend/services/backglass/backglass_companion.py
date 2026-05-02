#!/usr/bin/env python3
"""
Backglass Companion — displays backglass art on a secondary monitor.

Uses native macOS Cocoa (PyObjC) instead of Pygame/SDL2 to completely avoid
IOHIDManager corruption that causes ES-DE to segfault on relaunch.
Falls back to Pygame on Linux.
"""
import os
import sys
import time
import queue
import tempfile
import threading
import platform
from pathlib import Path

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
BG_COLOR       = (0, 0, 0)

DEFAULT_BG     = Path(__file__).parent / "default_bg.png"

# ─────────────────────────────────────────────────────────────────────────────
# Backglass resolver — finds the best image for a detected game name
# ─────────────────────────────────────────────────────────────────────────────

def find_backglass(game_name: str, priority_list: list) -> Path:
    """
    Search priority based on user settings.
    Default order is usually: fanart, covers, logos, marquees
    """
    dir_map = {
        "covers": COVERS_DIR,
        "fanart": FANART_DIR,
        "logos": MEDIA_DIR / "logos",
        "marquees": MEDIA_DIR / "marquees"
    }

    for trigger in priority_list:
        target_dir = dir_map.get(trigger)
        if not target_dir: continue
        
        for ext in (".png", ".jpg", ".jpeg", ".webp", ".tiff"):
            f = target_dir / f"{game_name}{ext}"
            if f.exists():
                return f

    return DEFAULT_BG

# ─────────────────────────────────────────────────────────────────────────────
# Native Cocoa Display (macOS) — zero SDL2 involvement
# ─────────────────────────────────────────────────────────────────────────────

class BackglassCompanion:
    def __init__(self, screen_index=1):
        self.screen_index = screen_index
        self.last_game = None
        self.display_queue = queue.Queue()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def stdin_reader(self):
        """Read game names from standard input sent by the monitor service."""
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
                        bg_path = find_backglass(game_name, self.priority)
                        self.display_queue.put(bg_path)
                        self.last_game = game_name
                elif line == "DISCONNECT":
                    logger.info("📴 ES-DE disconnected.")
                    self.last_game = None
                    self.display_queue.put(Path(__file__).parent.parent.parent.parent / "resources" / "esde_bg.png")
            except Exception as e:
                logger.error(f"Stdin read error: {e}")
                time.sleep(1)

    def run(self):
        try:
            if platform.system() == "Darwin":
                self.run_display_cocoa()
            else:
                self.run_display_pygame()
        except KeyboardInterrupt:
            pass
        finally:
            print("\n👋  Shutting down...")

    def run_display_cocoa(self):
        """Native macOS Cocoa display — no SDL2, no HID corruption."""
        try:
            from AppKit import (
                NSApplication, NSWindow, NSImageView, NSImage, NSScreen,
                NSBorderlessWindowMask, NSBackingStoreBuffered,
                NSApplicationActivationPolicyProhibited,
                NSImageScaleProportionallyUpOrDown, NSCompositingOperationCopy,
                NSColor, NSApp
            )
            from Foundation import NSMakeRect, NSTimer, NSRunLoop, NSDefaultRunLoopMode
            from PIL import Image
            import io
        except ImportError as e:
            logger.error(f"PyObjC not available: {e}. Falling back to pygame.")
            self.run_display_pygame()
            return

        logger.info("Initializing Cocoa display...")

        # Initialize the NSApplication
        app = NSApplication.sharedApplication()
        app.setActivationPolicy_(NSApplicationActivationPolicyProhibited)

        # Get the target screen
        screens = NSScreen.screens()
        idx = self.screen_index if self.screen_index < len(screens) else 0
        target_screen = screens[idx]
        frame = target_screen.frame()
        W = int(frame.size.width)
        H = int(frame.size.height)
        
        logger.info(f"Target display {idx}: {W}x{H} at ({int(frame.origin.x)},{int(frame.origin.y)})")

        # Create borderless fullscreen window on the target screen
        window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_screen_(
            frame,
            NSBorderlessWindowMask,
            NSBackingStoreBuffered,
            False,
            target_screen
        )
        window.setLevel_(0)  # Normal level - below ES-DE
        window.setBackgroundColor_(NSColor.blackColor())
        window.setCollectionBehavior_(1 << 0)  # NSWindowCollectionBehaviorCanJoinAllSpaces

        # Create image view
        image_view = NSImageView.alloc().initWithFrame_(NSMakeRect(0, 0, W, H))
        image_view.setImageScaling_(NSImageScaleProportionallyUpOrDown)
        window.contentView().addSubview_(image_view)

        window.orderFront_(None)
        window.makeKeyAndOrderFront_(None)
        
        logger.info(f"✅ Backglass display active on screen {idx} ({W}×{H}) using Cocoa")

        # Helper: load image and display it
        def load_and_display(path):
            try:
                # Use Pillow to load and scale the image, then convert to NSImage
                img = Image.open(str(path))
                iw, ih = img.size
                scale = min(W / iw, H / ih)
                nw, nh = int(iw * scale), int(ih * scale)
                img = img.resize((nw, nh), Image.LANCZOS)

                # Create black background
                bg = Image.new('RGB', (W, H), (0, 0, 0))
                bg.paste(img, ((W - nw) // 2, (H - nh) // 2))

                # Convert PIL image to TIFF data then NSImage
                buf = io.BytesIO()
                bg.save(buf, format='TIFF')
                tiff_data = buf.getvalue()
                
                from Foundation import NSData
                ns_data = NSData.dataWithBytes_length_(tiff_data, len(tiff_data))
                ns_image = NSImage.alloc().initWithData_(ns_data)
                
                if ns_image:
                    image_view.setImage_(ns_image)
                    
            except Exception as e:
                logger.error(f"Failed to load image {path}: {e}")

        # Start stdin listener
        reader_thread = threading.Thread(target=self.stdin_reader, daemon=True)
        reader_thread.start()

        # Timer to check the queue (runs on the main run loop)
        def check_queue():
            try:
                img_path = self.display_queue.get_nowait()
                load_and_display(img_path)
            except queue.Empty:
                pass
            except Exception as e:
                logger.error(f"Queue error: {e}")

        class QueueChecker:
            @staticmethod
            def fire_(timer):
                check_queue()

        # Create a repeating timer on the main run loop
        timer = NSTimer.timerWithTimeInterval_target_selector_userInfo_repeats_(
            0.05,  # 50ms
            QueueChecker,
            'fire:',
            None,
            True
        )
        NSRunLoop.currentRunLoop().addTimer_forMode_(timer, NSDefaultRunLoopMode)

        # Run the application event loop
        try:
            app.run()
        except Exception as e:
            logger.error(f"Cocoa run loop error: {e}")

    def run_display_pygame(self):
        """Fallback for Linux — uses Pygame/SDL2."""
        try:
            import pygame
            
            logger.info("Initializing Pygame (Linux fallback)...")
            pygame.display.init()
            pygame.font.init()

            try:
                desktop_sizes = pygame.display.get_desktop_sizes()
                num_displays = len(desktop_sizes)
                idx = self.screen_index if self.screen_index < num_displays else 0
                W, H = desktop_sizes[idx]
            except Exception:
                idx = 0
                W, H = 800, 600

            screen = pygame.display.set_mode((W, H), pygame.NOFRAME, display=idx)
            clock = pygame.time.Clock()
            current_surf = pygame.Surface((W, H))
            current_surf.fill(BG_COLOR)

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

            reader_thread = threading.Thread(target=self.stdin_reader, daemon=True)
            reader_thread.start()

            running = True
            while running:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                        running = False

                try:
                    img_path = self.display_queue.get_nowait()
                    current_surf = load_img(img_path)
                except queue.Empty:
                    pass

                screen.blit(current_surf, (0, 0))
                pygame.display.flip()
                clock.tick(30)
            pygame.quit()
        except Exception as e:
            logger.error(f"Pygame display error: {e}")


if __name__ == "__main__":
    s_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    priority = sys.argv[2].split(',') if len(sys.argv) > 2 else ["fanart", "covers", "logos", "marquees"]
    
    companion = BackglassCompanion(screen_index=s_idx)
    companion.priority = priority
    companion.run()
