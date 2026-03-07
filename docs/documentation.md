<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone F1 — tract pipeline (completed)
- **Next milestone:** Milestone F2 — hex pipeline

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

## Milestone C2 changes

- Added single-selection state in `src/app/App.jsx`:
  - `selectedIdsByGeo = { hex: [], tract: [] }`
  - selection is stored separately per geography mode.
- Passed current-mode selection props into `MapShell`:
  - `selectionMode`
  - `selectedIds={selectedIdsByGeo[geoMode]}`
  - `onSelectedIdsChange`
- Added click handling in `src/components/MapShell.jsx` using `getPickedId(geoMode, info)`:
  - in `selectionMode === "single"`:
    - click on a feature sets selected IDs to `[id]`
    - click on empty map clears selected IDs to `[]`
  - in `selectionMode === "multi"`:
    - click is a no-op (reserved for C3 brush flow)
- Added selected-outline highlight layers for both geographies:
  - hex selected layer:
    - built by looking up selected IDs in `hexYearIndex.byId`
  - tract selected layer:
    - built by filtering `tractsGeojson.features` against selected GEOID set
  - selected outlines are stronger than hover outlines
  - highlight layers are `pickable: false` so base choropleth layers continue to drive picking.
- Kept C2 scope strict:
  - no brush selection
  - no sidebar aggregation changes

## Milestone C3 changes

- Added rectangle brush selection for multi-select mode in `src/components/MapShell.jsx`.
- Implemented local brush interaction state in `MapShell`:
  - `isBrushing`
  - `brushStart`
  - `brushEnd`
- Added `DeckGL` ref (`deckRef`) and used `pickObjects(...)` on brush release:
  - rectangle bounds are computed in screen pixels
  - picks are constrained to active geography base layer via
    `layerIds: [getLayerId(geoMode)]`
  - picked objects are converted to unique IDs via
    `getIdsFromBrushPicks(geoMode, picks)`
  - results are saved through existing `onSelectedIdsChange(geoMode, ids)`
- Added pointer-based brush handlers (mouse/touch) for multi mode:
  - pointer down starts brushing
  - pointer move updates rectangle
  - pointer up finalizes selection
  - pointer cancel clears brush state
- Added brush rectangle overlay rendered as an absolute positioned div with
  `pointer-events: none` so zoom wheel/input passthrough is preserved.
- Interaction rules implemented:
  - in `selectionMode === "multi"`: drag-pan disabled via DeckGL controller options
  - in `selectionMode === "multi"`: scroll zoom remains enabled
  - in `selectionMode === "single"`: existing click-to-select behavior unchanged
  - in `selectionMode === "multi"`: click remains a no-op (tiny click-like brush gestures are ignored)
- Kept C3 scope strict:
  - no demographic aggregation/sidebar stats changes
  - no new dependencies

## Milestone D1 changes

- Updated docs scope requirements for D1:
  - `docs/prompt.md` now explicitly requires estimate ± MOE for selected and in-view sidebar summaries.
  - `docs/prompt.md` now explicitly allows N/A for aggregated medians until a distribution method exists.
  - `docs/plan.md` Milestone D now includes D1-specific bullets for active metric summaries + MOE support.
- Updated mock data contract for MOE-enabled testing:
  - `public/data/hexes/2023.json` records now include:
    - `home_value_median_moe`
    - `poverty_below_moe`
    - `poverty_universe_moe`
  - `public/data/tracts/2023.json` values now include the same MOE fields.
  - `public/data/variables.json` metrics now include MOE metadata and aggregation hints:
    - direct metric: `moeKey`, `aggregation`
    - ratio metric: `numeratorMoeKey`, `denominatorMoeKey`, `moeMethod`, `aggregation`
- Added MOE utility module:
  - `src/data/moe.js`
  - functions:
    - `rssMoe(moes)`
    - `moeRatio(X, MOE_X, Y, MOE_Y)`
    - `moeProportion(X, MOE_X, Y, MOE_Y)` with fallback to ratio form when proportion discriminant is negative
- Added metric stats module:
  - `src/data/metricStats.js`
  - computes estimate + MOE for:
    - single record
    - aggregate record set (sum, ratio/proportion, median with multi-record N/A note)
  - includes formatting helpers for currency, percent, and number outputs.
- Added MOE tests:
  - `src/data/moe.test.mjs`
  - covers RSS, ratio/proportion formulas, fallback behavior, and null guards.
- Updated map visibility reporting (Option A in-view):
  - `src/components/MapShell.jsx` now accepts optional `onVisibleIdsChange(geoMode, ids)`.
  - Added debounced (280ms) full-viewport `deckRef.pickObjects(...)` using active base layer ID.
  - Dedupes picks with `getIdsFromBrushPicks(geoMode, picks)`.
  - Emits visible IDs only when changed to avoid render loops.
  - Triggered by geo/year/data/view changes.
