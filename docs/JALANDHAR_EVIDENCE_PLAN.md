# NEXSTORM Jalandhar Evidence Collection & Calibration Plan (P24)

**Document Status:** Complete & Approved  
**Date:** October 2026  
**Pilot Geography:** Jalandhar Municipal Perimeter, Punjab, India  
**Target Coordinates:** 31.28°N – 31.38°N, 75.52°E – 75.66°E (UTM Zone 43N / EPSG:32643)  
**Current Readiness State:** `evidence_insufficient` (Alert Dispatch Strictly Prohibited)  

---

## 1. Executive Summary & Scientific Mandate

In NEXSTORM P23, Jalandhar was bootstrapped as a secondary Indian municipal geography to demonstrate multi-city architectural portability. However, in strict accordance with the **Skeleton-First Principle** and **Zero Evidence Fabrication Directive**:
> **A generated map or successful code build must NEVER be conflated with verified predictive skill.**
> Data processing proves technical capability, NOT physical accuracy. Without ground-truth municipal waterlogging evidence, flood predictions are uncalibrated and cannot be used for operational decision-making.

This document establishes the official evidence collection, sourcing protocol, and calibration roadmap required to transition Jalandhar from `evidence_insufficient` to `evaluation_ready`.

---

## 2. Geographic, Topographic & Drainage Context

| Geographic Attribute | Amritsar (Reference Baseline) | Jalandhar (Secondary Pilot) | Comparative Implications |
| :--- | :--- | :--- | :--- |
| **Regional Setting** | Upper Bari Doab Plain (Ravi-Beas) | Bist Doab Plain (Beas-Sutlej) | Both share alluvial Indo-Gangetic morphology, but belong to distinct hydrological sub-basins. |
| **Elevation Range** | ~226m to ~236m MSL | ~228m to ~235m MSL | Very low regional relief; subtle southwestward slope towards drainage outfalls. |
| **Primary Natural Outfall** | Tung Dhab Drain & Sakki Nullah | Chitti Bein & Kala Sangha Nullah | Jalandhar discharges southwards toward the Chitti Bein, an active tributary of the Sutlej River. |
| **Primary Stormwater Carrier** | Open masonry drains along GT Road | Kala Sangha Nullah (West Jalandhar) | Chronic siltation, industrial effluent, and encroachment frequently choke storm flows. |
| **Known Inundation Hubs** | SSSS Chowk Underpass, Hall Gate, Heritage Street | Damoria Railway Underbridge, 120 Feet Road, Football Chowk | Railway underpasses and low-lying commercial chowks represent critical choke points in both cities. |

### Documented Civic Waterlogging Choke Points in Jalandhar:
1. **Damoria Railway Underbridge (RUB):** Low-lying subterranean roadway connecting old city to railway station and cantonment. Submerges under 3–5 feet of water during heavy downpours, halting vehicle transit.
2. **120 Feet Road / Basti Guzan / Basti Danishmanda:** Densely populated western peri-urban corridor vulnerable to sewage backflow and Kala Sangha Nullah overflow.
3. **Football Chowk & Company Bagh Area:** Commercial intersection prone to rapid surface runoff accumulation due to high impervious surface fraction and choked roadside gullies.
4. **Burlton Park & Ladowali Road Stretch:** Natural depression basin in central-northern urban zone.
5. **Preet Nagar / Sodal Road Railway Underpass:** Low-clearance underpass with chronic waterlogging during high-intensity rainfall.

---

## 3. Independent Audit of Accessible Data Sources & Access Barriers

We conducted an exhaustive audit of available meteorological, civic, and remote sensing sources for Jalandhar:

| Source Name | Intended Use | Actual Access Status | Access Barriers & Limitations |
| :--- | :--- | :--- | :--- |
| **Open-Meteo ERA5-Land Reanalysis** | Long-term monsoon rainfall baseline & threshold calculation | **ACCESSED & VERIFIED** | 0.1° (~11 km) spatial grid averages out micro-scale convective thunderstorm cores. Retrospective reanalysis indicates rainfall presence, but **does not prove waterlogging occurred**. |
| **Open-Meteo Numerical Weather API** | Real-time and prospective 7-day precipitation forecasts | **ACCESSED & VERIFIED** | Point forecast at `(31.33°N, 75.59°E)`. Coarse resolution cannot resolve micro-scale convective cells (1–3 km). |
| **IMD AWS / ARG Station Telemetry (Adampur / Jalandhar)** | High-precision sub-daily rainfall gauge measurements | **BLOCKED (Restricted Access)** | IMD automated weather station telemetry requires official government credentials and signed data-sharing agreements with the Ministry of Earth Sciences. Public web bulletins provide only district-wide 24h summaries. |
| **Municipal Corporation Jalandhar (MCJ) Complaint Logs** | Ground-truth inundation location inventory | **BLOCKED (Non-Digitized)** | MCJ flood control rooms operate temporary phone/paper complaint registers during monsoon months. No open-access GIS portal or machine-readable REST API is available for public ingestion. |
| **Punjab SDMA / NDMA SACHET Live Alerts** | Official disaster warning validation | **PARTIALLY ACCESSIBLE (CAP-XML text)** | Feeds provide district-level warnings ("Orange alert for Jalandhar"), but lack localized street-level inundation coordinates or flood depths. |
| **Newspaper Archives (*The Tribune*, *Hindustan Times*, *Indian Express*)** | Retrospective media incident reporting | **ACCESSIBLE (Manual audit required)** | Highly localized and verifiable, but requires systematic manual archiving, location cross-referencing, and deduplication into distinct storm events. |
| **Sentinel-1 SAR Satellite Imagery** | Radar water-detection and extent verification | **AVAILABLE VIA GEE** | Double-bounce scattering from dense masonry buildings severely impedes urban surface water detection in built-up Indian municipal centers. |

