"""
pipeline/tests/test_p25_physical_ingestion.py
Pytest suite for NEXSTORM P25:
- Physical raster ingestion and integrity (Copernicus DEM & ESA WorldCover).
- Physical feature extraction without coordinate proxy artifacts.
- Non-compressed susceptibility distribution.
- Jalandhar historical incident deduplication & spatial matching.
- Evaluation workflow with withheld negative metrics.
"""

import json
from pathlib import Path
import pytest
import geopandas as gpd
import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parent.parent.parent
JAL_DIR = ROOT / "public" / "data" / "cities" / "jalandhar"
CACHE_DIR = ROOT / "pipeline" / "cache" / "jalandhar"


def test_copernicus_dem_raster_integrity():
    """Verifies Copernicus DEM GLO-30 raster properties."""
    dem_path = JAL_DIR / "rasters" / "dem.tif"
    assert dem_path.exists(), "dem.tif must exist in public rasters directory"

    with rasterio.open(dem_path) as src:
        assert src.width == 648
        assert src.height == 504
        assert str(src.crs) == "EPSG:4326"
        data = src.read(1)
        valid = data[data != src.nodata] if src.nodata is not None else data
        assert np.nanmin(valid) >= 220.0
        assert np.nanmax(valid) <= 265.0
        assert np.nanmean(valid) > 230.0


def test_esa_worldcover_raster_integrity():
    """Verifies ESA WorldCover 2021 10m raster properties."""
    wc_path = JAL_DIR / "rasters" / "worldcover.tif"
    assert wc_path.exists(), "worldcover.tif must exist in public rasters directory"

    with rasterio.open(wc_path) as src:
        assert src.width == 2160
        assert src.height == 1680
        assert str(src.crs) == "EPSG:4326"
        data = src.read(1)
        classes = np.unique(data)
        assert 50 in classes, "Class 50 (Built-up) must be present"
        builtup_pct = np.mean(data == 50) * 100.0
        assert 25.0 <= builtup_pct <= 45.0


def test_osm_vector_layers():
    """Verifies OpenStreetMap vector layers in GeoPackage."""
    gpkg_path = CACHE_DIR / "osm_features.gpkg"
    assert gpkg_path.exists(), "osm_features.gpkg must exist in cache"

    roads_gdf = gpd.read_file(gpkg_path, layer="roads")
    assert len(roads_gdf) > 15000, "Should contain over 15k road segments"
    assert "geometry" in roads_gdf.columns


def test_physical_features_and_susceptibility():
    """Verifies physically derived susceptibility scores and component distributions."""
    susc_path = JAL_DIR / "susceptibility.geojson"
    assert susc_path.exists()

    gdf = gpd.read_file(susc_path)
    assert len(gdf) == 2354

    s = gdf["s"]
    assert s.min() >= 0.0
    assert s.max() <= 1.0
    assert s.std() >= 0.12, "Susceptibility std must have natural variance, not compressed"

    # Verify absence of coordinate proxy artifacts
    f_flatness = gdf["f_flatness"]
    assert f_flatness.mean() <= 0.85, "Flatness must not be compressed near 0.90"

    f_lowpoint = gdf["f_lowPoint"]
    assert f_lowpoint.mean() <= 0.30, "Low points must represent a hydrological minority"


def test_incident_inventory_and_storm_deduplication():
    """Verifies authentic incident records and deduplication into 5 storms."""
    inv_path = JAL_DIR / "incidents_inventory.json"
    assert inv_path.exists()

    with open(inv_path, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    assert len(incidents) == 10
    included = [i for i in incidents if i.get("inclusionDecision") == "included"]
    excluded = [i for i in incidents if i.get("inclusionDecision") == "excluded_with_reason"]

    assert len(included) == 9
    assert len(excluded) == 1
    assert excluded[0]["category"] == "industrial_effluent_overflow"

    # Deduplicated storm clusters
    storms = set(i["stormEventId"] for i in included)
    assert len(storms) == 5

    # Verification status honesty
    assert all(i["verificationStatus"] == "source_reported" for i in included)


def test_evaluation_workflow_results():
    """Verifies reproducible evaluation metrics and negative space withholding."""
    eval_path = JAL_DIR / "evaluation_results.json"
    assert eval_path.exists()

    with open(eval_path, "r", encoding="utf-8") as f:
        results = json.load(f)

    assert results["cityId"] == "jalandhar"
    assert results["sampleSize"]["independentStormEvents"] == 5
    assert results["incidentLevelMetrics"]["podAtMidThreshold"] == 1.0
    assert results["stormLevelMetrics"]["stormLevelDetectionRate"] == 1.0

    # Negative space withholding
    neg = results["negativeSpaceAudit"]
    assert "WITHHELD" in neg["falseAlarmRate"]
    assert "WITHHELD" in neg["specificity"]
    assert "WITHHELD" in neg["rocAuc"]
