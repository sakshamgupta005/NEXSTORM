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

test:
	$(PYTEST) -c pipeline/pytest.ini pipeline/tests/ -v

eval:
	@echo [EVAL PLACEHOLDER] Stage P4B Model Evaluation is scheduled for later roadmap phases.
	@echo [EVAL PLACEHOLDER] Validation against observed waterlogging events will be implemented in P4B.
