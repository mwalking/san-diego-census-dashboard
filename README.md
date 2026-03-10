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

Tract ACS expansion is configured in two JSON layers:

- raw fetch map: `scripts/py/config/census_variables.json`
- recode/collapse map: `scripts/py/config/census_recodes.json`

`build_tracts.py` fetches ACS variables in batches (split across detailed `B...` tables and subject
`S...` tables), recodes collapsed variables, converts ACS MOEs from 90% to 95% confidence level
(`1.96 / 1.645` scaling), and normalizes public MOE naming to the frontend convention (`*_moe`).

```bash
uv sync
uv run --env-file .env -- python scripts/py/build_tracts.py
uv run -- python scripts/py/build_hexes.py
```

If you prefer exporting the key manually:

```bash
export CENSUS_API_KEY=...
uv run -- python scripts/py/build_tracts.py
uv run -- python scripts/py/build_hexes.py
```
