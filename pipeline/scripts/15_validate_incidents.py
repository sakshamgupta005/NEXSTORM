#!/usr/bin/env python3
"""
pipeline/scripts/15_validate_incidents.py
Validates, checks provenance, deduplicates clusters, and audits ground-truth
incident inventory for NEXSTORM P19.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

REQUIRED_FIELDS = [
    "incidentId",
    "legacyId",
    "stormEventId",
    "name",
    "locality",
    "cellId",
    "lat",
    "lon",
    "precision",
    "geocodingMethod",
    "source",
    "sourceUrl",
    "publishedAt",
    "articleDate",
    "estimatedEventStart",
    "estimatedEventEnd",
    "timeConfidence",
    "category",
    "reportedImpact",
    "evidenceExcerpt",
    "verificationStatus",
    "verificationMethod",
    "sourceIndependence",
    "isRainfallDriven",
    "inclusionDecision",
    "inclusionReason",
]

ALLOWED_STATUSES = {
    "independently_verified",
    "source_reported",
    "location_uncertain",
    "time_uncertain",
    "duplicate_of_event",
    "excluded_with_reason",
}

AMRITSAR_BBOX = (74.80, 31.575, 74.935, 31.685)  # minLon, minLat, maxLon, maxLat


def validate_incident_inventory(repo_root: Path):
    inventory_path = repo_root / "public" / "data" / "cities" / "amritsar" / "incidents_inventory.json"
    susceptibility_path = repo_root / "public" / "data" / "cities" / "amritsar" / "susceptibility.geojson"

    if not inventory_path.exists():
        print(f"ERROR: Inventory file missing at {inventory_path}", file=sys.stderr)
        return False

    if not susceptibility_path.exists():
        print(f"ERROR: Susceptibility file missing at {susceptibility_path}", file=sys.stderr)
        return False

    with open(inventory_path, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    with open(susceptibility_path, "r", encoding="utf-8") as f:
        susceptibility = json.load(f)

    known_cells = {feat["properties"]["id"] for feat in susceptibility["features"]}

    errors = []
    min_lon, min_lat, max_lon, max_lat = AMRITSAR_BBOX

    storm_groups = defaultdict(list)
    status_counts = defaultdict(int)
    inclusion_counts = defaultdict(int)
    url_to_incidents = defaultdict(list)

    for i, inc in enumerate(incidents):
        # 1. Field completeness
        missing = [f for f in REQUIRED_FIELDS if f not in inc]
        if missing:
            errors.append(f"Record #{i} ({inc.get('incidentId', 'UNKNOWN')}): Missing required fields: {missing}")

        # 2. Coordinates within bounding box
        lat = inc.get("lat")
        lon = inc.get("lon")
        if not (min_lat <= lat <= max_lat and min_lon <= lon <= max_lon):
            errors.append(f"Record {inc.get('incidentId')}: Coordinates ({lat}, {lon}) out of city bbox {AMRITSAR_BBOX}")

        # 3. Cell ID validity
        cell_id = inc.get("cellId")
        if cell_id not in known_cells:
            errors.append(f"Record {inc.get('incidentId')}: Cell ID '{cell_id}' not found in city susceptibility grid")

        # 4. Status taxonomy
        v_status = inc.get("verificationStatus")
        if v_status not in ALLOWED_STATUSES:
            errors.append(f"Record {inc.get('incidentId')}: Invalid verificationStatus '{v_status}'")
        status_counts[v_status] += 1

        # 5. Inclusion logic
        decision = inc.get("inclusionDecision")
        if decision not in ("included", "excluded"):
            errors.append(f"Record {inc.get('incidentId')}: Invalid inclusionDecision '{decision}'")
        inclusion_counts[decision] += 1

        is_rain = inc.get("isRainfallDriven")
        if decision == "included" and not is_rain:
            errors.append(f"Record {inc.get('incidentId')}: Cannot include non-rainfall event in pluvial hazard evaluation")
        if decision == "excluded" and v_status != "excluded_with_reason":
            errors.append(f"Record {inc.get('incidentId')}: Excluded record must have status 'excluded_with_reason'")

        # 6. Groupings & URLs
        storm_id = inc.get("stormEventId")
        storm_groups[storm_id].append(inc)

        source_url = inc.get("sourceUrl")
        if source_url:
            url_to_incidents[source_url].append(inc.get("incidentId"))

    if errors:
        print("=== VALIDATION FAILURES ===", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return False

    # Summary statistics
    total_records = len(incidents)
    included_records = inclusion_counts["included"]
    excluded_records = inclusion_counts["excluded"]

    rainfall_storms = [sid for sid, recs in storm_groups.items() if any(r["isRainfallDriven"] for r in recs)]
    non_rainfall_events = [sid for sid, recs in storm_groups.items() if not any(r["isRainfallDriven"] for r in recs)]

    # Multi-location storms
    cluster_storms = {sid: len(recs) for sid, recs in storm_groups.items() if len(recs) > 1}

    # Shared URLs
    shared_urls = {url: inc_ids for url, inc_ids in url_to_incidents.items() if len(inc_ids) > 1}

    summary = {
        "status": "passed",
        "datasetPath": str(inventory_path.relative_to(repo_root)),
        "totalRecords": total_records,
        "includedRecords": included_records,
        "excludedRecords": excluded_records,
        "distinctStormEvents": len(storm_groups),
        "rainfallDrivenStorms": len(rainfall_storms),
        "excludedNonRainfallEvents": len(non_rainfall_events),
        "statusCounts": dict(status_counts),
        "clusterStorms": cluster_storms,
        "sharedSourceUrls": {k: v for k, v in shared_urls.items()},
        "exclusions": [
            {
                "incidentId": r["incidentId"],
                "name": r["name"],
                "reason": r["inclusionReason"],
            }
            for r in incidents
            if r["inclusionDecision"] == "excluded"
        ],
    }

    output_summary_path = repo_root / "public" / "data" / "evaluation" / "e5_incident_validation.json"
    output_summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("=== INCIDENT INVENTORY AUDIT & DEDUPLICATION REPORT ===")
    print(f"Total Incident Records:        {total_records}")
    print(f"Included (Rainfall Pluvial):   {included_records}")
    print(f"Excluded (Non-Rainfall/Stagn): {excluded_records}")
    print(f"Distinct Storm Events:         {len(storm_groups)}")
    print(f"  - Genuine Rainfall Storms:   {len(rainfall_storms)}")
    print(f"  - Excluded Events:           {len(non_rainfall_events)}")
    print(f"Clustered Storm Events:        {cluster_storms}")
    print(f"Shared Source Articles:        {len(shared_urls)} articles cover multiple locations")
    print(f"Summary written to:            {output_summary_path}")

    return True


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent.parent
    success = validate_incident_inventory(repo_root)
    sys.exit(0 if success else 1)
