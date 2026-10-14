"""
pipeline/tests/conftest.py
Synthetic 1km x 1km test fixtures for offline pipeline verification.
No real-world observations or network calls.
"""

import tempfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, LineString, Polygon

WGS84 = "EPSG:4326"
UTM43N = "EPSG:32643"


@pytest.fixture(scope="session")
def synthetic_workspace(tmp_path_factory):
    """Creates a temporary synthetic workspace with a 1km square boundary, synthetic DEM pit, built-up raster, and roads."""
    ws = tmp_path_factory.mktemp("synthetic_geo")

    # 1. Predictable 1km x 1km Boundary in UTM 43N (4x4 = 16 cells of 250m)
    # Origin: (670000, 3500000) to (671000, 3501000)
    boundary_poly = box(670000.0, 3500000.0, 671000.0, 3501000.0)
    boundary_gdf = gpd.GeoDataFrame(
        {"name": ["Synthetic 1km Test Boundary"], "geometry": [boundary_poly]},
        crs=UTM43N,
    )
    boundary_wgs = boundary_gdf.to_crs(WGS84)
    boundary_file = ws / "city_boundary.geojson"
    boundary_wgs.to_file(boundary_file, driver="GeoJSON")

    # 2. Synthetic DEM (30m cells covering boundary + buffer)
    # Surroundings: 250.0m. Known Pit at center: 235.0m (-15m depression).
    dem_file = ws / "dem.tif"
    dem_wgs_bounds = boundary_wgs.total_bounds
    minx, miny, maxx, maxy = dem_wgs_bounds
    buf_deg = 0.003
    res_deg = 0.000277778  # ~30m
    width = int(np.ceil((maxx - minx + 2 * buf_deg) / res_deg))
    height = int(np.ceil((maxy - miny + 2 * buf_deg) / res_deg))
    transform = from_origin(minx - buf_deg, maxy + buf_deg, res_deg, res_deg)

    dem_array = np.full((height, width), 250.0, dtype=np.float32)
    # Known depression pit at center pixels
    cr, cc = height // 2, width // 2
    dem_array[cr - 4 : cr + 5, cc - 4 : cc + 5] = 235.0

    with rasterio.open(
        dem_file,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=np.float32,
        crs=WGS84,
        transform=transform,
    ) as dst:
        dst.write(dem_array, 1)

    # 3. Synthetic WorldCover (10m cells)
    # Background: 40 (Cropland). Known built-up block: 50 (Built-up) at top-left
    wc_file = ws / "worldcover.tif"
    wc_res_deg = res_deg / 3.0  # ~10m
    wc_width = width * 3
    wc_height = height * 3
    wc_transform = from_origin(minx - buf_deg, maxy + buf_deg, wc_res_deg, wc_res_deg)

    wc_array = np.full((wc_height, wc_width), 40, dtype=np.uint8)
    # Set top-left quadrant to 50 (Built-up)
    wc_array[10:40, 10:40] = 50

    with rasterio.open(
        wc_file,
        "w",
        driver="GTiff",
        height=wc_height,
        width=wc_width,
        count=1,
        dtype=np.uint8,
        crs=WGS84,
        transform=wc_transform,
    ) as dst:
        dst.write(wc_array, 1)

    # 4. Synthetic GeoPackage: Roads, Buildings, Waterways
    gpkg_file = ws / "osm_features.gpkg"

    # Road 1: Controlled Underpass road (tunnel=yes, layer=-1)
    # Road 2: Standard road named "Grand Trunk Road"
    road1 = LineString([(670100, 3500900), (670200, 3500900)])  # in top-left cell
    road2 = LineString([(670500, 3500100), (670900, 3500100)])  # across bottom cells

    roads_gdf = gpd.GeoDataFrame(
        {
            "name": [None, "Grand Trunk Road"],
            "highway": ["primary", "secondary"],
            "bridge": [None, None],
            "tunnel": ["yes", None],
            "layer": ["-1", "0"],
            "geometry": [road1, road2],
        },
        crs=UTM43N,
    ).to_crs(WGS84)
    roads_gdf.to_file(gpkg_file, layer="roads", driver="GPKG")

    # Building in top-left cell (50m x 50m = 2500 m2)
    bldg_geom = Polygon([
        (670050, 3500850), (670100, 3500850), (670100, 3500900), (670050, 3500900), (670050, 3500850)
    ])
    bldgs_gdf = gpd.GeoDataFrame(
        {"building": ["commercial"], "name": ["Synthetic Mall"], "geometry": [bldg_geom]},
        crs=UTM43N,
    ).to_crs(WGS84)
    bldgs_gdf.to_file(gpkg_file, layer="buildings", driver="GPKG")

    # Waterway line
    water_line = LineString([(670800, 3500500), (670800, 3500900)])
    waterways_gdf = gpd.GeoDataFrame(
        {"waterway": ["drain"], "name": ["Synthetic Drain"], "geometry": [water_line]},
        crs=UTM43N,
    ).to_crs(WGS84)
    waterways_gdf.to_file(gpkg_file, layer="waterways", driver="GPKG")

    return {
        "dir": ws,
        "boundary": boundary_file,
        "dem": dem_file,
        "worldcover": wc_file,
        "gpkg": gpkg_file,
    }
