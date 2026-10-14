"""
pipeline/scripts/01_build_grid.py
Generates deterministic metric analysis grids:
1. Amritsar City Grid: 250m square cells clipped to municipal boundary (stable IDs: A-0001, A-0002, ...)
2. GNDU Campus Sub-Grid: 50m square cells clipped to campus polygon (stable IDs: G-0001, G-0002, ...)

Exports deliverables to:
- public/data/cities/amritsar/grid.geojson
- public/data/cities/amritsar/campus.geojson (when usable campus exists)
- pipeline/cache/grid.geojson
- pipeline/cache/campus.geojson
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely.geometry import Polygon, box

from utils import WGS84, UTM43N, exit_with_error, get_repo_root

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
PUBLIC_DIR = ROOT / "public" / "data" / "cities" / "amritsar"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def generate_grid_for_polygon(
    poly_gdf: gpd.GeoDataFrame,
    cell_size_m: float,
    id_prefix: str,
    target_crs: str = UTM43N,
) -> gpd.GeoDataFrame:
    """
    Generates a regular metric grid of square cells over the polygon.
    Rule: Cells whose centroid falls inside the boundary polygon are retained.
    Cells are sorted deterministically top-to-bottom (descending Y), left-to-right (ascending X)
    and assigned stable consecutive IDs: {prefix}-0001, {prefix}-0002, etc.
    """
    gdf_utm = poly_gdf.to_crs(target_crs)
    boundary_geom = gdf_utm.unary_union

    minx, miny, maxx, maxy = boundary_geom.bounds

    # Align origin to nearest cell_size_m
    x_start = np.floor(minx / cell_size_m) * cell_size_m
    y_start = np.floor(miny / cell_size_m) * cell_size_m

    x_coords = np.arange(x_start, maxx + cell_size_m, cell_size_m)
    y_coords = np.arange(y_start, maxy + cell_size_m, cell_size_m)

    cells = []
    centroids_x = []
    centroids_y = []

    # Iterate rows descending (North to South), columns ascending (West to East)
    for y in reversed(y_coords[:-1]):
        for x in x_coords[:-1]:
            cell_poly = box(x, y, x + cell_size_m, y + cell_size_m)
            centroid = cell_poly.centroid
            if boundary_geom.contains(centroid):
                cells.append(cell_poly)
                centroids_x.append(centroid.x)
                centroids_y.append(centroid.y)

    grid_gdf = gpd.GeoDataFrame(
        {
            "cell_id": [f"{id_prefix}-{i + 1:04d}" for i in range(len(cells))],
            "centroid_x": centroids_x,
            "centroid_y": centroids_y,
            "area_m2": [cell_size_m * cell_size_m] * len(cells),
            "geometry": cells,
        },
        crs=target_crs,
    )

    return grid_gdf


def main():
    print("=" * 60)
    print(" NEXSTORM 01_build_grid: Metric Analysis Grid Generation")
    print("=" * 60)

    city_boundary_path = CACHE_DIR / "city_boundary.geojson"
    if not city_boundary_path.exists():
        exit_with_error(f"Missing {city_boundary_path}. Run 00_fetch_static.py first.")

    city_gdf = gpd.read_file(city_boundary_path)
    city_area_km2 = city_gdf.to_crs(UTM43N).geometry.area.iloc[0] / 1e6
    print(f"[CITY BOUNDARY] Boundary loaded: {city_area_km2:.2f} sq km (UTM Zone 43N)")

    # 1. Build Amritsar City Grid (250m)
    print("[GRID] Generating 250m square city grid cells...")
    city_grid = generate_grid_for_polygon(city_gdf, cell_size_m=250.0, id_prefix="A")
    city_grid_wgs = city_grid.to_crs(WGS84)

    print(f"[GRID SUCCESS] Generated {len(city_grid)} cells for Amritsar (Cell IDs: A-0001 .. A-{len(city_grid):04d})")

    # Export to public/data and cache
    city_grid_out = PUBLIC_DIR / "grid.geojson"
    city_grid_cache = CACHE_DIR / "grid.geojson"
    city_grid_wgs.to_file(city_grid_out, driver="GeoJSON")
    city_grid_wgs.to_file(city_grid_cache, driver="GeoJSON")
    print(f"[EXPORT] City grid exported to {city_grid_out} ({city_grid_out.stat().st_size / 1024:.1f} KB)")

    # 2. Build GNDU Campus Sub-Grid (50m) if campus polygon exists
    campus_path = CACHE_DIR / "gndu_campus.geojson"
    if campus_path.exists():
        campus_gdf = gpd.read_file(campus_path)
        campus_area_km2 = campus_gdf.to_crs(UTM43N).geometry.area.iloc[0] / 1e6
        print(f"\n[CAMPUS BOUNDARY] Campus loaded: {campus_area_km2:.2f} sq km")
        print("[CAMPUS GRID] Generating 50m square sub-grid cells...")

        campus_grid = generate_grid_for_polygon(campus_gdf, cell_size_m=50.0, id_prefix="G")
        campus_grid_wgs = campus_grid.to_crs(WGS84)
        print(f"[CAMPUS GRID SUCCESS] Generated {len(campus_grid)} cells for GNDU (Cell IDs: G-0001 .. G-{len(campus_grid):04d})")

        campus_grid_out = PUBLIC_DIR / "campus.geojson"
        campus_grid_cache = CACHE_DIR / "campus.geojson"
        campus_grid_wgs.to_file(campus_grid_out, driver="GeoJSON")
        campus_grid_wgs.to_file(campus_grid_cache, driver="GeoJSON")
        print(f"[EXPORT] Campus grid exported to {campus_grid_out} ({campus_grid_out.stat().st_size / 1024:.1f} KB)")
    else:
        print("\n[CAMPUS NOTICE] No usable campus boundary found. Skipping campus.geojson.")

    print("\n[COMPLETE] 01_build_grid completed successfully.")


if __name__ == "__main__":
    main()
