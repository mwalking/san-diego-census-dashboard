# San Diego Mosaic

San Diego Mosaic is a static, map-first census dashboard for exploring neighborhood-level patterns in
San Diego County, CA.

Live site: https://mwalking.github.io/san-diego-census-dashboard/

## What the app does

- Renders two geography modes:
  - H3 hex bins
  - Census tracts
- Supports three years:
  - `2022` (ACS 2018-2022)
  - `2023` (ACS 2019-2023)
  - `2024` (ACS 2020-2024)
- Lets users:
  - switch year + metric
  - switch geography
  - hover, click select, and brush select
  - inspect selected/in-view/all summaries with estimate and MOE where supported
  - use "Choose for me" to jump to high/low outliers

## Tech stack

- Vite + React + Tailwind
- MapLibre basemap + deck.gl overlays
- Python data pipeline managed with `uv`
- Static hosting on GitHub Pages

## Data model and contract

The web app uses precomputed static data only. No runtime Census API calls are made from the browser.

Required files:

- `public/data/years.json`
- `public/data/variables.json`
- `public/data/metadata.json`
- `public/data/hexes/<YEAR>.json`
- `public/data/tracts/tracts.geojson`
- `public/data/tracts/<YEAR>.json`

Compressed sidecars are additive:

- `.json.gz`
- `.geojson.gz`

Loader behavior:

- Try compressed sidecar first (`.gz`) when supported
- Fall back to plain JSON/GeoJSON for compatibility

## Local development

Install JS dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Run full verification:

```bash
npm run verify
```

Build production bundle:

```bash
npm run build
```

## Python pipeline (uv)

Sync Python environment:

```bash
uv sync
```

Run tract + metadata build:

```bash
uv run --env-file .env -- python scripts/py/build_tracts.py
```

Run hex build:

```bash
uv run --env-file .env -- python scripts/py/build_hexes.py
```

Generate gzip sidecars:

```bash
uv run -- python scripts/py/build_compressed_data.py
```

Manual environment alternative:

```bash
export CENSUS_API_KEY=...
uv run -- python scripts/py/build_tracts.py
uv run -- python scripts/py/build_hexes.py
```

## Deployment

GitHub Actions deploys the app to GitHub Pages from `main` using `.github/workflows/pages.yml`.

Important deployment assumptions:

- Pages uses GitHub Actions as the publishing source.
- Vite production base path is `/san-diego-census-dashboard/`.
- Deploy reads committed static assets from `public/data`.
- No deploy-time Census fetch is performed.

## Repo orientation

- `src/app/`: app state + orchestration
- `src/components/`: UI and map components
- `src/data/`: loading, geography adapters, stats, MOE helpers
- `src/ui/`: copy and UX text
- `scripts/py/`: ACS/TIGER ingestion and data build scripts
- `docs/`: source-of-truth spec, execution plan, and running project log
