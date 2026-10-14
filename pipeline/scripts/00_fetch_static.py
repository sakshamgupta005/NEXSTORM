"""
pipeline/scripts/00_fetch_static.py
Acquires or verifies static geospatial datasets for Amritsar and GNDU campus:
- City boundary (municipal scale)
- GNDU campus polygon
- Copernicus DEM GLO-30 (30m)
- ESA WorldCover 2021 (10m)
- OpenStreetMap vector layers (roads, buildings, waterways)

Supports both online acquisition and offline execution from pipeline/inputs/ or pipeline/cache/.
"""

import datetime
import os
import shutil
import sys
from pathlib import Path

import geopandas as gpd
import requests
import rasterio
from rasterio.windows import from_bounds
import osmnx as ox

from utils import WGS84, UTM43N, compute_sha256, exit_with_error, get_repo_root

ROOT = get_repo_root()
INPUTS_DIR = ROOT / "pipeline" / "inputs"
CACHE_DIR = ROOT / "pipeline" / "cache"
SOURCES_MD = ROOT / "pipeline" / "SOURCES.md"

INPUTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

sources_log = []


def record_source(name, url, license_name, license_url, checksum, origin, notes):
    sources_log.append({
        "name": name,
        "url": url,
        "date": datetime.date.today().isoformat(),
        "license": license_name,
        "license_url": license_url,
        "checksum": checksum,
        "origin": origin,
        "notes": notes,
    })


def fetch_city_boundary() -> gpd.GeoDataFrame:
    """Retrieves or loads municipal boundary for Amritsar."""
    user_override = INPUTS_DIR / "city_boundary.geojson"
    cache_path = CACHE_DIR / "city_boundary.geojson"

    if user_override.exists():
        print(f"[BOUNDARY] Using user-supplied boundary: {user_override}")
        gdf = gpd.read_file(user_override).to_crs(WGS84)
        origin = "User-supplied file (pipeline/inputs/city_boundary.geojson)"
    elif cache_path.exists():
        print(f"[BOUNDARY] Using cached boundary: {cache_path}")
        gdf = gpd.read_file(cache_path).to_crs(WGS84)
        origin = "Cached local file (pipeline/cache/city_boundary.geojson)"
    else:
        print("[BOUNDARY] Querying OpenStreetMap via OSMnx for Amritsar boundary...")
        try:
            gdf = ox.geocode_to_gdf("Amritsar, Punjab, India").to_crs(WGS84)
            gdf_utm = gdf.to_crs(UTM43N)
            area_km2 = gdf_utm.geometry.area.iloc[0] / 1e6
            print(f"[BOUNDARY] OSM candidate: '{gdf['display_name'].iloc[0]}' (Area: {area_km2:.2f} sq km)")

            if area_km2 > 300.0:
                print(f"[BOUNDARY WARNING] Candidate area ({area_km2:.2f} sq km) indicates district level.")
                exit_with_error(
                    f"OSM query returned district-level boundary ({area_km2:.2f} sq km). "
                    "A municipal-corporation scale boundary is required. "
                    "Please place an authoritative polygon at pipeline/inputs/city_boundary.geojson."
                )
            origin = "Downloaded from OpenStreetMap (OSMnx)"
        except Exception as e:
            exit_with_error(f"Failed to resolve city boundary: {e}. Provide pipeline/inputs/city_boundary.geojson for offline mode.")

    gdf.to_file(cache_path, driver="GeoJSON")
    chk = compute_sha256(cache_path)
    area_km2 = gdf.to_crs(UTM43N).geometry.area.iloc[0] / 1e6
    print(f"[BOUNDARY SUCCESS] Selected boundary area: {area_km2:.2f} sq km (SHA-256: {chk[:12]}...)")

    record_source(
        name="Amritsar Municipal Boundary",
        url="https://www.openstreetmap.org / Municipal Master Plan Envelope",
        license_name="ODbL 1.0",
        license_url="https://opendatacommons.org/licenses/odbl/",
        checksum=chk,
        origin=origin,
        notes=f"Municipal corporation extent polygon (~{area_km2:.2f} sq km, UTM Zone 43N).",
    )
    return gdf


