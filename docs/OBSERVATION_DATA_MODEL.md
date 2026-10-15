# NEXSTORM Observation Data Model & Schema Specification

**Version:** 1.0.0  
**Pilot Area:** Amritsar, Punjab, India  
**Status:** Active Production Contract  

---

## 1. Architectural Scope & Purpose

NEXSTORM integrates three long-term capabilities across urban Punjab:
1. **Area-level waterlogging susceptibility and rainfall-triggered risk** (250m grid).
2. **Building-level exposure assessment** (360,252 building polygons).
3. **Road-segment risk assessment and flood-aware routing** (14,853 road segments).

Stage P10 creates the **Ground-Truth Evidence Layer** supporting all three pillars. This data model establishes canonical contracts for recording, validating, snapping, and moderating field observations and community reports.

### The Non-Conflation Directive
- **Modeled Risk $\neq$ Observed Flooding**: Model outputs represent theoretical relative susceptibility and hyetograph-derived probabilities. Observations represent empirical physical conditions at a specific time.
- **Reported $\neq$ Verified**: Community submissions are unverified by default. Multiple corroborating reports increase evidence credibility, but an observation **never** transitions to `verified` without authorized human or telemetric verification.

---

## 2. Canonical Observation Schema

Every observation adheres to `WaterloggingObservation` (defined in `src/lib/observations/types.ts` and validated via Zod in `src/lib/validations/observation.ts`):

```typescript
export interface WaterloggingObservation {
  id: string // Stable identifier, e.g. "OBS-20261015-7c159b70"
  schemaVersion: '1.0.0'
  cityId: string // e.g. "amritsar"
  createdAt: string // ISO-8601 server generation timestamp
  submittedAt: string // ISO-8601 network reception timestamp
  observedAt: string // ISO-8601 actual event timestamp (<= submittedAt)
  coordinates: Wgs84Coordinates // { lat: number, lng: number } in EPSG:4326

  spatialMatch: ObservationSpatialMatch // Snapping to grid, roads, and buildings
  category: WaterloggingCategory
  severity: WaterloggingSeverity
  description?: string // Max 500 chars, sanitized
  photoUrl?: string // Optional secure HTTPS URL

  reporterHash?: string // Pseudonymous SHA-256 hash (REDACTED in public APIs)
  sourceType: ObservationSourceType
  lifecycleStatus: ObservationLifecycleStatus

  verification: VerificationRecord
  corroboration: ObservationCorroboration
  freshness: ObservationFreshness

  scientificCaveat: string // Mandatory permanent disclaimer
}
```

---

## 3. Controlled Vocabularies & Types

### 3.1 Waterlogging Categories (`WaterloggingCategory`)
| Category | Definition | Operational Handling |
| :--- | :--- | :--- |
| `street_flooding` | Water across road carriageway affecting vehicular transit | Snapped to nearest road centerline within 30m |
| `underpass_submersion` | Railway or highway underpass flooded | Critical priority; triggers underpass segment isolation |
| `drain_overflow` | Storm drain, nallah, or manhole surcharge | Linked to analysis catchment cell |
| `ponding` | Localized gutter or roadside depression accumulation | Passable for vehicular traffic |
| `receding_water` | Water level actively receding; road cleared | Immediately flagged as expired (`isExpired: true`) |

### 3.2 Reported Severity (`WaterloggingSeverity`)
| Severity Level | Estimated Depth | Practical Traffic Impact |
| :--- | :--- | :--- |
| `minor_curb` | $< 10\text{ cm}$ | Passable for all vehicle types |
| `moderate_ankle` | $10\text{--}20\text{ cm}$ | Passable with caution; two-wheelers affected |
| `severe_knee_or_higher`| $20\text{--}50\text{ cm}$ | Impassable for passenger cars and two-wheelers |
| `impassable_vehicles` | $> 50\text{ cm}$ | Submerged; buses and commercial vehicles stalled |

