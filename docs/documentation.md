<!-- docs/documentation.md -->
# Project Log (Documentation)

## Current status
- **Active milestone:** Milestone 0 — Project memory + Codex steering + baseline verify
- **Next milestone:** Milestone A — UI shell + geography toggle UI (non-functional)

## Repository overview
This repo contains a static census dashboard web app for **San Diego County** with a map that can toggle between:
- **Hex bins (H3)**
- **Census tracts (official boundaries)**

Data are precomputed and committed under `public/data/`.

## How to run (web)
```bash
npm install
npm run dev

## How to verify
npm run verify

## How to build
npm run build

## How to run (data pipeline) — placeholder

(Will be filled in once Python scripts exist.)

Example

## to-do (change this to use uv)
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/py/requirements.txt
export CENSUS_API_KEY="..."
python scripts/py/build_data.py --config scripts/py/config.yaml

## Demo flow (MVP)

Open the app

Dismiss Welcome modal

Use the Geography toggle:

Hex bins ↔ Census tracts

Use year slider to change year

Click a metric in the sidebar → map recolors + legend updates

Hover a feature → highlight

Click a feature → sidebar shows stats

Switch to multi-select → brush select multiple features

Click “Choose for me” → fly-to + callout shows feature value and county average

Open “Data sources” and “About” modals

Decisions

(Pending) Choose placement of geography toggle (recommended: legend card header).

(Pending) Tract boundary vintage and how to handle cross-year boundary changes.

(Pending) Quantile computation scope:

per geography (required)

across all years (recommended for stable legend)

Known issues / follow-ups

None yet.

Milestone notes (append-only log)
YYYY-MM-DD — Milestone 0 started

Planned: add docs + AGENTS + verify tooling + CI

Commands to run: npm run verify

(Each milestone completion should include: summary, changed files, commands run, results.)