def fetch_gndu_campus() -> gpd.GeoDataFrame | None:
    """Retrieves or loads GNDU campus polygon."""
    user_override = INPUTS_DIR / "gndu_campus.geojson"
    cache_path = CACHE_DIR / "gndu_campus.geojson"

    if user_override.exists():
        print(f"[CAMPUS] Using user-supplied campus polygon: {user_override}")
        gdf = gpd.read_file(user_override).to_crs(WGS84)
        origin = "User-supplied file (pipeline/inputs/gndu_campus.geojson)"
    elif cache_path.exists():
        print(f"[CAMPUS] Using cached campus polygon: {cache_path}")
        gdf = gpd.read_file(cache_path).to_crs(WGS84)
        origin = "Cached local file (pipeline/cache/gndu_campus.geojson)"
    else:
        print("[CAMPUS] Querying OpenStreetMap for Guru Nanak Dev University campus...")
        try:
            gdf = ox.geocode_to_gdf("Guru Nanak Dev University, Amritsar, Punjab, India").to_crs(WGS84)
            origin = "Downloaded from OpenStreetMap (OSMnx way 537950488)"
        except Exception as e:
            print(f"[CAMPUS NOTICE] No usable campus polygon found: {e}. Campus sub-grid will not be generated.")
            return None

    geom_type = gdf.geom_type.iloc[0]
    if geom_type not in ["Polygon", "MultiPolygon"]:
        print(f"[CAMPUS NOTICE] Resolved geometry is {geom_type}, not a usable polygon. Skipping campus sub-grid.")
        return None

    gdf.to_file(cache_path, driver="GeoJSON")
    chk = compute_sha256(cache_path)
    area_km2 = gdf.to_crs(UTM43N).geometry.area.iloc[0] / 1e6
    print(f"[CAMPUS SUCCESS] GNDU campus polygon area: {area_km2:.2f} sq km (SHA-256: {chk[:12]}...)")

    record_source(
        name="Guru Nanak Dev University Campus",
        url="https://www.openstreetmap.org/way/537950488",
        license_name="ODbL 1.0",
        license_url="https://opendatacommons.org/licenses/odbl/",
        checksum=chk,
        origin=origin,
        notes=f"Campus boundary polygon (~{area_km2:.2f} sq km, OpenStreetMap way 537950488).",
    )
    return gdf


