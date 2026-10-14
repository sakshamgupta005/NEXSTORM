# NEXSTORM — Geospatial Data Pipeline

This directory contains the reproducible, offline-capable Python geospatial pipeline for **NEXSTORM** (BuildFest 2.0, PS-18).
It ingests digital elevation models, land-cover rasters, and OpenStreetMap vector layers to construct metric analysis grids and compute raw hydrological/topographical features.

---

## 1. Quickstart

### Prerequisites
- Python 3.11
- A virtual environment (`.venv`) with pinned dependencies from `requirements.txt`:

```bash
python -m venv .venv
# On Windows:
.venv\Scripts\pip install -r pipeline/requirements.txt
# On Linux/macOS:
.venv/bin/pip install -r pipeline/requirements.txt
```

### Makefile Commands
```bash
# Run the complete static-data acquisition, grid generation, and feature extraction pipeline
make data

# Run the offline pytest suite (zero network requests, synthetic 1km fixture)
make test

# Evaluation placeholder (scheduled for Stage P4B)
make eval
```

---

## 2. Directory Structure

```
pipeline/
├── README.md               # Pipeline documentation and operational guide
├── SOURCES.md              # Provenance ledger, official URLs, licences, and SHA-256 checksums
├── requirements.txt        # Pinned Python 3.11 geospatial dependencies
├── inputs/                 # Authoritative raw inputs (offline override directory)
│   ├── city_boundary.geojson   # Defensible municipal corporation boundary override
│   ├── gndu_campus.geojson     # Verified GNDU campus boundary polygon (OSM way 537950488)
│   ├── dem.tif                 # Copernicus DEM GLO-30 cropped raster
│   ├── worldcover.tif          # ESA WorldCover 2021 cropped raster
│   └── osm_features.gpkg       # OSM vector layers (roads, buildings, waterways)
├── cache/                  # Processed intermediate artifacts and feature table
│   ├── city_boundary.geojson
│   ├── gndu_campus.geojson
│   ├── dem.tif
│   ├── worldcover.tif
│   ├── osm_features.gpkg
│   ├── grid.geojson
│   ├── campus.geojson
│   └── features.parquet    # Raw multi-attribute feature table
├── scripts/
│   ├── utils.py            # SHA-256, CRS definitions, error handlers
│   ├── 00_fetch_static.py  # Source retrieval and provenance tracking
│   ├── 01_build_grid.py    # 250m city grid and 50m campus sub-grid generator
│   └── 02_features.py      # Feature extraction (depression, slope, land cover, underpasses)
└── tests/
    ├── conftest.py         # Synthetic 1km square test fixtures (pit, built-up, underpass)
    ├── test_grid.py        # Grid determinism and CRS projection tests
    ├── test_features.py    # Feature calculation and proxy detection tests
    └── test_offline_pipeline.py # Offline mode, provenance, and error handling tests
```

---

## 3. Coordinate Reference Systems (CRS)

- **Metric Grid & Calculations:** `EPSG:32643` (UTM Zone 43N, WGS 84 ellipsoid). Used for all 250m and 50m cell generation, area calculations, distances, and 750m neighborhood radius queries.
- **Export & Storage:** `EPSG:4326` (WGS 84 geographic latitude/longitude). Used for exported GeoJSON deliverables (`grid.geojson`, `campus.geojson`) consumed by web mapping frameworks (Leaflet / MapLibre).

---

## 4. Grid Generation Conventions

- **City Grid (250m):** Regular square cells aligned to cell-size multiples in UTM 43N coordinates.
  - **Intersection Rule:** Cells whose geometric centroid falls inside the municipal boundary polygon are included. This avoids partial sliver distortion and guarantees a uniform cell area ($62,500\text{ m}^2$).
  - **IDs:** Deterministic, assigned top-to-bottom (North to South), left-to-right (West to East): `A-0001` through `A-1998`.
- **Campus Sub-Grid (50m):** Regular 50m square cells covering the Guru Nanak Dev University campus polygon (`G-0001` through `G-0699`). Uniform cell area ($2,500\text{ m}^2$).

---

## 5. Feature Dictionary (`pipeline/cache/features.parquet`)

| Feature Name | Type | Description | Source |
| :--- | :---: | :--- | :--- |
| `cell_id` | string | Unique deterministic cell identifier (`A-0001`..`A-1998`, `G-0001`..`G-0699`) | Analysis Grid |
| `is_campus` | bool | `True` for 50m campus sub-grid cells, `False` for 250m city cells | Analysis Grid |
| `centroid_x` | float | Centroid Easting (UTM 43N meters) | Geometry |
| `centroid_y` | float | Centroid Northing (UTM 43N meters) | Geometry |
| `elevation_mean` | float | Mean elevation above sea level in metres | Copernicus DEM GLO-30 (30m) |
| `local_depression` | float | Cell elevation minus mean elevation of DEM pixels within a 750m metric radius ($< 0$ indicates a local depression/pit prone to ponding) | Copernicus DEM GLO-30 (30m) |
| `slope_deg` | float | Terrain slope in degrees computed via 2D finite differences | Copernicus DEM GLO-30 (30m) |
| `flat_fraction` | float | Share of DEM pixels in the cell with slope $< 0.5^\circ$ | Copernicus DEM GLO-30 (30m) |
| `builtup_fraction` | float | Share of cell classified as Class 50 (Built-up) | ESA WorldCover 2021 (10m) |
| `building_density` | float | Total building footprint area divided by cell area | OpenStreetMap `building=*` |
| `road_density` | float | Road network density in $\text{km} / \text{km}^2$ | OpenStreetMap `highway=*` |
| `nearest_named_road` | string | Name of the closest mapped named road | OpenStreetMap `name=*` |
| `dist_to_named_road_m` | float | Distance from cell centroid to closest named road in metres | OpenStreetMap |
| `underpass_flag` | int | Binary proxy flag (1 = underpass proxy detected, 0 = none) | OpenStreetMap `tunnel`, `layer < 0`, or bridge crossing within 100m |
| `underpass_reason` | string | Detection attribute rationale | OpenStreetMap |

---

## 6. Offline Operation

The pipeline is fully capable of running **completely offline without internet access**.
When files are placed in `pipeline/inputs/`:
- `city_boundary.geojson` $\implies$ used as the municipal boundary override.
- `gndu_campus.geojson` $\implies$ used as the campus polygon override.
- `dem.tif` $\implies$ used as the digital elevation raster.
- `worldcover.tif` $\implies$ used as the land-cover classification raster.
- `osm_features.gpkg` $\implies$ used as the vector layer source.

If an input is missing in offline mode, the pipeline halts with a descriptive error message indicating the required file path.

---

## 7. Known Limitations

1. **Elevation Accuracy:** Copernicus GLO-30 is a Digital Surface Model (DSM) at 30m resolution; dense tree canopies or high-rise structures can add minor surface bias relative to true bare-earth Digital Terrain Models (DTM).
2. **OSM Completeness:** Building footprints in OpenStreetMap reflect volunteer mapping coverage; unmapped informal settlements may have under-reported building densities while still being captured accurately by the satellite-derived ESA WorldCover `builtup_fraction`.
3. **Underpass Proxy Nature:** `underpass_flag` is an OSM-derived topological proxy based on road tunnels and bridge-over-road crossings; municipal stormwater drain underpass sumps require local engineering surveys for operational validation.
