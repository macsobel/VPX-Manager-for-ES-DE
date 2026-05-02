import psutil
import os
for p in psutil.process_iter():
    if p.pid != os.getpid() and p.username() == os.getlogin():
        try:
            print(p.open_files())
            print("Success on PID", p.pid)
            break
        except Exception as e:
            pass
