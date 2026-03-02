<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone B3 — completed
- **Next milestone:** Milestone B4 — geography adapter and choropleth wiring

## Repository overview

This repo contains the San Diego Mosaic census dashboard project. The app target is a static web UI for
San Diego County with a map that supports both:

- **Hex bins (H3)**
- **Census tracts**

The browser app must use precomputed files under `public/data/` and must not call the Census API at
runtime.

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

## Milestone 0 changes

- Added root guidance in `AGENTS.md`.
- Added baseline repo docs in `README.md`.
- Added `.gitignore` entries for `.env*`, `node_modules`, `.venv`, `dist`, and Python cache files.
- Added Prettier + ESLint configuration and scripts.
- Added `scripts/verify.mjs` and `npm run verify`.
- Added CI workflow to run verify on push/PR.

## Milestone A1 changes

- Bootstrapped Vite + React setup in existing repo.
- Added `dev`, `build`, `preview` scripts while retaining format/lint/verify scripts.
- Added minimal entry files and folder skeleton for `src/app`, `src/components`, `src/data`, `src/ui`.

## Milestone A2 changes

- Added Tailwind + PostCSS wiring and imported styles in app entry.
- Added minimal Tailwind classes in the placeholder app UI.

## Milestone A3 changes

- Added centralized microcopy in `src/ui/microcopy.js`.
- Added shell UI components:
  - `MapShell`, `Sidebar`, `LegendCard`, `SelectionModeCard`
  - `Modal`, `WelcomeModal`, `AboutModal`, `DataSourcesModal`
- Wired app state for geography/selection mode/metric/year placeholders and modal behavior.
- Added welcome modal persistence via localStorage key:
  - `san-diego-mosaic.welcome-dismissed-v1`

## Milestone A3.1 changes

- Refactored layout to viewport-fixed shell.
- Anchored overlay cards to map area corners/edges.
- Used `pointer-events-none` overlay wrapper and `pointer-events-auto` card containers for future map
  interaction passthrough.

## Milestone B1 changes

- Installed mapping dependencies: MapLibre + react-map-gl + deck.gl packages + d3 helpers + h3-js.
- Updated `MapShell` to render MapLibre basemap + DeckGL overlay with shared controlled `viewState`.
- Kept deck layer as empty placeholder; no data loading yet.
- Imported MapLibre CSS in `src/main.jsx`.

## Milestone B2 changes

- Added synthetic mock data files under `public/data` for both geographies:
  - `public/data/years.json`
  - `public/data/variables.json`
  - `public/data/metadata.json`
  - `public/data/hexes/2023.json` (120 records with valid H3 indexes)
  - `public/data/tracts/tracts.geojson` (16 features with `properties.GEOID`)
  - `public/data/tracts/2023.json` (compact GEOID->values object map)
- Included required metric IDs:
  - `home_value_median` (currency)
  - `poverty_rate` (ratio of `poverty_below / poverty_universe`)
- Included metadata requirements:
  - years list
  - region default view
  - `h3_resolution`
  - quantiles for hex + tract for both metric IDs
  - 2023 averages

## Milestone B3 changes

- Added `src/data/loadData.js` with async data loading functions:
  - `loadYears()`
  - `loadMetadata()`
  - `loadVariables()`
  - `loadHexYear(year)`
  - `loadTractGeometry()`
  - `loadTractYear(year)`
- Implemented in-memory caching:
  - singleton cache for years/metadata/variables/tract geometry
  - per-year cache map for hex data
  - per-year cache map for tract values
  - failed requests are evicted from cache so retries can succeed
- Implemented BASE_URL-aware path resolution for GitHub Pages/subpath deploys:
  - resolves data paths via `import.meta.env.BASE_URL` and fetches `${base}data/...`
- Added clear fetch error messages:
  - network errors include the requested URL
  - HTTP failures include requested URL + status code + status text
- Kept this milestone scoped to loader utilities only; no UI, map shell, or layer wiring changes.

## Commands run and results (latest milestone)

- `npm run verify`: initially failed on ESLint in `src/data/loadData.js` (`fetch` undefined).
- Updated loader to use `globalThis.fetch(...)`.
- `npm run verify`: passed.
- Final validation state:
  - `npm run verify`: passed.
  - Includes `npm run build` pass inside verify.
  - Vite emitted non-blocking warnings (loaders.gl browser external warning and large chunk warning).

## Decisions made (latest milestone)

- Used promise-based caches so repeated calls avoid duplicate fetches and in-flight requests are shared.
- Used per-year cache maps for hex and tract values to keep year datasets isolated.
- Used `import.meta.env.BASE_URL` normalization to keep fetch paths compatible with GitHub Pages subpaths.
- Kept B3 scoped to `src/data/loadData.js` only; no UI or map rendering changes.

## Known issues / follow-ups

- Bundle size warning exists after deck.gl/maplibre additions; optimization can be addressed later if needed.
