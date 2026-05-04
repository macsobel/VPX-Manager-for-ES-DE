import os
import time
import threading
import subprocess
import signal
import logging
import platform
from pathlib import Path
from backend.core.config import config

logger = logging.getLogger("backglass_monitor")

class BackglassMonitor:
    def __init__(self):
        self._thread = None
        self._stop_event = threading.Event()
        self._companion_process = None
        self._is_monitoring = False

    def get_esde_pid(self):
        """Find the REAL ES-DE process, checking multiple possible names."""
        my_pid = os.getpid()
        # Common macOS process names for ES-DE
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
                            
                        # Get command line to verify it's not our own manager or script
                        cmd_line = subprocess.check_output(["ps", "-p", p, "-o", "command="]).decode().strip()
                        
                        # EXCLUSION FILTER: Must not contain our manager's signature
                        if any(sig in cmd_line for sig in ["VPX Manager", "backglass_companion", "antigravity"]):
                            continue
                            
                        # INCLUSION FILTER: If it contains ES-DE or EmulationStation and isn't us, it's likely ES-DE
                        if any(sig in cmd_line for sig in ["ES-DE", "es-de", "EmulationStation"]):
                            return p
                    except:
                        continue
            except:
                pass
        
        # If we got here, we didn't find anything
        logger.debug("ES-DE process not found in any common pattern.")
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
        
        # Determine correct screen index based on saved name
        screen_index = config.backglass_screen_index
        saved_name = config.backglass_screen_name

        if saved_name:
            try:
                # Lazy import to avoid circular dependencies
                from backend.routers.backglass import get_displays
                displays = get_displays()
                for d in displays:
                    if d["name"] == saved_name:
                        screen_index = d["index"]
                        logger.info(f"Matched display name '{saved_name}' to index {screen_index}")
                        break
            except Exception as e:
                logger.warning(f"Failed to match display name '{saved_name}': {e}")

        screen = str(screen_index)

        logger.info(f"Starting Backglass Companion on screen {screen} (saved as {saved_name or screen_index})...")
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
                        focus_window("EmulationStation")
                    except Exception as e:
                        logger.debug(f"Linux focus return failed: {e}")
            
            threading.Thread(target=return_focus, daemon=True).start()

        except Exception as e:
            logger.error(f"Failed to start companion: {e}")

    def stop_companion(self):
        if self._companion_process and self._companion_process.poll() is None:
            logger.info("Stopping Backglass Companion...")
            try:
                os.kill(self._companion_process.pid, signal.SIGTERM)
                self._companion_process.wait(timeout=2)
            except:
                try:
                    os.kill(self._companion_process.pid, signal.SIGKILL)
                except:
                    pass
            self._companion_process = None

    def _monitor_loop(self):
        logger.info("Backglass Auto-Monitor started.")
        last_game = None
        
        while not self._stop_event.is_set():
            # Check if companion has died on its own
            if self._companion_process and self._companion_process.poll() is not None:
                logger.info("Backglass Companion process ended.")
                self._companion_process = None
                last_game = None

            # Only do something if the feature is enabled in settings
            if config.backglass_enabled:
                esde_pid = self.get_esde_pid()
                
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
                        try:
                            cmd = ["lsof", "-p", str(esde_pid), "-Fn"]
                            output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode()
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
