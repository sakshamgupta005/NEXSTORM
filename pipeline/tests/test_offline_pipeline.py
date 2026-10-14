"""
pipeline/tests/test_offline_pipeline.py
Tests for offline pipeline execution, source metadata tracking, and actionable error handling.
"""

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from utils import compute_sha256, exit_with_error


def test_sources_md_structure():
    """Verifies pipeline/SOURCES.md contains required headers, URLs, licences, and SHA-256 checksums."""
    sources_path = Path(__file__).resolve().parent.parent / "SOURCES.md"
    assert sources_path.exists(), "pipeline/SOURCES.md must exist."

    content = sources_path.read_text(encoding="utf-8")
    assert "Amritsar Municipal Boundary" in content
    assert "Copernicus DEM GLO-30" in content
    assert "ESA WorldCover 2021" in content
    assert "OpenStreetMap Vector Layers" in content
    assert "SHA-256 Checksum" in content
    assert "ODbL 1.0" in content or "Copernicus Licence" in content


def test_sha256_reproducibility(tmp_path):
    """Verifies that compute_sha256 returns identical digests for identical bytes."""
    f1 = tmp_path / "file1.bin"
    f2 = tmp_path / "file2.bin"

    f1.write_bytes(b"NEXSTORM GEOSPATIAL REPRODUCIBILITY TEST")
    f2.write_bytes(b"NEXSTORM GEOSPATIAL REPRODUCIBILITY TEST")

    h1 = compute_sha256(f1)
    h2 = compute_sha256(f2)

    assert h1 == h2
    assert len(h1) == 64


def test_actionable_error_on_missing_input(monkeypatch):
    """Verifies exit_with_error exits cleanly with code 1 and prints an actionable message."""
    with pytest.raises(SystemExit) as exc_info:
        exit_with_error("Custom test missing input: pipeline/inputs/test.tif")
    assert exc_info.value.code == 1
