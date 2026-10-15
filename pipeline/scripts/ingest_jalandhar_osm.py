"""
pipeline/scripts/ingest_jalandhar_osm.py
Fetches OSM features for Jalandhar AOI and writes to pipeline/cache/jalandhar/osm_features.gpkg.
Supports local-file fallback if Overpass is experiencing downtime.
"""

import time
from pathlib import Path
import geopandas as gpd
from shapely.geometry import box, LineString

import osmnx as ox

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = ROOT / "pipeline" / "cache" / "jalandhar"
INPUTS_DIR = ROOT / "pipeline" / "inputs" / "jalandhar"
INPUTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

gpkg_out = CACHE_DIR / "osm_features.gpkg"
local_override = INPUTS_DIR / "osm_features.gpkg"

WGS84 = "EPSG:4326"
# AOI: [75.52, 31.28, 75.66, 31.38]
aoi_poly = box(75.52, 31.28, 75.66, 31.38)

def ingest():
    if local_override.exists():
        print(f"[OSM] Using local override: {local_override}")
        import shutil
        shutil.copy2(local_override, gpkg_out)
        return

    # Check if we already have valid roads in gpkg_out
    if gpkg_out.exists():
        try:
            r = gpd.read_file(gpkg_out, layer="roads")
            if len(r) > 100:
                print(f"[OSM] Existing GPKG has {len(r)} roads. Keeping.")
                return
        except Exception:
            pass

    print("[OSM] Querying OpenStreetMap roads for Jalandhar AOI...")
    roads_gdf = None
    # Try with retries
    for attempt in range(1, 4):
        try:
            print(f"  Attempt {attempt} querying highway=True...")
            roads = ox.features_from_polygon(aoi_poly, tags={"highway": True})
            roads = roads[roads.geometry.type.isin(["LineString", "MultiLineString"])].copy()
            road_cols = [c for c in ["name", "highway", "bridge", "tunnel", "layer", "geometry"] if c in roads.columns]
            roads_gdf = roads[road_cols].to_crs(WGS84)
            print(f"  Successfully fetched {len(roads_gdf)} road segments!")
            break
        except Exception as e:
            print(f"  Attempt {attempt} failed: {e}")
            time.sleep(3)

    if roads_gdf is not None and len(roads_gdf) > 0:
        roads_gdf.to_file(gpkg_out, layer="roads", driver="GPKG")
        print(f"[SUCCESS] Saved {len(roads_gdf)} roads to {gpkg_out}")
    else:
        print("[NOTICE] Overpass is currently unresponsive or rate-limited.")
        print(f"[LOCAL PATH] Please provide {local_override} or pipeline/inputs/osm_features.gpkg")

if __name__ == "__main__":
    ingest()
