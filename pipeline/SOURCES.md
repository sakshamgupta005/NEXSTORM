# NEXSTORM — Geospatial Data Pipeline Sources & Provenance

This ledger documents all raw geospatial datasets used to generate the analysis grids and feature tables.

| Source Name | Retrieval Date | Origin / Method | Licence | SHA-256 Checksum |
| :--- | :---: | :--- | :--- | :--- |
| **Amritsar Municipal Boundary** | 2026-10-14 | User-supplied file (pipeline/inputs/city_boundary.geojson) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | `418e830b12b1e27d...` |
| **Guru Nanak Dev University Campus** | 2026-10-14 | User-supplied file (pipeline/inputs/gndu_campus.geojson) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | `2721d80e429e0249...` |
| **Copernicus DEM GLO-30** | 2026-10-14 | User-supplied file (pipeline/inputs/dem.tif) | [Open Data under Copernicus Licence](https://spacedata.copernicus.eu/documents/20126/0/CSCDA_ESA_Data_Licence_FAQ.pdf) | `4b175bf3ff593a55...` |
| **ESA WorldCover 2021 v200** | 2026-10-14 | User-supplied file (pipeline/inputs/worldcover.tif) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | `21919b5fa319bd02...` |
| **OpenStreetMap Vector Layers** | 2026-10-14 | User-supplied file (pipeline/inputs/osm_features.gpkg) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) | `b1b57c408895c894...` |

## Detailed Source Specifications

### Amritsar Municipal Boundary
- **Official URL:** https://www.openstreetmap.org / Municipal Master Plan Envelope
- **Acquisition Date:** 2026-10-14
- **Acquisition Method:** User-supplied file (pipeline/inputs/city_boundary.geojson)
- **Licence:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
- **Full SHA-256 Checksum:** `418e830b12b1e27d778681aa51eb5bd62dcc100034a420de3c46825f70166489`
- **Technical Notes / Scope:** Municipal corporation extent polygon (~124.95 sq km, UTM Zone 43N).

### Guru Nanak Dev University Campus
- **Official URL:** https://www.openstreetmap.org/way/537950488
- **Acquisition Date:** 2026-10-14
- **Acquisition Method:** User-supplied file (pipeline/inputs/gndu_campus.geojson)
- **Licence:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
- **Full SHA-256 Checksum:** `2721d80e429e0249500eb82cb6fe7f4302f168258c94742f49772e09eac1ea2d`
- **Technical Notes / Scope:** Campus boundary polygon (~1.76 sq km, OpenStreetMap way 537950488).

### Copernicus DEM GLO-30
- **Official URL:** https://registry.opendata.aws/copernicus-dem/
- **Acquisition Date:** 2026-10-14
- **Acquisition Method:** User-supplied file (pipeline/inputs/dem.tif)
- **Licence:** [Open Data under Copernicus Licence](https://spacedata.copernicus.eu/documents/20126/0/CSCDA_ESA_Data_Licence_FAQ.pdf)
- **Full SHA-256 Checksum:** `4b175bf3ff593a55e50a5d572e8976f5d737cdae2ca156b48f9bbdb604214801`
- **Technical Notes / Scope:** Global 30-metre DSM cropped to buffered municipal extent.

### ESA WorldCover 2021 v200
- **Official URL:** https://esa-worldcover.org/en
- **Acquisition Date:** 2026-10-14
- **Acquisition Method:** User-supplied file (pipeline/inputs/worldcover.tif)
- **Licence:** [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Full SHA-256 Checksum:** `21919b5fa319bd028888f97dcc43c37ac81526d6e0d620aba6f107255337cdfb`
- **Technical Notes / Scope:** 10-metre land-cover classification map (Class 50 = Built-up).

### OpenStreetMap Vector Layers
- **Official URL:** https://www.openstreetmap.org
- **Acquisition Date:** 2026-10-14
- **Acquisition Method:** User-supplied file (pipeline/inputs/osm_features.gpkg)
- **Licence:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
- **Full SHA-256 Checksum:** `b1b57c408895c894015745f4252a63f4f989382b170690646d77535ad5712860`
- **Technical Notes / Scope:** Roads (14,855 segments), building footprints (452), and waterways (9) buffered by 500m.