- Updated app state wiring:
  - `src/app/App.jsx` now tracks `visibleIdsByGeo = { hex: [], tract: [] }`.
  - passes current geo mode `visibleIds`, `selectedIds`, `activeMetric`, and `geoMode` into sidebar.
- Updated sidebar summaries:
  - `src/components/Sidebar.jsx` now loads/indexes year data via cached loaders (`loadHexYear`, `loadTractYear`, `indexYearData`).
  - Added top **In view** section for active metric/year showing estimate ± MOE.
  - Updated **Selected area** section to show estimate ± MOE for current metric:
    - 0 selected -> existing no-selection message
    - 1 selected -> estimate ± MOE
    - N selected -> aggregated estimate ± MOE (or N/A note for median aggregation)
- Kept D1 scope strict:
  - did not add per-row values for every metric (reserved for D2)
  - did not add demographic aggregation panels beyond active metric summaries.

## Milestone D2 changes

- Updated `src/app/App.jsx`:
  - added `metricDefinitionsById` memo keyed by metric ID for the current geo mode.
  - passed `metricDefinitionsById` into `Sidebar` so per-row values can use full metric definitions.
- Updated `src/components/Sidebar.jsx`:
  - added `metricDefinitionsById` prop.
  - added memoized `selectedStatsByMetricId` computed from `selectedRecords` using
    `computeAggregateMetricStats(...)` from `src/data/metricStats.js`.
  - metric rows now show selected-area estimate and `± MOE` per enabled metric.
  - zero-selection row state is now consistent placeholder output (`—`) without per-row MOE lines.
  - for multi-record median metrics (`aggregation === "median"`), row output is placeholder
    (`—`, `± —`) with note text (`Aggregated medians not implemented yet.`).
- Kept D2 scope strict:
  - no `MapShell` interaction changes
  - no in-view per-row expansion (active metric only remains from D1)
  - no new dependencies added.
- Updated planning log:
  - `docs/plan.md` D2 checklist and validation checklist marked complete.

## Commands run and results (Milestone D1)

- `node --test src/data/moe.test.mjs`: passed.
- `npm run build`: passed.
  - Non-blocking warnings:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - large chunk size warning
- `npm run verify`: initially failed due formatting/lint while integrating D1.
- Applied fixes:
  - Prettier formatting updates
  - `globalThis.setTimeout/clearTimeout` for lint-safe timer usage
  - null-guard normalization in MOE/stat helpers
- `npm run verify`: passed.
  - Includes `format:check`, `lint`, and `build`.
  - Build still emits same non-blocking warnings listed above.

## Decisions made (Milestone D1)

- MOE formulas:
  - sums use RSS (`rssMoe`)
  - derived rates use ACS-style ratio/proportion formulas
  - proportion MOE falls back to ratio MOE when discriminant is negative.
- Median aggregation policy:
  - single-record median shows estimate ± MOE
  - multi-record selected/in-view medians show N/A with note until distribution-based aggregation is implemented.
- In-view debounce strategy:
  - used debounced full-viewport `pickObjects` updates (~280ms) and emit-on-change ID comparison to avoid render loops.
- Documentation scope decision (Step 0):
  - explicitly codified estimate ± MOE + in-view summary requirements in `docs/prompt.md`
  - split Milestone D planning into D1 (active metric summaries + MOE) and D2 (per-row/sidebar expansion).

## Commands run and results (Milestone D2)

- `node --test src/data/moe.test.mjs`: passed.
- `npm run build`: passed.
  - Non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run verify`: first run failed on formatting for `src/components/Sidebar.jsx`.
- `npx prettier --write src/components/Sidebar.jsx`: applied formatting fix.
- `npm run verify`: passed after formatting fix.
  - Includes `format:check`, `lint`, and `build`.

## Decisions made (Milestone D2)

- Reused `metricStats.js` as the only computation path for per-row selected metrics to avoid duplicated MOE logic.
- Kept no-selection row output minimal and consistent (`—`) across metric rows.
- For median aggregation over multiple selected records, kept explicit placeholder behavior instead of a weighted approximation until distribution-based logic is implemented.

## Milestone E changes

- Updated `src/app/App.jsx` to implement full choose-for-me behavior for both geographies:
  - uses active `geoMode`, `year`, and `activeMetric`.
  - builds candidates from year-indexed records (`hex` and `tract`) using cached loader data.
  - computes per-record estimate/MOE via `computeRecordMetricStats(...)`.
  - filters non-finite estimates.
  - randomly picks high vs low each click.
  - selects randomly within extreme candidates (top/bottom ~2%).
  - for smaller datasets, falls back to quantile edge buckets from `metadata.quantiles[geoMode][metricId]`.
  - forces `selectionMode` to `single` and sets `selectedIdsByGeo[geoMode] = [id]`.
- Added choose-for-me fly-to wiring:
  - `MapShell` now accepts `flyToTarget`.
  - applies `FlyToInterpolator` with ~1200ms transition for center animation.
- Replaced the choose placeholder banner with a real callout in `App.jsx`:
  - includes High/Low label, active metric label, selected estimate ± MOE, and county average.
  - supports dismiss via `X`.
  - updates each time choose-for-me runs.
  - dismisses when selection changes away from the chosen feature.
- Updated tract center fallback in `src/data/geography.js`:
  - if centroid properties are unavailable, computes a safe bbox-midpoint centroid from the selected tract feature geometry.
- Updated planning log:
  - `docs/plan.md` Milestone E checklist, acceptance, and validation checkboxes marked complete.

## Commands run and results (Milestone E)

- `npm run build`: passed.
  - Non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run verify`: first run failed on formatting in `src/app/App.jsx`.
