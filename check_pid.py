import os
import psutil
import subprocess

my_pid = os.getpid()
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
                if pid_int == my_pid: continue
                proc = psutil.Process(pid_int)
                if proc.status() == psutil.STATUS_ZOMBIE: continue
                cmd_line = subprocess.check_output(["ps", "-p", str(p), "-o", "command="]).decode().strip()
                print(f"Match for '{pattern}': {pid_int} | cmd: {cmd_line}")
                if any(sig in cmd_line for sig in ["VPX-Manager", "VPX Manager", "backglass_companion", "antigravity", "VPinballX", "vpx-wrapper"]):
                    print(" -> Excluded by filter")
                    continue
                if any(sig in cmd_line for sig in ["ES-DE", "es-de", "EmulationStation"]):
                    print(" -> MATCHED (Included!)")
            except Exception as e:
                print(f"Error on {p}: {e}")
    except Exception as e:
        print(f"Pgrep error: {e}")
