"""
pipeline/run.py
Cross-platform target runner for Windows/Linux environments where GNU make is not installed.
Equivalent to running: make data | make test | make eval
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable


def run_target(target: str):
    if target == "data":
        print("[PIPELINE] Running 00_fetch_static.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "00_fetch_static.py")], check=True)
        print("[PIPELINE] Running 01_build_grid.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "01_build_grid.py")], check=True)
        print("[PIPELINE] Running 02_features.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "02_features.py")], check=True)
    elif target == "test":
        print("[PIPELINE] Running pytest pipeline/tests/ -v...")
        pytest_exe = Path(PYTHON).parent / ("pytest.exe" if sys.platform == "win32" else "pytest")
        if not pytest_exe.exists():
            pytest_exe = "pytest"
        subprocess.run([str(pytest_exe), "-c", str(ROOT / "pipeline" / "pytest.ini"), "pipeline/tests/", "-v"], check=True)
    elif target == "eval":
        print("[EVAL PLACEHOLDER] Stage P4B Model Evaluation is scheduled for later roadmap phases.")
        print("[EVAL PLACEHOLDER] Validation against observed waterlogging events will be implemented in P4B.")
    else:
        print(f"Unknown target '{target}'. Available targets: data, test, eval")
        sys.exit(1)


if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "data"
    run_target(t)
