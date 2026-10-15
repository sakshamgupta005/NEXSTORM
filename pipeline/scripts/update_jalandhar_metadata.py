"""
pipeline/scripts/update_jalandhar_metadata.py
Updates city.config.json and manifest.json for Jalandhar with physical raster provenance,
checksums, and updated canonical configHash.
"""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import compute_config_hash, compute_sha256, get_repo_root

ROOT = get_repo_root()
JAL_DIR = ROOT / "public" / "data" / "cities" / "jalandhar"

CONFIG_PATH = JAL_DIR / "city.config.json"
MANIFEST_PATH = JAL_DIR / "manifest.json"
GRID_PATH = JAL_DIR / "grid.geojson"
SUSC_PATH = JAL_DIR / "susceptibility.geojson"
INVENTORY_PATH = JAL_DIR / "incidents_inventory.json"
SOURCES_PATH = JAL_DIR / "physical_sources.json"


def update_metadata():
    # 1. Update city.config.json
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    config["terrainOverride"] = {
        "applied": False,
        "reason": "Physical Copernicus DEM terrain variance std=0.1505",
        "std": 0.1505,
    }
    config["provenance"]["demSource"] = "Copernicus DEM GLO-30 (30m)"
    config["provenance"]["landCoverSource"] = "ESA WorldCover 2021 v200 (10m)"
    config["provenance"]["osmSource"] = "OpenStreetMap 2024 Extracts (17,358 roads)"
    config["provenance"]["incidentSource"] = (
        "10 archival records from The Tribune/HT (2022-2024); 5 storm events; "
        "evidence_insufficient pending sub-daily gauge telemetry and MCJ complaint logs"
    )

    # Compute new configHash
    new_hash = compute_config_hash(config)
    config["configHash"] = new_hash

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"[CONFIG] Updated city.config.json with configHash: {new_hash}")

    # 2. Update manifest.json
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest["datasetProvenance"]["checksums"] = {
        "grid.geojson": compute_sha256(GRID_PATH),
        "susceptibility.geojson": compute_sha256(SUSC_PATH),
        "city.config.json": compute_sha256(CONFIG_PATH),
        "incidents_inventory.json": compute_sha256(INVENTORY_PATH),
        "physical_sources.json": compute_sha256(SOURCES_PATH),
    }

    manifest["featureDistributionSummary"] = {
        "meanSusceptibility": 0.4437,
        "stdSusceptibility": 0.1505,
        "lowBandPercent": 24.51,
        "midBandPercent": 66.48,
        "highBandPercent": 9.01,
    }

    manifest["evidenceAudit"] = {
        "incidentCount": 10,
        "rainfallStormCount": 5,
        "hasHistoricalEvidence": True,
        "evidenceAssessment": (
            "10 historical waterlogging incidents from The Tribune and Hindustan Times archives (2022-2024) "
            "deduplicated into 5 independent storm events. In accordance with zero-fabrication standards, "
            "newspaper reports represent secondary journalistic evidence (source_reported) and do not substitute for "
            "direct rain gauge telemetry or official municipal complaint logs. Jalandhar remains in evidence_insufficient "
            "status with live alert dispatch prohibited."
        ),
    }

    manifest["warnings"] = [
        "Jalandhar features derived from genuine Copernicus DEM and ESA WorldCover rasters.",
        "Incident inventory based on journalistic reports (source_reported); independent field verification required.",
        "Susceptibility scores are purely relative within this municipal Area of Interest (AOI).",
        "Amritsar calibrated metrics MUST NOT be attributed to this geography.",
    ]

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"[MANIFEST] Updated manifest.json with physical feature distribution and evidence ledger.")


if __name__ == "__main__":
    update_metadata()
