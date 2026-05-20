import os
import time
import threading
import subprocess
import signal
import logging
import platform
import psutil
import shlex
from pathlib import Path
from backend.core.config import config
from backend.core.utils import get_clean_env

logger = logging.getLogger("backglass_monitor")

class BackglassMonitor:
    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._companion_process = None
        self._is_monitoring = False
        self._ignored_esde_pid = None

    def get_esde_pid(self):
        """Find the REAL ES-DE process, checking multiple possible names."""
        my_pid = os.getpid()
        # Common macOS/Linux process names for ES-DE
        patterns = ["ES-DE", "es-de", "EmulationStation"]
        
        for pattern in patterns:
            try:
                output = subprocess.check_output(["pgrep", "-f", pattern]).decode().strip()
                if not output:
                    continue
                
                pids = output.split('\n')
                for p in pids:
                    try:
                        pid_int = int(p)
                        if pid_int == my_pid:
                            continue
                            
                        # Skip zombie/defunct/idle processes
                        try:
                            proc = psutil.Process(pid_int)
                            if proc.status() in [psutil.STATUS_ZOMBIE, psutil.STATUS_IDLE]:
                                continue
                        except Exception:
                            pass
                            
                        # Get command line to verify it's not our own manager, script, or Visual Pinball
                        cmd_line = subprocess.check_output(["ps", "-p", p, "-o", "command="]).decode().strip()
                        
                        # EXCLUSION FILTER: Must not contain our manager's signature or Visual Pinball
                        if any(sig in cmd_line for sig in ["VPX-Manager", "VPX Manager", "backglass_companion", "antigravity", "VPinballX", "vpx-wrapper", "./es-de 100", "launch_vpinball", "vpx_backglass"]):
                            continue
                            
                        # INCLUSION FILTER: If it contains ES-DE or EmulationStation and isn't us or VPX, it's likely ES-DE
                        # Fix: Check that the executable itself is named es-de or ES-DE, not just matching a path like /home/user/ES-DE/VPX-Manager
                        import shlex
                        try:
                            cmd_parts = shlex.split(cmd_line)
                            if cmd_parts:
                                exe_name = Path(cmd_parts[0]).name.lower()
                                if exe_name in ["es-de", "emulationstation"]:
                                    return pid_int
                        except:
                            # Fallback if shlex fails to parse
                            if any(sig in cmd_line.lower() for sig in ["es-de", "emulationstation"]):
                                return pid_int
                    except:
                        continue
            except:
                pass
        
        # If we got here, we didn't find anything
        return None

    def _get_paths(self):
        import sys
        if getattr(sys, "frozen", False):
            base_dir = Path(sys._MEIPASS)
            script = "" # In frozen builds, the executable itself handles flags
            python = sys.executable
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent.parent
            script = base_dir / "main.py"
            venv = base_dir / ".venv" / "bin" / "python"
            python = str(venv) if venv.exists() else sys.executable
        return python, script

    def start_companion(self):
        if self._companion_process and self._companion_process.poll() is None:
            return

        python, script = self._get_paths()
        
        # Determine correct screen index from the global displays array
        screen_index = 1 # Fallback

        saved_displays = getattr(config, "displays", [])
        bg_display = next((d for d in saved_displays if d.get("role") == "Backglass"), None)

        if bg_display and "index" in bg_display:
            screen_index = bg_display["index"]
            logger.info(f"Matched global Backglass display role to index {screen_index}")
        else:
            logger.warning("No Backglass display assigned in global settings, using fallback index 1.")

        screen = str(screen_index)

        logger.info(f"Starting Backglass Companion on screen {screen}...")
        try:
            cmd = [python]
            if script:
                cmd.append(str(script))
            cmd.extend(["--backglass", screen])

            self._companion_process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=get_clean_env(),
                start_new_session=True,
                text=True,
                bufsize=1 # Line buffered
            )
            
            def log_companion(proc):
                try:
                    while proc.poll() is None:
                        line = proc.stdout.readline()
                        if line:
                            logger.info(f"[Companion] {line.strip()}")
                        else:
                            time.sleep(0.1)
                except Exception:
                    pass
            
            threading.Thread(target=log_companion, args=(self._companion_process,), daemon=True).start()
            
            # macOS/Linux: Return focus to ES-DE after a brief delay to allow the window to open
            def return_focus():
                time.sleep(1.0)
                if platform.system() == "Darwin":
                    try:
                        # Only activate if it's already running to prevent unexpected launches
                        script = 'if application "ES-DE" is running then activate application "ES-DE"'
                        subprocess.run(["osascript", "-e", script], 
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    except:
                        pass
                elif platform.system() == "Linux":
                    try:
                        from backend.services.linux_focus import focus_window
                        if not focus_window("ES-DE"):
                            focus_window("EmulationStation")
                    except Exception as e:
                        logger.debug(f"Linux focus return failed: {e}")
            
            threading.Thread(target=return_focus, daemon=True).start()

        except Exception as e:
            logger.error(f"Failed to start companion: {e}")

    def stop_companion(self):
        if self._companion_process and self._companion_process.poll() is None:
            logger.info("Stopping Backglass Companion...")
            pid = self._companion_process.pid
            try:
                # Send the signal to the entire process group to ensure the PyInstaller 
                # bootloader and the actual Pygame display payload process quit together cleanly.
                os.killpg(pid, signal.SIGTERM)
                self._companion_process.wait(timeout=2)
            except Exception:
                try:
                    os.killpg(pid, signal.SIGKILL)
                except Exception:
                    # Fallback to single PID termination if PGID operations fail
                    try:
                        os.kill(pid, signal.SIGTERM)
                    except Exception:
                        pass
            self._companion_process = None

    def _monitor_loop(self):
        logger.info("Backglass Auto-Monitor started.")
        last_game = None
        cached_esde_pid = None
        last_lsof_time = 0.0
        
        while not self._stop_event.is_set():
            # Check if companion has died on its own
            if self._companion_process and self._companion_process.poll() is not None:
                logger.info("Backglass Companion process ended.")
                self._companion_process = None
                last_game = None
                
                if cached_esde_pid:
                    logger.info("Companion was closed while ES-DE is running. Ignoring this ES-DE session until restart.")
                    self._ignored_esde_pid = cached_esde_pid
                    cached_esde_pid = None

            # Only do something if the feature is enabled in settings
            if config.backglass_enabled:
                if cached_esde_pid is not None:
                    # Very fast, robust check if the process is still alive and not a zombie
                    try:
                        proc = psutil.Process(cached_esde_pid)
                        if proc.status() == psutil.STATUS_ZOMBIE:
                            cached_esde_pid = None
                    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                        cached_esde_pid = None

                if cached_esde_pid is None:
                    new_pid = self.get_esde_pid()
                    if new_pid and new_pid == self._ignored_esde_pid:
                        # User manually closed the companion for this session, ignore it
                        pass
                    elif new_pid:
                        # New ES-DE session started!
                        self._ignored_esde_pid = None
                        cached_esde_pid = new_pid

                esde_pid = cached_esde_pid
                
                if esde_pid and not self._companion_process:
                    # ES-DE started!
                    self.start_companion()
                    last_game = None
                elif not esde_pid and self._companion_process:
                    # ES-DE stopped!
                    self.stop_companion()
                    last_game = None
                    # Clean up the trigger file so it doesn't show a stale game on next launch
                    try:
                        Path("/tmp/vpx_backglass_current_game.txt").unlink(missing_ok=True)
                    except:
                        pass
                    
                # If running, do the check here
                if esde_pid and self._companion_process and self._companion_process.stdin:
                    # 1. Try reading from the ES-DE custom event trigger file
                    game_name = None
                    trigger_file = Path("/tmp/vpx_backglass_current_game.txt")
                    if trigger_file.exists():
                        try:
                            # We only care about the first line
                            with open(trigger_file, "r") as f:
                                content = f.read().strip()
                                if content:
                                    game_name = content
                        except Exception:
                            pass

                    if not game_name:
                        now = time.time()
                        if now - last_lsof_time >= 1.0: # Check at most once per second to prevent high CPU and hanging
                            last_lsof_time = now
                            try:
                                cmd = ["lsof", "-p", str(esde_pid), "-Fn"]
                                output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=0.5).decode()
                                # Look for any media file in the vpinball downloaded_media directory
                                # We search for "downloaded_media" or the user's media dir
                                media_root = "downloaded_media"
                                lines = output.split('\n')
                                
                                found_media = []
                                for line in lines:
                                    if line.startswith('n') and media_root in line and 'vpinball' in line:
                                        # Filter for common image AND video extensions
                                        # We include videos because ES-DE keeps them open while they play,
                                        # making them a much more reliable trigger than images on fast Macs.
                                        if any(ext in line.lower() for ext in ['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mkv', '.avi', '.mov']):
                                            found_media.append(line[1:])
                                
                                if found_media:
                                    # Priority: 
                                    # 1. Videos (very reliable)
                                    # 2. Covers/Wheels (Instant signal when scrolling)
                                    # 3. Fanart
                                    videos = [f for f in found_media if any(v in f.lower() for v in ['.mp4', '.mkv', '.avi', '.mov'])]
                                    covers = [f for f in found_media if '/covers/' in f or '/wheel/' in f or '/marquees/' in f]
                                    fanart = [f for f in found_media if '/fanart/' in f]
                                    
                                    if videos:
                                        selection = videos[0]
                                    elif covers:
                                        # If we found a cover, it's likely an instant scroll event
                                        selection = covers[0]
                                    elif fanart:
                                        selection = fanart[0]
                                    else:
                                        selection = found_media[0]
                                        
                                    game_name = Path(selection).stem
                                    logger.debug(f"Sniffer detected game: {game_name}")
                            except Exception:
                                pass

                    # 3. Update companion if game changed
                    if game_name and game_name != last_game:
                        last_game = game_name
                        # Send game name to companion via stdin
                        try:
                            self._companion_process.stdin.write(f"GAME:{game_name}\n")
                            self._companion_process.stdin.flush()
                        except:
                            pass
                    
                    time.sleep(0.01) # 10ms ultra-turbo polling for instant detection
                else:
                    time.sleep(2) # Slow poll when ES-DE is not running
            else:
                # If disabled in settings but process is running, stop it
                if self._companion_process:
                    self.stop_companion()
                    last_game = None
                time.sleep(2)


    def start(self):
        if self._is_monitoring:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        self._is_monitoring = True

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1)
        self.stop_companion()
        self._is_monitoring = False

# Global singleton
backglass_monitor = BackglassMonitor()
