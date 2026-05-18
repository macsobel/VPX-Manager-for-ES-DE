import psutil

try:
    proc = psutil.Process(99178)
    print(f"Status of 99178: {proc.status()}")
except Exception as e:
    print(f"Error: {e}")