### 3.3 Observation Source Type (`ObservationSourceType`)
- `community_submission`: Submitted by public citizen via web console.
- `authorized_field_observer`: Verified surveyor, municipal inspector, or designated volunteer.
- `imported_historical_record`: Seeded or digitized archive (e.g. 15 Tribune India news reports).
- `municipal_report`: Official dispatch from Amritsar Municipal Corporation (MCA) or Punjab Police.

---

## 4. Spatial Matching Specification

Every incoming point is deterministically evaluated against Amritsar's spatial foundations without altering core geometry:

### 4.1 Grid Matching (250m Municipal Grid)
- **Bounding Box Guard**: Coordinates must fall within $[31.50^\circ\text{ N}, 74.70^\circ\text{ E}]$ to $[31.80^\circ\text{ N}, 75.05^\circ\text{ E}]$.
- **Ray-Casting Algorithm**: Matched to analysis cell via `matchPointToGrid(point, gridFeatures)`.
- **Honest Unmatched Status**: If coordinates fall outside municipal cell boundaries (e.g. peri-urban agricultural fringe), `cellId` is set to `null` with `matchQuality: 'unmatched'`.

### 4.2 Road Snapping (30-Metre Tolerance)
- **Metric Projection in UTM 43N**: Observations are projected onto the 14,853 road network polylines using `matchObservationToRoadSegment`.
- **Snapping Threshold**: Strictly 30.0 metres.
- **Unmatched Preservation**: If the nearest road is $> 30\text{ m}$ away, `roadSegmentId` remains `null`, recording `unmatchedReason: "Distance to nearest roadway exceeds maximum allowable snapping tolerance (30m)"`.

---

## 5. Privacy & Cryptographic Pseudonymity

To comply with non-negotiable privacy directives, no personally identifiable information (PII) is ever written to disk or exposed in API endpoints:

1. **Pseudonymous Reporter Hash**:
   $$\text{reporterHash} = \text{SHA256}(\text{clientIP} + \text{userAgent} + \text{SALT})[0\dots 16]$$
   Allows deduplication and clustering across requests from the same origin without logging IP addresses or account emails.
2. **API Output Redaction**:
   All public `GET` and `POST` response serializations explicitly strip `reporterHash` before returning payload to clients.

---

## 6. Persistence Strategy & Migration Blueprint

### Current Architecture (Hackathon / Pilot Local)
- **Engine**: In-memory cache backed by atomic file-based persistence at `public/data/cities/amritsar/observations/observations.json`.
- **Atomicity**: Writes occur to `.tmp` files with atomic file rename (`fs.renameSync`) to prevent partial-write corruption.
- **Seeding**: Automatically seeds from `public/data/cities/amritsar/hotspots.json` on first boot (15 historical Tribune records).
- **Concurrency**: Process-level singleton `observationService`.

### Production Deployment Target (PostgreSQL / Supabase)
When external infrastructure is provisioned:
1. **Schema Migration**:
   ```sql
   CREATE TABLE observations (
     id VARCHAR(64) PRIMARY KEY,
     schema_version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
     city_id VARCHAR(32) NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     submitted_at TIMESTAMPTZ NOT NULL,
     observed_at TIMESTAMPTZ NOT NULL,
     geom GEOMETRY(Point, 4326) NOT NULL,
     cell_id VARCHAR(32),
     road_segment_id VARCHAR(64),
     category VARCHAR(32) NOT NULL,
     severity VARCHAR(32) NOT NULL,
     description TEXT,
     photo_url TEXT,
     reporter_hash VARCHAR(32) NOT NULL,
     source_type VARCHAR(32) NOT NULL,
     lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
     verification_data JSONB NOT NULL,
     corroboration_data JSONB NOT NULL,
     freshness_data JSONB NOT NULL
   );
   CREATE INDEX idx_obs_geom ON observations USING GIST (geom);
   CREATE INDEX idx_obs_city_status ON observations (city_id, lifecycle_status);
   ```
2. **Image Storage**: S3 bucket or Supabase Storage with pre-signed upload URLs, MIME verification, and EXIF coordinate stripping.
