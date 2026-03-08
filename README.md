# San Diego Mosaic

Static census dashboard project for San Diego County with a map UI that will support hex (H3) and census tract geographies.

## How to run

```bash
npm install
npm run dev
```

## How to verify

```bash
npm run verify
```

## How to build

```bash
npm run build
```

## Python Data Pipeline (uv)

The tract data pipeline uses `uv` for dependency and environment management. `uv` keeps the project
environment synced, creates `.venv/`, and maintains `uv.lock`. The Python tract geometry build uses
detailed TIGER/Line tracts and erases proximate water areas before writing
`public/data/tracts/tracts.geojson`.

```bash
uv sync
uv run --env-file .env -- python scripts/py/build_tracts.py
```

If you prefer exporting the key manually:

```bash
export CENSUS_API_KEY=...
uv run -- python scripts/py/build_tracts.py
```
