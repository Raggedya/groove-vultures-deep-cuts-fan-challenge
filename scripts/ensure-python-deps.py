from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / ".tools" / "python"
TARGET.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(TARGET))

required = ("PIL", "qrcode", "zxingcpp")
missing = [name for name in required if importlib.util.find_spec(name) is None]
if missing:
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--target", str(TARGET), "-r", str(ROOT / "requirements.txt")],
        check=True,
    )

print("Deep Cuts image dependencies are ready.")