- `npx prettier --write src/app/App.jsx src/components/MapShell.jsx src/data/geography.js`: applied formatting fix (`App.jsx` changed; others unchanged).
- `npm run verify`: passed after formatting fix.
  - Includes `format:check`, `lint`, and `build`.
  - Build emitted the same non-blocking warnings listed above.

## Decisions made (Milestone E)

- Chose a small-dataset threshold of fewer than 50 finite records before switching to quantile-edge fallback instead of percentile slicing.
- County average lookup prefers geography-specific averages (`averages[geoMode][year][metricId]`) and falls back to county-wide year averages (`averages[year][metricId]`).
- Implemented tract center fallback directly in `getCenterLngLat(...)` so both choose-for-me and future center lookups share the same safe behavior.

## Milestone F1 changes

- Added uv-managed Python pipeline scaffolding at repo root and `scripts/py/`:
  - `pyproject.toml` with tract-pipeline dependencies.
  - generated `uv.lock`.
  - new pipeline modules:
    - `scripts/py/config.py`
    - `scripts/py/build_tracts.py`
    - `scripts/py/utils_io.py`
    - `scripts/py/utils_geo.py`
    - `scripts/py/utils_acs.py`
- Implemented tract-only real data build flow (no hex generation in F1):
  - pulls ACS 5-year tract estimates + MOEs for 2023 (San Diego County) via `pytidycensus`.
  - downloads TIGER tract geometry, filters to `STATEFP=06`, `COUNTYFP=073`, simplifies geometry, and writes representative-point centroids.
  - writes app-compatible files:
    - `public/data/years.json`
    - `public/data/variables.json`
    - `public/data/metadata.json`
    - `public/data/tracts/tracts.geojson`
    - `public/data/tracts/2023.json`
- Added in-script validation at end of `build_tracts.py`:
  - non-empty tracts assertion
  - 11-digit GEOID assertions
  - required metric key assertions per record
- Updated `README.md` with uv workflow commands (`uv sync`, `uv run --env-file .env -- python scripts/py/build_tracts.py`) and uv environment behavior.
- Updated `eslint.config.mjs` to globally ignore `.venv/**` so JS linting does not traverse third-party files created by uv.

## Commands run and results (Milestone F1)

- `uv sync`:
  - first attempt failed because `pytidycensus` latest dependency chain required building `fiona`/GDAL on this environment.
  - resolved by pinning `pytidycensus==0.1.8` and `pandas<3.0`, then rerunning `uv sync`.
  - final result: passed, `.venv` created and `uv.lock` generated.
- `uv run --env-file .env -- python scripts/py/build_tracts.py`:
  - first attempt failed due API mismatch (`PytidyCensus` import) with pinned version.
  - fixed by using module-level `pytidycensus.get_acs(...)`.
  - second attempt failed with pandas 3.x compatibility inside `pytidycensus`.
  - after pandas pin (`<3.0`), rerun passed and wrote real tract outputs.

## Decisions made (Milestone F1)

- Pinned `pytidycensus` to `0.1.8` to avoid GDAL/Fiona build failures from newer transitive dependencies on this platform.
- Pinned `pandas` to `<3.0` because `pytidycensus 0.1.8` triggers a runtime error with pandas 3.x during ACS post-processing.
- Preserved existing `metadata.quantiles.hex` and `metadata.averages.hex` in F1 so the current hex UI continues to load while tract data is made real.
- Computed tract quantiles from the configured/latest tract year output and county reference averages from county-level ACS values as required.

## Known issues / follow-ups

- Bundle size warning exists after deck.gl/maplibre additions; optimization can be addressed later if needed.
