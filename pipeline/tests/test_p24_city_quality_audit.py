"""
pipeline/tests/test_p24_city_quality_audit.py
Pytest suite for NEXSTORM P24 Geospatial Quality Audit & Calibration Observability.
"""

import importlib.util
import json
from pathlib import Path
import pytest
import geopandas as gpd

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
ROOT = Path(__file__).resolve().parent.parent.parent

# Dynamically import 17_city_quality_audit.py
spec = importlib.util.spec_from_file_location("city_quality_audit", SCRIPTS_DIR / "17_city_quality_audit.py")
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)
audit_city = audit_module.audit_city


def test_amritsar_quality_audit_verdict():
    """Verifies Amritsar passes all technical and evidence gates with zero fatal errors and zero warnings."""
    report = audit_city("amritsar")
    verdict = report["auditVerdict"]

    assert verdict["technicalIntegrityPassed"] is True
    assert verdict["calibrationStatus"] == "calibrated"
    assert verdict["readinessState"] == "evaluation_ready"
    assert verdict["fatalErrorCount"] == 0
    assert verdict["warningCount"] == 0
    assert verdict["evidenceLimitationCount"] == 0

    # Provenance
    assert report["featureAudit"]["dataOrigin"]["isPhysicallySampled"] is True
    assert report["gridAudit"]["boundaryType"] == "official_municipal_perimeter"

    # Distribution spread
    stats = report["featureAudit"]["susceptibilityStats"]
    assert stats["min"] == 0.0
    assert stats["max"] == 1.0
    assert stats["std"] > 0.15


def test_jalandhar_quality_audit_verdict():
    """Verifies Jalandhar passes technical integrity, tracks before-and-after transition, and remains evidence_insufficient."""
    report = audit_city("jalandhar")
    verdict = report["auditVerdict"]

    assert verdict["technicalIntegrityPassed"] is True
    assert verdict["calibrationStatus"] == "uncalibrated_exploratory"
    assert verdict["readinessState"] == "evidence_insufficient"
    assert verdict["fatalErrorCount"] == 0

    # Jalandhar boundary honesty: must declare rectangular AOI box
    assert report["gridAudit"]["boundaryType"] == "rectangular_aoi_box"

    # Preserved P24 baseline proxy audit in beforeAndAfter ledger
    delta = report["featureAudit"].get("beforeAndAfterP24VsP25")
    assert delta is not None
    assert delta["p24ProxyFeatures"]["sourceType"] == "analytic_coordinate_proxy"
    assert delta["p24ProxyFeatures"]["susceptibilityStd"] < 0.10
    assert delta["p24ProxyFeatures"]["midBandCompressionPct"] > 90.0

    # P25 physical sampling: verified physical rasters and restored spatial contrast
    assert report["featureAudit"]["dataOrigin"]["isPhysicallySampled"] is True
    assert report["featureAudit"]["dataOrigin"]["sourceType"] == "physical_raster_and_vector"
    assert report["featureAudit"]["susceptibilityStats"]["std"] >= 0.12
    assert report["featureAudit"]["bandDistributionPercent"]["mid"] < 75.0

    # Evidence audit: 5 distinct storm events reconstructed from media archives, but remains source_reported
    assert report["evidenceAudit"]["hasHistoricalEvidence"] is True
    assert report["evidenceAudit"]["distinctStormEvents"] == 5
    assert verdict["evidenceLimitationCount"] == 1



def test_cross_city_comparability_flagging():
    """Verifies cross-city comparability flags non-equivalence and transfer status."""
    asr_rep = audit_city("amritsar")
    jal_rep = audit_city("jalandhar")

    assert asr_rep["crossCityComparability"]["role"] == "reference_baseline"
    assert asr_rep["crossCityComparability"]["isTransferredWithoutCalibration"] is False

    assert jal_rep["crossCityComparability"]["role"] == "secondary_exploratory_pilot"
    assert jal_rep["crossCityComparability"]["isTransferredWithoutCalibration"] is True
    assert "NON-EQUIVALENT" in jal_rep["crossCityComparability"]["crossCityScoreEquivalence"]
