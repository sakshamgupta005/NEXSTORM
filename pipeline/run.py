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
        print("[PIPELINE] Running 03_susceptibility.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "03_susceptibility.py")], check=True)
        print("[PIPELINE] Running 04_hotspots.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "04_hotspots.py")], check=True)
        print("[PIPELINE] Running 05_thresholds.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "05_thresholds.py")], check=True)
        print("[PIPELINE] Running 06_freeze_config.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "06_freeze_config.py")], check=True)
    elif target == "test":
        print("[PIPELINE] Running pytest pipeline/tests/ -v...")
        pytest_exe = Path(PYTHON).parent / ("pytest.exe" if sys.platform == "win32" else "pytest")
        if not pytest_exe.exists():
            pytest_exe = "pytest"
        subprocess.run([str(pytest_exe), "-c", str(ROOT / "pipeline" / "pytest.ini"), "pipeline/tests/", "-v"], check=True)
    elif target == "eval":
        print("[PIPELINE] Running 07_eval_forecast.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "07_eval_forecast.py")], check=True)
        print("[PIPELINE] Running 08_eval_susceptibility.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "08_eval_susceptibility.py")], check=True)
        print("[PIPELINE] Running 09_eval_events.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "09_eval_events.py")], check=True)
        print("[PIPELINE] Running 10_build_replay.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "10_build_replay.py")], check=True)
        print("[PIPELINE] Running 11_write_summary.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "11_write_summary.py")], check=True)
    elif target == "buildings":
        print("[PIPELINE] Running 12_ingest_buildings.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "12_ingest_buildings.py")], check=True)
    elif target == "roads":
        print("[PIPELINE] Running 13_prepare_roads.py...")
        subprocess.run([PYTHON, str(ROOT / "pipeline" / "scripts" / "13_prepare_roads.py")], check=True)
    else:
        print(f"Unknown target '{target}'. Available targets: data, test, eval, buildings, roads")
        sys.exit(1)


if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "data"
    run_target(t)
