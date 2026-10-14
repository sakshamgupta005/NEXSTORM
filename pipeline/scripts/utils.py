"""
pipeline/scripts/utils.py
Common helper utilities for NEXSTORM geospatial pipeline.
"""

import hashlib
import os
import sys
from pathlib import Path

WGS84 = "EPSG:4326"
UTM43N = "EPSG:32643"  # Standard UTM zone for Punjab/Amritsar


def compute_sha256(filepath: str | Path) -> str:
    """Computes SHA-256 hex digest of a local file in chunks."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def exit_with_error(message: str, code: int = 1):
    """Prints a clear actionable error message and exits cleanly without unhandled stack traces."""
    print(f"\n[PIPELINE ERROR] {message}", file=sys.stderr)
    sys.exit(code)


def get_repo_root() -> Path:
    """Returns absolute Path to the repository root."""
    return Path(__file__).resolve().parent.parent.parent


def compute_config_hash(config_dict: dict) -> str:
    """Computes SHA-256 over canonical JSON with sorted keys for exactly the frozen configuration subset."""
    import json
    keys = ["weights", "sBandCutoffs", "rtiBandCutoffs", "matrix", "thresholds", "displayThreshold"]
    frozen_subset = {k: config_dict[k] for k in keys if k in config_dict}
    canonical_bytes = json.dumps(frozen_subset, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def verify_frozen_config(config_path: str | Path) -> bool:
    """Verifies that the configuration file's configHash matches the recomputed canonical hash.
    Downstream scripts refuse to run if tampering or unauthorized change is detected."""
    import json
    path = Path(config_path)
    if not path.exists():
        exit_with_error(f"Frozen configuration file does not exist: {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "configHash" not in data:
        exit_with_error(f"Configuration file {path} missing required 'configHash' attribute.")
    expected_hash = data["configHash"]
    computed_hash = compute_config_hash(data)
    if computed_hash != expected_hash:
        exit_with_error(
            f"FROZEN CONFIGURATION TAMPER DETECTED in {path}!\n"
            f"Recorded configHash: {expected_hash}\n"
            f"Recomputed hash:    {computed_hash}\n"
            f"Execution halted to protect frozen baseline."
        )
    return True

