import psutil
import os
my_user = os.getlogin()
my_pid = os.getpid()
for p in psutil.process_iter(['pid', 'username', 'name']):
    if p.info['pid'] != my_pid and p.info['username'] == my_user:
        try:
            files = p.open_files()
            if files:
                print(f"Found {len(files)} open files for PID {p.info['pid']} ({p.info['name']})")
                break
        except Exception as e:
            pass
