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
        """Find the REAL ES-DE process, ignoring our own manager."""
        try:
            output = subprocess.check_output(["pgrep", "-f", "ES-DE"]).decode().strip()
            if not output:
                return None
            
            pids = output.split('\n')
            for p in pids:
                try:
                    # Filter out our own manager app and scripts
                    cmd_line = subprocess.check_output(["ps", "-p", p, "-o", "command="]).decode().strip()
                    if "VPX Manager" in cmd_line or "backglass_companion" in cmd_line:
                        continue
                    if "ES-DE" in cmd_line:
                        return p
                except:
                    continue
        except:
            pass
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
        screen = str(config.backglass_screen_index)
        priority = ",".join(config.backglass_priority)
        
        logger.info(f"Starting Backglass Companion on screen {screen} with priority {priority}...")
        try:
            cmd = [python]
            if script:
                cmd.append(str(script))
            cmd.extend(["--backglass", screen, priority])

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

                    # 2. Fallback to lsof logic if the event file is missing or empty
                    # (this happens if they haven't re-run the ES-DE integration tool to install the script)
                    if not game_name:
                        try:
                            cmd = ["lsof", "-p", str(esde_pid), "-Fn"]
                            output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode()
                            media_files = [line[1:] for line in output.split('\n')
                                           if line.startswith('n') and 'downloaded_media/vpinball' in line]
                            
                            if media_files:
                                # Prioritize based on config
                                selection = None
                                for trigger in config.backglass_priority:
                                    for f in media_files:
                                        if trigger in f:
                                            selection = f
                                            break
                                    if selection: break
                                
                                if not selection:
                                    selection = media_files[0]

                                game_name = Path(selection).stem
                        except subprocess.CalledProcessError:
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
                    
                    time.sleep(0.05) # 50ms turbo polling
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
