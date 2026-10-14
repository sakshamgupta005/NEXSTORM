# NEXSTORM Geospatial Pipeline Makefile

ifeq ($(OS),Windows_NT)
    PYTHON := .venv/Scripts/python.exe
    PYTEST := .venv/Scripts/pytest.exe
else
    PYTHON := .venv/bin/python
    PYTEST := .venv/bin/pytest
endif

.PHONY: all data test eval clean

all: data

data:
	$(PYTHON) pipeline/scripts/00_fetch_static.py
	$(PYTHON) pipeline/scripts/01_build_grid.py
	$(PYTHON) pipeline/scripts/02_features.py
	$(PYTHON) pipeline/scripts/03_susceptibility.py
	$(PYTHON) pipeline/scripts/04_hotspots.py
	$(PYTHON) pipeline/scripts/05_thresholds.py
	$(PYTHON) pipeline/scripts/06_freeze_config.py

test:
	$(PYTEST) -c pipeline/pytest.ini pipeline/tests/ -v

eval:
	$(PYTHON) pipeline/scripts/07_eval_forecast.py
	$(PYTHON) pipeline/scripts/08_eval_susceptibility.py
	$(PYTHON) pipeline/scripts/09_eval_events.py
	$(PYTHON) pipeline/scripts/10_build_replay.py
	$(PYTHON) pipeline/scripts/11_write_summary.py
