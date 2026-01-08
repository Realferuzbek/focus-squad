# Touch a flag file the running tracker watches; it will post immediately.
import time
from pathlib import Path

flag_path = Path(__file__).with_name("post_now.flag")
with open(flag_path, "w", encoding="utf-8") as f:
    f.write(str(time.time()))
print("Requested immediate leaderboard post.")
