<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone C1 — completed
- **Next milestone:** Milestone C2 — click selection

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

## Milestone B4 changes

- Added `src/data/geography.js` to centralize geography-mode adapter logic and branching.
- Exported geography constants and metadata helpers:
  - `GEO_MODES`
  - `assertGeoMode(geoMode)`
  - `getGeoLabel(geoMode)`
  - `getGeoNoun(geoMode)`
  - `getGeoNounPlural(geoMode)`
  - `getIdKey(geoMode)` for `h3`/`GEOID`
  - `getLayerId(geoMode)` for `layer-hex`/`layer-tract`
- Added indexing and lookup utilities:
  - `indexYearData(geoMode, rawYearData)` -> `{ byId: Map, records: [] }`
  - `getFeatureId(geoMode, obj)`
  - `getPickedId(geoMode, pickInfo)`
  - `getRecordFromLayerObject(geoMode, layerObject, yearIndex)`
  - `getRecordById(geoMode, id, yearIndex)`
  - `getIdsFromBrushPicks(geoMode, picks)`
- Added center lookup utility:
  - `getCenterLngLat(geoMode, id, ctx)`
  - Hex mode computes centers via `h3-js` using `cellToLatLng` with fallback to `h3ToGeo`, returning
    `[lng, lat]`.
  - Tract mode prefers `ctx.tractsCentroids[GEOID]`, then falls back to
    `ctx.tractsGeojson.features[].properties.centroid_lon/centroid_lat`.
- Kept B4 scoped to adapter utilities only:
  - no changes to `MapShell`, `App.jsx`, `loadData.js`, or UI components.

## Milestone B5 changes

- Wired shared dataset loading in `src/app/App.jsx` using `src/data/loadData.js`:
  - `loadYears()`
  - `loadMetadata()`
  - `loadVariables()`
- Used `years.json` to drive year state:
  - normalize/validate available years
  - default selected year to latest year from loaded years list
  - keep year slider bound to loaded years
- Added mode-aware metric availability guardrails from `variables.json` + `metadata.quantiles`:
  - metrics not present in `variables.json` are hidden (not rendered)
  - metrics present but missing quantiles for current `geoMode` are disabled in sidebar
  - active metric auto-corrects to first available metric when mode/data changes
- Added choropleth utilities in `src/data/choropleth.js`:
  - quantile normalization
  - discrete palette bucket mapping
  - no-data dark fill color
  - legend bin generation from quantile breaks
- Updated `src/components/MapShell.jsx` to render data-driven deck.gl layers by geography:
  - hex mode: `H3HexagonLayer` using `loadHexYear(year)` and `indexYearData('hex', raw)`
  - tract mode: `GeoJsonLayer` using `loadTractGeometry()` + `loadTractYear(year)` and
    `indexYearData('tract', raw)`
  - tract geometry/value join via `getRecordFromLayerObject('tract', feature, tractYearIndex)`
- Implemented metric value computation from variables spec in map rendering path:
  - supports direct metrics (`type: "direct"` + `key`, and `source_field` compatibility)
  - supports ratio metrics (`type: "ratio"` + `num`/`den`, with `numerator`/`denominator`
    compatibility)
  - missing metric or missing/invalid record values map to no-data
- Updated `src/components/LegendCard.jsx`:
  - shows active metric label
  - shows formatted quantile bins from metadata quantiles (currency vs percent)
  - shows current geography subtext
  - shows minimal loading text while required data is fetching
- Updated `src/components/Sidebar.jsx`:
  - uses loaded year list for slider behavior
  - renders data-driven metric groups from `variables.json`
  - disables unavailable metrics for current mode
  - shows minimal loading text
- Kept B5 scope strict:
  - did not implement hover, click selection, or brush selection (Milestone C)
  - did not add new dependencies

## Milestone C1 changes

- Added hover state tracking per geography mode in `src/app/App.jsx`:
  - `hoverIdByGeo = { hex: null, tract: null }`
  - updates are stored independently per mode so toggling geography preserves each mode's hover state.
- Updated `src/components/MapShell.jsx` for hover picking:
  - choropleth layers are now `pickable: true` in both hex and tract modes
  - added DeckGL `onHover` handler
  - hover IDs are extracted via `getPickedId(geoMode, info)` from `src/data/geography.js`
- Added hover-only visual outlines without changing fill colors:
  - hex mode: added a separate hover `H3HexagonLayer` with outline styling for hovered hex
  - tract mode: added a separate hover `GeoJsonLayer` with thicker line styling for hovered tract
  - base fill/color logic remains unchanged
- Kept C1 scope strict:
  - no click selection
  - no brush selection
  - no sidebar stats changes

## Commands run and results (latest milestone)

- `npm run build`: passed.
  - Non-blocking warnings:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - large chunk size warning
- `npm run verify`: passed.
  - Includes `format:check`, `lint`, and `build`.
  - Build still emits same non-blocking warnings listed above.

## Decisions made (latest milestone)

- Used one DeckGL hover callback with `getPickedId(geoMode, info)` to keep hover ID parsing
  centralized in the geography adapter and avoid mode-specific parsing logic in the component.
- Implemented hover visualization with separate overlay layers (hex + tract) so hover only affects
  outlines and never alters choropleth fill color logic.
- Preserved milestone scope by deferring all click/selection/brush state to C2/C3.

## Known issues / follow-ups

- Bundle size warning exists after deck.gl/maplibre additions; optimization can be addressed later if needed.