---

## 4. Prioritized Evidence Collection Roadmap

To bring Jalandhar to `evaluation_ready`, the following 3-phase evidence collection strategy is required:

### Phase A: Systematic Local Media Incident Extraction (Immediate - Research Team)
1. **Target Archival Window:** June 1, 2022 to September 30, 2024 (covering 3 full South Asian monsoon seasons).
2. **Search Parameters:** Terms: `"Jalandhar rain"`, `"waterlogging"`, `"Damoria bridge submerged"`, `"Kala Sangha nullah overflow"`, `"water inundated"` across *The Tribune*, *Hindustan Times*, and *Indian Express*.
3. **Admissibility Protocol (Strictly Adhering to P19 Standard):**
   - **Date & Time:** Must identify exact calendar date and approximate storm timing.
   - **Spatial Precision:** Must resolve to a specific street, landmark, underpass, or ward intersection.
   - **Physical Mechanism:** Must verify inundation was caused by pluvial rainfall-runoff, not unrelated sewer pipe maintenance or irrigation canal breaches.
   - **Deduplication:** Multiple news reports from the same 24-hour storm system must be clustered into a single `stormEventId`.
4. **Target Threshold:** A minimum of **5 independent verified storm events** across at least 10 distinct municipal locations.

### Phase B: Municipal Partnership & Smart City Integration (Mid-Term - Agency Level)
1. Engage with **Municipal Corporation Jalandhar (MCJ)** and **Jalandhar Smart City Limited**.
2. Request monsoon flood control room dispatch logs for recent years.
3. Geo-reference municipal drainage maintenance registers for water-pump deployment locations.

### Phase C: Verified Community Crowdsourcing (Ongoing - Platform Integration)
1. Leverage NEXSTORM's P17 community observation module (`/api/observations`).
2. Provide local MCJ ward engineers with moderator keys (`OBSERVATION_MODERATOR_KEY`) for field inspection sign-offs.
3. Automatically record verified depth, duration, and geo-tagged photographic evidence.

---

## 5. Transition Criteria & Calibration Safeguards

| Readiness State | Required Evidence Milestone | Permitted System Actions |
| :--- | :--- | :--- |
| **`evidence_insufficient`** *(Current)* | 0 verified historical storm events. Synthetic or proxy susceptibility maps only. | Internal exploratory research, data structure validation, map viewing. **Alert dispatch strictly blocked.** |
| **`evaluation_ready`** | $\ge 5$ distinct documented rainfall storms verified in `incidents_inventory.json` with localized cell matching. | Historical reanalysis backtesting, leave-one-out cross-validation, sensitivity analysis, POD/FAR determination. |
| **`pilot_eligible`** | Localized calibration complete, empirical thresholds tuned, municipal stakeholder sign-off, operator consent. | Limited canary rollout (`evaluation_only` default, opt-in test dispatch to registered civic personnel). |

### Explicit Invariance Rules:
1. **No Inherited Skill:** Amritsar's 88.9% POD and 10-of-13 spatial hotspot detection rate **must never be cited as evidence of Jalandhar model accuracy**.
2. **No Fabricated Negatives:** An unobserved day or cell without a news report is classified as `unknown`, NOT a confirmed flood-free negative.
3. **Fail-Closed Preflight:** Deployment preflight tools (`scripts/preflight-alerts.mjs`) will immediately reject live alert dispatch if `cityId: "jalandhar"` is configured with a live rollout mode.

---

## 6. Execution Status & Reconstructed Evidence Inventory (P25 Status)

### 1. Archival Research Execution (Phase A Completed)
Following the protocol in Section 4, archival research across *The Tribune* and *Hindustan Times* (2022–2024) was executed. Exactly 10 incident records were reconstructed into `public/data/cities/jalandhar/incidents_inventory.json`:
- **1 Excluded Event:** `EXCL-JAL-2023-08-05-EFFLUENT-SPILL` on Leather Complex Road was excluded because inundation was caused by industrial effluent discharge without concurrent precipitation.
- **9 Valid Waterlogging Incidents:** Documented across 6 priority choke points: Damoria Railway Underbridge, 120 Feet Road / Basti Guzan, Ladowali Road, Preet Nagar / Sodal underpass, Football Chowk, and Burlton Park Outer Road.
- **5 Independent Storm Events:** Clustered strictly into 5 discrete storm dates (`STORM-JAL-2023-07-09`, `STORM-JAL-2023-07-22`, `STORM-JAL-2024-07-03`, `STORM-JAL-2024-07-27`, `STORM-JAL-2024-08-11`).

### 2. Evidence Limits & Safe Readiness Stance
All 9 valid records carry `verificationStatus: "source_reported"` (journalistic reporting). While sufficient to drive exploratory spatial backtesting (`pipeline/scripts/18_evaluate_jalandhar.py`), they lack official municipal engineering log corroboration or sub-daily gauge telemetry.
In strict accordance with the readiness rules:
- **Jalandhar remains in `readinessState: "evidence_insufficient"`.**
- **External alerts remain fail-closed suppressed.**
- **False Alarm Rate (FAR) and Specificity remain withheld.**

