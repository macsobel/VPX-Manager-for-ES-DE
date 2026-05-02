#!/usr/bin/env python3
import os
import sys
import time
import queue
import tempfile
import threading
import platform
import subprocess
from pathlib import Path

import pygame

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

DEFAULT_BG     = Path(__file__).parent / "default_bg.png"

# ─────────────────────────────────────────────────────────────────────────────
# Backglass resolver — finds the best image for a detected game name
# ─────────────────────────────────────────────────────────────────────────────

def find_backglass(game_name: str, priority_list: list[str]) -> Path:
    """
    Search priority based on user settings.
    Default order is usually: fanart, covers, logos, marquees
    """
    # Map friendly names to directory objects
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

    # Final Default fallback
    return DEFAULT_BG

# ─────────────────────────────────────────────────────────────────────────────
# High-Speed lsof Sniffer
# ─────────────────────────────────────────────────────────────────────────────

class BackglassCompanion:
    def __init__(self, screen_index=1):
        self.screen_index = screen_index
        self.last_game = None
        self.display_queue = queue.Queue()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def get_esde_pid(self):
        """Find the process ID for the REAL ES-DE, excluding this script and the VPX Manager."""
        my_pid = os.getpid()
        try:
            # 1. Get all PIDs matching 'ES-DE'
            output = subprocess.check_output(["pgrep", "-f", "ES-DE"]).decode().strip()
            if not output:
                return None
                
            pids = output.split('\n')
            for p in pids:
                pid_val = int(p)
                if pid_val == my_pid:
                    continue
                
                # Check the full command line of this PID to ensure it's not the Manager
                try:
                    cmd_line = subprocess.check_output(["ps", "-p", p, "-o", "command="]).decode().strip()
                    # EXCLUDE our own manager app and our own script
                    if "VPX Manager" in cmd_line or "backglass_companion" in cmd_line:
                        continue
                    # The real ES-DE binary is usually just 'ES-DE' or in a Games folder
                    if "ES-DE" in cmd_line:
                        return p
                except:
                    continue
        except:
            pass
        return None

    def sniffer_thread(self):
        """High-speed lsof check (Fn = only filenames, much faster)"""
        print(f"🚀 Sniffer active (Turbo {int(POLL_INTERVAL*1000)}ms). Watching {MEDIA_DIR}...")
        pid = None

        while True:
            if not pid:
                pid = self.get_esde_pid()
                if pid:
                    print(f"📡 Connected to ES-DE (PID: {pid})")
                else:
                    time.sleep(1)
                    continue

            try:
                # Fast file check
                cmd = ["lsof", "-p", pid, "-Fn"]
                output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode()
                
                # Filter for our media directory
                media_files = [line[1:] for line in output.split('\n') 
                               if line.startswith('n') and str(MEDIA_DIR) in line]
                
                if media_files:
                    # Priority: Use the user-defined priority order to find the first trigger
                    selection = None
                    for trigger in self.priority:
                        for f in media_files:
                            if trigger in f:
                                selection = f
                                break
                        if selection: break
                    
                    if not selection:
                        selection = media_files[0]

                    game_name = Path(selection).stem
                    
                    if game_name != self.last_game:
                        print(f"🎯 New Selection: {game_name}")
                        bg_path = find_backglass(game_name, self.priority)
                        self.display_queue.put(bg_path)
                        self.last_game = game_name
            except subprocess.CalledProcessError:
                pid = None
                print("📴 ES-DE disconnected.")
            except Exception:
                pass
            
            time.sleep(POLL_INTERVAL)

    def run(self):
        # 1. Start sniffer in a background thread
        snif = threading.Thread(target=self.sniffer_thread, daemon=True)
        snif.start()

        # 2. Run display on main thread (required for SDL2/macOS)
        try:
            self.run_display()
        except KeyboardInterrupt:
            pass
        finally:
            print("\n👋  Shutting down...")

    def run_display(self):
        try:
            pygame.init()
            num_displays = pygame.display.get_num_displays()
            idx = self.screen_index if self.screen_index < num_displays else 0
            
            # Use safe flags for display initialization
            flags = pygame.NOFRAME | pygame.FULLSCREEN
            try:
                screen = pygame.display.set_mode((0, 0), flags, display=idx)
            except Exception as e:
                logger.error(f"Failed to set fullscreen mode on screen {idx}: {e}")
                # Fallback to windowed mode if fullscreen fails
                screen = pygame.display.set_mode((800, 600), pygame.NOFRAME, display=0)
                idx = 0
                
            W, H = screen.get_size()
            logger.info(f"✅ Backglass display active on screen {idx} ({W}×{H})")
    
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
    
            running = True
            while running:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                        running = False
    
                try:
                    img_path = self.display_queue.get_nowait()
                    next_surf = load_img(img_path)
                    fade_step = 0
                except queue.Empty:
                    pass
                except Exception as e:
                    logger.error(f"Queue error: {e}")
    
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
    # Priority passed as comma-separated list: fanart,covers,logos,marquees
    priority = sys.argv[2].split(',') if len(sys.argv) > 2 else ["fanart", "covers", "logos", "marquees"]
    
    companion = BackglassCompanion(screen_index=s_idx)
    companion.priority = priority
    companion.run()