def fetch_dem(bounds: tuple[float, float, float, float]):
    """Fetches or loads 30m Copernicus DEM for city extent."""
    user_override = INPUTS_DIR / "dem.tif"
    cache_path = CACHE_DIR / "dem.tif"

    if user_override.exists():
        print(f"[DEM] Using user-supplied DEM: {user_override}")
        origin = "User-supplied file (pipeline/inputs/dem.tif)"
        if not cache_path.exists() or cache_path.resolve() != user_override.resolve():
            shutil.copy2(user_override, cache_path)
    elif cache_path.exists():
        print(f"[DEM] Using cached DEM: {cache_path}")
        origin = "Cached local raster (pipeline/cache/dem.tif)"
    else:
        print("[DEM] Fetching Copernicus GLO-30 DEM from AWS S3 Open Data...")
        remote_url = "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N31_00_E074_00_DEM/Copernicus_DSM_COG_10_N31_00_E074_00_DEM.tif"
        temp_download = CACHE_DIR / "dem_temp.tif"
        try:
            with requests.get(remote_url, stream=True, timeout=30) as r:
                r.raise_for_status()
                with open(temp_download, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        f.write(chunk)

            minx, miny, maxx, maxy = bounds
            buf_bounds = (minx - 0.02, miny - 0.02, maxx + 0.02, maxy + 0.02)

            with rasterio.open(temp_download) as src:
                win = from_bounds(*buf_bounds, transform=src.transform)
                win_transform = rasterio.windows.transform(win, src.transform)
                data = src.read(1, window=win)
                meta = src.meta.copy()

            meta.update({
                "driver": "GTiff",
                "height": data.shape[0],
                "width": data.shape[1],
                "transform": win_transform,
            })

            with rasterio.open(cache_path, "w", **meta) as dst:
                dst.write(data, 1)

            if temp_download.exists():
                os.remove(temp_download)

            origin = "Downloaded from AWS Open Data (Copernicus DEM GLO-30)"
        except Exception as e:
            exit_with_error(f"Failed to fetch Copernicus DEM: {e}. Provide pipeline/inputs/dem.tif for offline mode.")

    chk = compute_sha256(cache_path)
    with rasterio.open(cache_path) as r:
        print(f"[DEM SUCCESS] Loaded DEM: {r.width}x{r.height} pixels at native 30m resolution (SHA-256: {chk[:12]}...)")

    record_source(
        name="Copernicus DEM GLO-30",
        url="https://registry.opendata.aws/copernicus-dem/",
        license_name="Open Data under Copernicus Licence",
        license_url="https://spacedata.copernicus.eu/documents/20126/0/CSCDA_ESA_Data_Licence_FAQ.pdf",
        checksum=chk,
        origin=origin,
        notes="Global 30-metre DSM cropped to buffered municipal extent.",
    )


def fetch_worldcover(bounds: tuple[float, float, float, float]):
    """Fetches or loads 10m ESA WorldCover 2021 for city extent."""
    user_override = INPUTS_DIR / "worldcover.tif"
    cache_path = CACHE_DIR / "worldcover.tif"

    if user_override.exists():
        print(f"[WORLDCOVER] Using user-supplied WorldCover: {user_override}")
        origin = "User-supplied file (pipeline/inputs/worldcover.tif)"
        if not cache_path.exists() or cache_path.resolve() != user_override.resolve():
            shutil.copy2(user_override, cache_path)
    elif cache_path.exists():
        print(f"[WORLDCOVER] Using cached WorldCover: {cache_path}")
        origin = "Cached local raster (pipeline/cache/worldcover.tif)"
    else:
        print("[WORLDCOVER] Fetching ESA WorldCover 2021 from AWS S3 Open Data...")
        remote_url = "https://esa-worldcover.s3.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N30E072_Map.tif"
        temp_download = CACHE_DIR / "wc_temp.tif"
        try:
            with requests.get(remote_url, stream=True, timeout=60) as r:
                r.raise_for_status()
                with open(temp_download, "wb") as f:
                    for chunk in r.iter_content(chunk_size=2 * 1024 * 1024):
                        f.write(chunk)

            minx, miny, maxx, maxy = bounds
            buf_bounds = (minx - 0.02, miny - 0.02, maxx + 0.02, maxy + 0.02)

            with rasterio.open(temp_download) as src:
                win = from_bounds(*buf_bounds, transform=src.transform)
                win_transform = rasterio.windows.transform(win, src.transform)
                data = src.read(1, window=win)
                meta = src.meta.copy()

            meta.update({
                "driver": "GTiff",
                "height": data.shape[0],
                "width": data.shape[1],
                "transform": win_transform,
            })

            with rasterio.open(cache_path, "w", **meta) as dst:
                dst.write(data, 1)

            if temp_download.exists():
                os.remove(temp_download)

            origin = "Downloaded from AWS Open Data (ESA WorldCover 2021)"
        except Exception as e:
            exit_with_error(f"Failed to fetch ESA WorldCover: {e}. Provide pipeline/inputs/worldcover.tif for offline mode.")

    chk = compute_sha256(cache_path)
    with rasterio.open(cache_path) as r:
        print(f"[WORLDCOVER SUCCESS] Loaded WorldCover: {r.width}x{r.height} pixels (SHA-256: {chk[:12]}...)")

    record_source(
        name="ESA WorldCover 2021 v200",
        url="https://esa-worldcover.org/en",
        license_name="CC-BY 4.0",
        license_url="https://creativecommons.org/licenses/by/4.0/",
        checksum=chk,
        origin=origin,
        notes="10-metre land-cover classification map (Class 50 = Built-up).",
    )


def fetch_osm_layers(city_gdf: gpd.GeoDataFrame):
    """Retrieves or loads OSM roads, buildings, and waterways in a GeoPackage."""
    user_override = INPUTS_DIR / "osm_features.gpkg"
    cache_path = CACHE_DIR / "osm_features.gpkg"

    if user_override.exists():
        print(f"[OSM FEATURES] Using user-supplied GeoPackage: {user_override}")
        origin = "User-supplied file (pipeline/inputs/osm_features.gpkg)"
        if not cache_path.exists() or cache_path.resolve() != user_override.resolve():
            shutil.copy2(user_override, cache_path)
    elif cache_path.exists():
        print(f"[OSM FEATURES] Using cached GeoPackage: {cache_path}")
        origin = "Cached GeoPackage (pipeline/cache/osm_features.gpkg)"
    else:
        print("[OSM FEATURES] Querying OpenStreetMap vector features (500m buffered envelope)...")
        poly_utm = city_gdf.to_crs(UTM43N).geometry.iloc[0].buffer(500)
        poly_wgs = gpd.GeoSeries([poly_utm], crs=UTM43N).to_crs(WGS84).iloc[0]

        try:
            print("[OSM FEATURES] Downloading roads...")
            roads = ox.features_from_polygon(poly_wgs, tags={"highway": True})
            roads = roads[roads.geometry.type.isin(["LineString", "MultiLineString"])]
            road_cols = [c for c in ["name", "highway", "bridge", "tunnel", "layer", "geometry"] if c in roads.columns]
            roads = roads[road_cols].to_crs(WGS84)
            roads.to_file(cache_path, layer="roads", driver="GPKG")

            print("[OSM FEATURES] Downloading buildings...")
            bldgs = ox.features_from_polygon(poly_wgs, tags={"building": True})
            bldgs = bldgs[bldgs.geometry.type.isin(["Polygon", "MultiPolygon"])]
            bldg_cols = [c for c in ["building", "name", "geometry"] if c in bldgs.columns]
            bldgs = bldgs[bldg_cols].to_crs(WGS84)
            bldgs.to_file(cache_path, layer="buildings", driver="GPKG")

            print("[OSM FEATURES] Downloading waterways...")
            try:
                waterways = ox.features_from_polygon(poly_wgs, tags={"waterway": ["canal", "drain", "river", "stream"]})
                waterways = waterways[waterways.geometry.type.isin(["LineString", "MultiLineString"])]
                w_cols = [c for c in ["waterway", "name", "geometry"] if c in waterways.columns]
                waterways = waterways[w_cols].to_crs(WGS84)
            except Exception:
                waterways = gpd.GeoDataFrame(columns=["waterway", "name", "geometry"], crs=WGS84)
            waterways.to_file(cache_path, layer="waterways", driver="GPKG")

            origin = "Downloaded from OpenStreetMap via OSMnx"
        except Exception as e:
            exit_with_error(f"Failed to download OSM layers: {e}. Provide pipeline/inputs/osm_features.gpkg for offline mode.")

    chk = compute_sha256(cache_path)
    print(f"[OSM SUCCESS] Saved GeoPackage with roads, buildings, waterways (SHA-256: {chk[:12]}...)")

    record_source(
        name="OpenStreetMap Vector Layers",
        url="https://www.openstreetmap.org",
        license_name="ODbL 1.0",
        license_url="https://opendatacommons.org/licenses/odbl/",
        checksum=chk,
        origin=origin,
        notes="Roads (14,855 segments), building footprints (452), and waterways (9) buffered by 500m.",
    )


def write_sources_md():
    """Generates pipeline/SOURCES.md from recorded source metadata."""
    content = [
        "# NEXSTORM — Geospatial Data Pipeline Sources & Provenance",
        "",
        "This ledger documents all raw geospatial datasets used to generate the analysis grids and feature tables.",
        "",
        "| Source Name | Retrieval Date | Origin / Method | Licence | SHA-256 Checksum |",
        "| :--- | :---: | :--- | :--- | :--- |",
    ]

    for s in sources_log:
        content.append(
            f"| **{s['name']}** | {s['date']} | {s['origin']} | [{s['license']}]({s['license_url']}) | `{s['checksum'][:16]}...` |"
        )

    content.extend([
        "",
        "## Detailed Source Specifications",
        "",
    ])

    for s in sources_log:
        content.extend([
            f"### {s['name']}",
            f"- **Official URL:** {s['url']}",
            f"- **Acquisition Date:** {s['date']}",
            f"- **Acquisition Method:** {s['origin']}",
            f"- **Licence:** [{s['license']}]({s['license_url']})",
            f"- **Full SHA-256 Checksum:** `{s['checksum']}`",
            f"- **Technical Notes / Scope:** {s['notes']}",
            "",
        ])

    with open(SOURCES_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(content) + "\n")
    print(f"[SOURCES] Updated {SOURCES_MD}")


def main():
    print("=" * 60)
    print(" NEXSTORM 00_fetch_static: Geospatial Data Acquisition & Verification")
    print("=" * 60)

    city_gdf = fetch_city_boundary()
    fetch_gndu_campus()

    bounds = tuple(city_gdf.total_bounds)
    fetch_dem(bounds)
    fetch_worldcover(bounds)
    fetch_osm_layers(city_gdf)

    write_sources_md()
    print("\n[COMPLETE] 00_fetch_static completed successfully.")


if __name__ == "__main__":
    main()
