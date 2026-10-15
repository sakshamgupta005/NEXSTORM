"""
pipeline/tests/test_incident_inventory.py
Unit tests verifying the integrity and deduplication of incidents_inventory.json.
"""

import importlib.util
from pathlib import Path


def test_incident_inventory_validation():
    repo_root = Path(__file__).resolve().parent.parent.parent
    script_path = repo_root / "pipeline" / "scripts" / "15_validate_incidents.py"

    spec = importlib.util.spec_from_file_location("validate_incidents_mod", str(script_path))
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.validate_incident_inventory(repo_root) is True
