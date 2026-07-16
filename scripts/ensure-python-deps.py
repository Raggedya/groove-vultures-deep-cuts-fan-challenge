from __future__ import annotations

import importlib
import importlib.util
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path(os.environ.get("DEEP_CUTS_PYTHON_TARGET", ROOT / ".tools" / "python")).resolve()
TARGET.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(TARGET))

required = ("PIL", "qrcode", "zxingcpp")
missing = [name for name in required if importlib.util.find_spec(name) is None]
if missing:
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--target", str(TARGET), "-r", str(ROOT / "requirements.txt")],
        check=True,
    )

importlib.invalidate_caches()
unavailable = []
for name in required:
    try:
        importlib.import_module(name)
    except ModuleNotFoundError:
        unavailable.append(name)
if unavailable:
    raise SystemExit(f"Deep Cuts image dependency verification failed: {', '.join(unavailable)}")

print("Deep Cuts image dependencies are ready.")
