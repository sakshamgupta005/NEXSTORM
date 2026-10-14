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
