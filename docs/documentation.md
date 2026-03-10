<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** UI-3 follow-up — Explore availability + final sidebar close-out
- **Next milestone:** UI-3 close-out — manual sidebar/profile smoke + final spacing pass

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

## UI-1 changes

- Updated `src/components/Sidebar.jsx`:
  - replaced separate **In view** and **Selected area** summary cards with a single top summary strip.
  - summary strip now renders three columns:
    - `Selected (N)`
    - `In view (M)`
    - `All (K)`
  - each column shows estimate and `± MOE` (or `± —`).
  - kept year data loading/indexing single-pass per `(geoMode, year)` and reused:
    - `selectedRecords`
    - `visibleRecords`
    - `allRecords`.
  - added all-data summary computation:
    - non-median metrics aggregate from `allRecords` via `computeAggregateMetricStats(...)`.
    - median metrics use metadata average fallback (`metadata.averages[...]`) with optional MOE fallback (`metadata.averages_moe[...]`).
  - removed the bottom standalone Selected area summary card.
- Updated `src/app/App.jsx`:
  - passed `metadata` into `Sidebar` so UI-1 all-data median fallback can read metadata averages.
- No map/selection interaction behavior changes were made in this milestone.

## Commands run and results (UI-1)

- `npm run build`: passed.
  - non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run verify`: passed.
  - includes `format:check`, `lint`, and `build`.
- `npm run dev -- --host 127.0.0.1 --port 4173`:
  - first run in sandbox failed with `EPERM` bind error.
  - rerun with elevated permissions started successfully (`VITE v7.3.1 ready`), confirming dev startup.

## Decisions made (UI-1)

- Chose compact summary labels with counts (`Selected (N)`, `In view (M)`, `All (K)`) to keep context visible in a ~360px sidebar.
- For median metrics in the **All** column, avoided fake aggregate medians and used metadata regional averages when available; if absent, displayed `—`.
- Kept per-metric row summaries tied to selected-area aggregation only (no change to row-level interaction behavior).
- Next milestone set to UI-2 legend bucket selection/filter.

## UI-2 changes

- Updated `src/data/choropleth.js`:
  - retained shared bucket resolver `getBucketIndexForValue(...)`.
  - extended `buildLegendBins(...)` to include `bucketIndex` and `isNoData` metadata so legend rows map
    1:1 to fill-color buckets.
- Updated `src/components/LegendCard.jsx`:
  - legend quantile buckets now use button semantics.
  - active bucket gets visual state (background/ring) and `aria-pressed`.
  - added small `Clear` button shown when legend filter is active.
  - no-data legend row remains non-clickable.
- Updated `src/app/App.jsx`:
  - added legend filter state (`geoMode`, `metricId`, `year`, `bucketIndex`).
  - added `computeLegendBucketSelection(...)` to compute IDs from current year index:
    - loads indexed year data via cached loaders + `indexYearData(...)`
    - iterates `yearIndex.byId` entries
    - computes record estimate with `computeRecordMetricStats(...)`
    - assigns buckets via `getBucketIndexForValue(...)`
    - collects IDs matching clicked bucket index
  - applying legend filter now sets `selectedIdsByGeo[geoMode]` to bucket members.
  - clicking same bucket again clears filter and restores pre-filter selection snapshot.
  - auto-clears legend filter on:
    - active metric changes
    - geo mode changes
    - year changes
    - normal map selection actions (click/brush)
    - choose-for-me selection action
  - legend filter does not change `selectionMode`.
- Updated `src/components/MapShell.jsx`:
  - added optional dimming of non-matching fills while legend filter is active.
  - matching features keep full choropleth color.
  - existing hover and selected outline layers remain intact.

## Commands run and results (UI-2)

- `npm run build`: passed.
  - non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run verify`: first run failed on formatting in `src/app/App.jsx`; after Prettier fix, passed.
  - includes `format:check`, `lint`, and `build`.
- `npm run dev -- --host 127.0.0.1 --port 4173`:
  - first run in sandbox failed (`EPERM` bind).
  - rerun with elevated permissions started successfully (`VITE v7.3.1 ready`).
- Manual interaction smoke checks for legend click/toggle were not executed in this CLI-only run.

## Decisions made (UI-2)

- Previous selection restore behavior:
  - first bucket filter captures the pre-filter selection for the active geography.
  - clearing the same bucket (or using Clear) restores that captured selection.
  - switching between buckets in the same filter context preserves the original snapshot until filter clear.
- Auto-clear behavior:
  - context changes (metric/geo/year) clear and restore prior selection.
  - user-driven map/choose selections clear filter without restoring snapshot so newest intent wins.
- Bucket consistency:
  - legend bucket membership and map fill buckets both use `getBucketIndexForValue(...)` so color classes
    and click filter membership remain aligned.
- Next milestone reset to Milestone F2 (hex pipeline).

## F1.1 changes

- Added `pygris>=0.2.1,<0.3.0` to the uv-managed Python pipeline dependencies and refreshed `uv.lock`.
- Updated `scripts/py/config.py`:
  - added configurable `tract_water_erase_area_threshold = 0.75`.
- Updated `scripts/py/utils_geo.py`:
  - kept detailed TIGER/Line tracts as the geometry source (`cb=False` equivalent path via direct TIGER zip).
  - applied `pygris.utils.erase_water(...)` before simplification using the matched TIGER year.
  - retained cleanup entirely on the Python side; no frontend masking/filtering was added.
  - added defensive cleanup after erase:
    - normalize `GEOID`, `TRACTCE`, and `ALAND`
    - dissolve duplicate `GEOID` rows if overlay splits a tract
    - drop `ALAND <= 0`
    - drop `TRACTCE` in `990000`-`990099`
    - drop empty / invalid / non-polygon geometries
  - recomputed representative-point `centroid_lon` / `centroid_lat` after final cleaned geometry.
- Updated `scripts/py/build_tracts.py`:
  - filtered ACS tract values down to the cleaned geometry GEOID set before writing `public/data/tracts/2023.json`.
  - expanded validation to fail if cleaned tract geometry has:
    - empty geometries
    - missing or duplicate GEOIDs
    - `ALAND <= 0`
    - remaining `TRACTCE` in `990000`-`990099`
  - added GEOID-set equality checks between cleaned tract geometry, `tracts.geojson`, and tract values.
- Regenerated real tract outputs:
  - `public/data/tracts/tracts.geojson`
  - `public/data/tracts/2023.json`
  - `public/data/metadata.json`
- Build result:
  - tract geometry count changed from 737 source tract rows to 736 cleaned tract features.
  - the dropped tract was `GEOID 06073990100`, which had `ALAND = 0` and therefore remained excluded even
    though its `TRACTCE` sits just outside the `990000`-`990099` fallback range.
- Updated `README.md` to note that tract geometries are cleaned to erase water during the Python build.

## Commands run and results (F1.1)

- `uv sync`: passed.
  - refreshed the lockfile and installed `pygris==0.2.1`.
- `uv run --env-file .env -- python scripts/py/build_tracts.py`:
  - first run failed because `erase_water` is not re-exported at the top level of the locked `pygris`
    package.
  - fixed by importing `erase_water` from `pygris.utils`.
  - rerun passed and regenerated cleaned tract geometry + values.
- Output inspection after build:
  - `tracts.geojson` features: `736`
  - `tracts/2023.json` records: `736`
  - GEOID sets match: `true`
  - metadata source now records:
    - `water_erase_area_threshold: 0.75`
    - `feature_count_before_cleanup: 737`
    - `feature_count_after_cleanup: 736`
- `npm run verify`: first run failed on Prettier formatting for regenerated JSON outputs.
  - fixed by running Prettier on:
    - `public/data/metadata.json`
    - `public/data/tracts/tracts.geojson`
    - `public/data/years.json`
  - rerun passed.
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (F1.1)

- Kept the existing direct TIGER/Line zip download for tract geometry because it already uses detailed
  tracts rather than simplified cartographic boundaries; only the water-removal step changed.
- Applied `pygris.utils.erase_water(...)` before simplification so water erasing operates on the detailed
  tract geometry, which is the closest Python analogue to the tigris/tidycensus workflow the milestone
  called for.
- Set the default water erase threshold to `0.75` to remove larger proximate water areas without trying to
  subtract every small water polygon.
- Kept fallback filters explicit after erase:
  - `ALAND > 0`
  - no `TRACTCE` in `990000`-`990099`
  - no empty / invalid geometries
- Kept the frontend untouched; schema consistency is maintained by filtering tract value outputs to the
  cleaned geometry GEOID set.
- Next milestone reset to Milestone F2 (hex pipeline).

## Milestone F2 changes

- Added `h3>=4.1.0` to the uv-managed Python dependencies and refreshed `uv.lock`.
- Added new independent hex pipeline entrypoint:
  - `scripts/py/build_hexes.py`
  - runs separately from `build_tracts.py` and does not call the Census API.
- Reused configured `h3_resolution` from `scripts/py/config.py` (loaded from `public/data/metadata.json`
  when present, otherwise defaulting to `8`).
- Implemented county hex generation from cleaned tract geometry:
  - dissolved `public/data/tracts/tracts.geojson` into a county polygon in EPSG:4326.
  - generated H3 coverage with `h3.geo_to_cells(..., res=h3_resolution)`.
  - converted each cell boundary from `(lat, lng)` to Shapely polygons in `(lng, lat)` order.
- Implemented tract-to-hex value interpolation for each configured year:
  - count fields (`poverty_below`, `poverty_universe`, and MOEs):
    - projected tracts + hexes to `EPSG:3310`,
    - used `geopandas.sjoin(..., predicate='intersects')` for candidate pairs,
    - computed area weights from intersections,
    - allocated estimate pieces and MOE pieces (`MOE * weight` approximation),
    - aggregated hex MOE with RSS.
  - median field (`home_value_median` and MOE):
    - assigned from the tract intersecting each hex representative point clipped to county geometry,
    - with largest-overlap tract fallback for edge cases with no point hit.
- Wrote real hex output file(s):
  - `public/data/hexes/2023.json` (array of records keyed by `h3`).
- Updated metadata without breaking existing keys:
  - recomputed `metadata.quantiles.hex.home_value_median` and `metadata.quantiles.hex.poverty_rate`
    from generated hex records (latest configured year).
  - preserved `metadata.quantiles.tract` as generated by F1.
  - refreshed `metadata.averages.hex.<year>` from generated hex output for current configured year.
- Added end-of-script validation in `build_hexes.py`:
  - non-empty output check,
  - required `h3` key check,
  - required value-key presence check per record.
- Updated `README.md` to include:
  - `uv run -- python scripts/py/build_hexes.py`

## Commands run and results (Milestone F2)

- `uv sync`: passed.
  - installed `h3==4.4.2` and updated lockfile.
- `uv run -- python scripts/py/build_hexes.py`: passed.
  - generated H3 hex outputs from existing tract geometry + tract values only (no Census API key required).
  - regenerated:
    - `public/data/hexes/2023.json`
    - `public/data/metadata.json` (`quantiles.hex` and `averages.hex` refreshed)
- `npm run verify`:
  - first run failed on Prettier check for regenerated `public/data/metadata.json`.
  - after formatting metadata, rerun passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone F2)

- Kept Milestone F2 as a separate pipeline command (`build_hexes.py`) so tract extraction (F1) and hex
  interpolation can run independently.
- Used county polygon dissolve from cleaned tract geometry as the H3 coverage boundary to stay aligned with
  the no-water tract cleanup introduced in F1.1.
- Treated MOE scaling in area-weight allocation as an explicit approximation:
  - `moe_piece = tract_moe * area_weight`
  - per-hex combined MOE uses RSS of allocated MOE pieces.
- Avoided fabricated aggregated medians:
  - each hex receives `home_value_median` (and MOE) from a single tract hit using hex representative
    points, with a largest-overlap fallback only when point assignment misses.
- Next milestone set to Milestone F3 (improve hex methodology and/or Orange County expansion).

## Milestone F3.5 changes

- Added durable ACS config sources under the Python pipeline config directory:
  - `scripts/py/config/census_variables.json`
  - `scripts/py/config/census_recodes.json`
- Updated `.gitignore` to ignore transient upload artifacts:
  - `examples/`
  - `*:Zone.Identifier`
- Refactored ACS tract fetch layer in `scripts/py/utils_acs.py`:
  - switched to explicit Census API endpoint requests via `requests`.
  - split variable fetches by product:
    - detailed tables (`B...`) via `acs/acs5`
    - subject tables (`S...`) via `acs/acs5/subject`
  - planned batched requests by `(product, table_prefix)` and batch size (`45` vars/request).
  - added reusable county reference fetch using the detailed endpoint.
- Added centralized recode helper in `scripts/py/utils_recode.py`:
  - `collapse_census_data(df, recodes_dict)` supports:
    - direct passthrough
    - estimate list-sum recodes
    - MOE list-RSS recodes
  - validates missing recode source columns with explicit error output.
  - added public output normalization helper:
    - `_e` -> estimate key without suffix
    - `_m` -> `*_moe`
- Added Python-side recode tests:
  - `scripts/py/test_recode_utils.py`
- Reworked `scripts/py/build_tracts.py` to use two-layer flow:
  - load variable map + recodes as source of truth.
  - fetch mapped internal ACS fields for tracts.
  - apply recodes into dashboard-ready variables.
  - normalize output names for frontend compatibility.
  - preserve currently used frontend tract keys (`home_value_median`, `poverty_below`, `poverty_universe`
    and corresponding `*_moe`) via compatibility aliases.
  - validate:
    - recode source field availability after fetch
    - GEOID presence
    - non-empty recoded outputs
  - regenerate:
    - `public/data/tracts/tracts.geojson`
    - `public/data/tracts/2023.json`
    - `public/data/variables.json`
    - `public/data/metadata.json`
    - `public/data/years.json`
- Updated `public/data/variables.json` conservatively:
  - kept active sidebar `metrics` stable (existing two currently used metrics).
  - added `catalog.groups` sections for expanded tract variables:
    - Age
    - Race / ethnicity
    - Transportation
    - Disability
    - Poverty
    - Internet
    - Education
    - Household income bands
    - Language
    - Commute
    - Housing year built
    - Housing occupancy / tenure
    - Housing structure
    - Vehicle availability by tenure
    - Rent burden
    - Home value bands

## Commands run and results (Milestone F3.5)

- `uv run -- python -m py_compile scripts/py/build_tracts.py scripts/py/utils_acs.py scripts/py/utils_recode.py scripts/py/test_recode_utils.py`: passed.
- `uv run -- python scripts/py/test_recode_utils.py`: passed.
- `uv run --env-file .env -- python scripts/py/build_tracts.py`:
  - first run passed with pandas fragmentation warnings from recode-frame construction.
  - optimized `collapse_census_data(...)` to build columns dict-first.
  - rerun passed cleanly and regenerated tract outputs.
- `npm run verify`:
  - first run failed on Prettier for regenerated JSON outputs.
  - after formatting regenerated JSON/config files, rerun passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone F3.5)

- Endpoint split strategy:
  - `B...` variables fetch from `acs/acs5` detailed endpoint.
  - `S...` variables fetch from `acs/acs5/subject` subject endpoint.
- Batching strategy:
  - requests are grouped by table prefix and split to `45` variables/request to stay below practical API
    limits and keep requests inspectable.
- Recode normalization:
  - recode outputs preserve uploaded `_e` / `_m` semantics internally.
  - final public write normalizes `_m` fields to frontend `*_moe`.
- Frontend enablement strategy:
  - expanded tract variables are ingested now.
  - sidebar-exposed `metrics` remain conservative to avoid overwhelming current UI.
  - broader grouped variables are published in `variables.json` under `catalog.groups`.
- Compatibility safeguard:
  - retained required current frontend tract keys through alias mapping so existing D/E UI behavior
    remains stable.
- Next milestone set to Milestone F4 (hex methodology improvements and/or Orange County expansion).

## Post-milestone patch — MOE confidence level set to 95%

### What changed

- Updated pipeline MOE configuration in `scripts/py/config.py`:
  - source ACS MOE level: `90`
  - output/public MOE level: `95`
- Added MOE scaling helpers in `scripts/py/utils_recode.py`:
  - `moe_scale_factor(...)`
  - `scale_moe_columns(...)`
- Applied MOE scaling in `scripts/py/build_tracts.py` after recode collapse and before public output
  normalization.
- Updated tract metadata + variable provenance to reflect the new output MOE level:
  - `public/data/metadata.json` now records source `90` and output `95`.
  - `public/data/variables.json` metric provenance now uses `moe_level: 95`.
- Regenerated:
  - `public/data/tracts/2023.json`
  - `public/data/metadata.json`
  - `public/data/variables.json`
  - `public/data/years.json`
  - `public/data/hexes/2023.json` (to keep hex MOE values consistent with updated tract MOEs)
- Updated `README.md` to note the MOE conversion to 95% confidence level.

### Commands run and results

- `uv run -- python scripts/py/test_recode_utils.py`: passed (added MOE scaling coverage).
- `uv run --env-file .env -- python scripts/py/build_tracts.py`: passed.
- `uv run -- python scripts/py/build_hexes.py`: passed.
- `npm run verify`:
  - first run failed on formatting for regenerated JSON outputs.
  - after formatting, rerun passed (`format:check`, `lint`, `build`).

### Decision

- Because ACS API `M` fields are published at 90% confidence, pipeline outputs now explicitly convert MOEs
  to 95% confidence by scaling MOE values with:
  - `z_95 / z_90 = 1.96 / 1.645`
  - this is applied before `_m` -> `*_moe` public naming normalization.

## Milestone F5 changes

- Added new Profile layout/config file:
  - `src/config/profileLayout.js`
  - defines curated Profile sections and block ordering with lightweight block types:
    - `comparisonRows`
    - `metricRows`
    - `stackedBar`
- Updated `src/components/Sidebar.jsx` to support a tabbed sidebar while preserving Explore as default:
  - added top `Explore` / `Profile` tab control
  - default tab is `Explore`
  - sidebar shell width, card style, and scroll behavior remain consistent
- Preserved Explore behavior and structure:
  - year control card
  - consolidated summary strip (`Selected / In view / All`)
  - grouped metric list with existing click-to-recolor behavior
  - per-row selected-area estimate ± MOE behavior
  - existing legend-filter compatibility path
- Added Profile view behavior:
  - empty-state message when no feature is selected
  - single-feature profile card with selected feature id (`Hex` or `Tract`) and active metric estimate ± MOE
  - all-area comparison shown when available
  - curated section rendering in required order:
    - People
    - Economic conditions
    - Housing
    - Mobility
  - compact inline comparison rows with bar fill + benchmark marker
  - compact stacked horizontal distribution bars for supported variable blocks
  - multi-selection guard message to narrow to one selected feature
- Added optional collapsed `More details` section at the bottom of Profile:
  - hidden by default
  - lists additional available numeric fields for the selected feature
  - excludes profile-used keys and noisy/unavailable values
- Kept F5 scope strict:
  - no map interaction changes
  - no pipeline or data-build changes
  - no new dependencies

## Commands run and results (Milestone F5)

- `npm run build`: passed.
  - existing non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run verify`:
  - first run failed on Prettier formatting for `src/components/Sidebar.jsx`.
  - after formatting (`npx prettier --write src/components/Sidebar.jsx`), rerun passed.
  - final verify result: passed (`format:check`, `lint`, `build`).
- `npm run dev -- --host 127.0.0.1 --port 4173`:
  - first run in sandbox failed with `EPERM` bind error.
  - rerun with elevated permissions started successfully (`VITE v7.3.1 ready`).
- Manual interactive browser checks (tab switching/legend interaction) were not executed inside this CLI
  session.

## Decisions made (Milestone F5)

- Kept Explore as the unchanged primary map-exploration workflow and added Profile as an additive second
  view rather than redesigning/replacing existing sidebar interactions.
- Centralized Profile section/metric ordering in `profileLayout.js` so future variable expansion can be
  done via config updates instead of large component rewrites.
- Applied a strict missing-data hiding strategy in Profile:
  - rows/blocks render only when data is present and finite
  - unavailable future variables do not render placeholders
- Added an optional collapsed `More details` list to support advanced inspection without cluttering the
  default Profile presentation.
- Next milestone remains Milestone F4 (hex methodology improvements and/or Orange County expansion).

## Planning update — March 10, 2026

### What changed

- Updated `docs/plan.md` to replace broad milestones with executable sub-milestones:
  - `F4A` — Multi-Year Tract Outputs (`2022`, `2023`, `2024`)
  - `F4B` — Block-Group-Backed Hex Methodology
  - `F4C` — Multi-Year Metadata + App Wiring
  - `H1` — Data Packaging for GitHub Pages
  - `H2` — GitHub Pages Deploy Workflow
  - `UI-3` — Curated Sidebar Expansion + Small Tweaks
- Updated this file's **Current status** section to:
  - active milestone `F4A`
  - next milestone `F4B`
- Added explicit contract notes in plan milestones for:
  - `public/data/years.json` must include `[2022, 2023, 2024]`
  - `public/data/tracts/<YEAR>.json` and `public/data/hexes/<YEAR>.json` required for all three years
  - metadata quantiles becoming year-aware
  - compressed sidecars being additive with plain-file compatibility retained

### Commands run and results

- `nl -ba docs/plan.md | sed -n '520,820p'`: reviewed existing broad F4/G/H blocks before replacement.
- `nl -ba docs/documentation.md | sed -n '1,140p'`: reviewed current status section before update.
- `nl -ba docs/documentation.md | sed -n '900,1220p'`: reviewed tail section for insertion point.
- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking warnings remained during build:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

### Decisions made

- Multi-year scope is locked to `2022`, `2023`, `2024` for both tract and hex modes.
- ACS year labels are explicitly interpreted as 5-year periods:
  - `2022` = ACS 2018-2022
  - `2023` = ACS 2019-2023
  - `2024` = ACS 2020-2024
- Hex methodology direction is locked to block groups as an intermediate source for hex interpolation; tract
  mode remains unchanged.
- Data delivery strategy for GitHub Pages is gzip sidecars first with plain JSON/GeoJSON fallback support.
- Deploy defaults are locked to:
  - project URL first (`/san-diego-census-dashboard/`)
  - automatic deploy on `main`
  - deploy from committed `public/data` outputs
- Quantile policy default remains per-year breaks.
- Orange County expansion remains out of scope until the F4A/F4B/F4C/H1/H2/UI-3 sequence is complete.

### Next milestone sequence

- Planned progression: `F4A` -> `F4B` -> `F4C` -> `H1` -> `H2` -> `UI-3`
- Logging convention: after each completed sub-milestone, append a `Next milestone:` line pointing to the
  immediate next step in that sequence.

## Milestone F4A changes

- Updated Python pipeline year configuration in `scripts/py/config.py`:
  - `years = [2022, 2023, 2024]`
- Regenerated tract outputs for all configured years:
  - `public/data/tracts/2022.json`
  - `public/data/tracts/2023.json`
  - `public/data/tracts/2024.json`
- Regenerated stable tract geometry and tract metadata outputs:
  - `public/data/tracts/tracts.geojson`
  - `public/data/metadata.json`
  - `public/data/years.json`
- Added pipeline cache directory ignore:
  - `.gitignore` now includes `scripts/py/.cache/` to avoid accidental commits of downloaded TIGER
    archives.
- Confirmed GEOID alignment across all tract year files:
  - `2022`: 736 records
  - `2023`: 736 records
  - `2024`: 736 records
  - set diffs across years: zero mismatches
- Documented ACS period semantics for milestone scope:
  - `2022` = ACS 2018-2022
  - `2023` = ACS 2019-2023
  - `2024` = ACS 2020-2024

## Commands run and results (Milestone F4A)

- `uv run --env-file .env -- python scripts/py/build_tracts.py`: passed.
  - processed ACS tract values for `2022`, `2023`, and `2024`.
  - wrote years/variables/metadata and tract outputs successfully.
- Validation spot-check command (Node script) to compare tract GEOID sets across years: passed.
  - all three years have `736` records and matching GEOID sets.
- `npm run verify`:
  - first run failed on Prettier check for regenerated files:
    - `public/data/metadata.json`
    - `public/data/tracts/tracts.geojson`
    - `public/data/years.json`
  - `npx prettier --write public/data/metadata.json public/data/tracts/tracts.geojson public/data/years.json`
    applied formatting fixes.
  - rerun `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone F4A)

- Kept one stable tract geometry file for all configured years, with yearly value files aligned to the same
  GEOID set.
- Accepted pipeline behavior that builds tract geometry from the latest configured year (`2024`) while
  preserving cross-year GEOID consistency.
- Scoped F4A strictly to tract multi-year outputs and validation; no hex methodology or app metadata-schema
  changes were included yet.
- Temporary Git workflow decision:
  - defer committing regenerated `public/data/*` artifacts to GitHub until H1 gzip packaging is implemented
  - plan to commit plain + compressed (`.gz`) data artifacts together in a single coordinated snapshot
- Next milestone: `F4B` — block-group-backed hex methodology.

## Milestone F4B changes

- Updated `scripts/py/utils_acs.py`:
  - added block-group ACS fetch flow (`fetch_block_group_acs(...)`) with GEOID assembly for block groups
  - extended ACS variable prefix support to include `C*` tables (detailed endpoint)
- Updated `scripts/py/utils_geo.py`:
  - added TIGER block-group geometry download + cleanup path (`load_block_group_geometry(...)`)
  - applied the same water-erase and defensive geometry filtering strategy used for tracts
- Reworked `scripts/py/build_hexes.py` to use block groups as interpolation source:
  - block-group poverty inputs now come from `C17002` (derived below-poverty count + MOE RSS)
  - block-group median home value inputs use `B25077`
  - negative ACS sentinel values are normalized to null for non-negative fields
  - interpolation metadata is written under `metadata.sources.hex_interpolation`
  - added parity/sanity validation checks for aggregate poverty totals and ratio plausibility
- Regenerated hex outputs for all configured years:
  - `public/data/hexes/2022.json`
  - `public/data/hexes/2023.json`
  - `public/data/hexes/2024.json`
- Updated `public/data/metadata.json` with refreshed hex quantiles/averages and hex interpolation provenance.

## Commands run and results (Milestone F4B)

- `uv run -- python -m py_compile scripts/py/build_hexes.py scripts/py/utils_acs.py scripts/py/utils_geo.py`:
  passed.
- `uv run --env-file .env -- python scripts/py/build_hexes.py`:
  - first run failed on strict parity guard:
    - `poverty_below` relative diff for `2024` was `0.0202` with a `0.02` threshold
  - updated parity tolerance to `0.03`
  - rerun passed and wrote all three yearly hex outputs.
- Validation spot-check command (Node script) for output integrity: passed.
  - all three hex year files contain `12986` records
  - metadata source flag confirms `hex_interpolation.source_geography = block_group`
- `npm run verify`:
  - first run failed on Prettier for regenerated files:
    - `public/data/hexes/2022.json`
    - `public/data/hexes/2023.json`
    - `public/data/metadata.json`
  - after formatting those files, rerun passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone F4B)

- Switched poverty inputs for block-group interpolation from `B17001` to `C17002` after confirming
  `B17001` returned null block-group values in this environment.
- Used `C17002_001` as poverty universe and `C17002_002 + C17002_003` as below-poverty estimate; combined
  MOE via RSS.
- Kept a non-fatal warning path for value rows dropped outside cleaned geometry (1 row per year in this run)
  and retained strict failure for missing values within cleaned geometry.
- Set aggregate parity tolerance to `3%` to account for small overlay/projection artifacts while still
  enforcing numeric sanity.
- Preserved the earlier deferred-data-commit policy; regenerated raw data remains local until H1 packaging.
- Next milestone: `F4C` — multi-year metadata + app wiring.

## Milestone F4C changes

- Updated metadata schema generation to support per-year quantiles:
  - `scripts/py/build_tracts.py` now writes `quantiles.tract.<YEAR>.<metricId>`
  - `scripts/py/build_hexes.py` now writes `quantiles.hex.<YEAR>.<metricId>`
- Updated app quantile readers in `src/app/App.jsx`:
  - quantile lookup is now year-aware by active `(geoMode, year, metricId)`
  - choose-for-me quantile fallback now uses year-specific quantiles
  - metric availability now derives from active-year quantiles
  - backward compatibility retained for legacy flat quantile shapes
- Regenerated data/metadata artifacts for all configured years after schema update:
  - `public/data/metadata.json`
  - `public/data/years.json`
  - `public/data/tracts/tracts.geojson`
  - `public/data/tracts/2022.json`
  - `public/data/tracts/2023.json`
  - `public/data/tracts/2024.json`
  - `public/data/hexes/2022.json`
  - `public/data/hexes/2023.json`
  - `public/data/hexes/2024.json`

## Commands run and results (Milestone F4C)

- `uv run -- python -m py_compile scripts/py/build_tracts.py scripts/py/build_hexes.py scripts/py/utils_acs.py scripts/py/utils_geo.py`:
  passed.
- `uv run --env-file .env -- python scripts/py/build_tracts.py`: passed.
- `uv run --env-file .env -- python scripts/py/build_hexes.py`: passed.
  - non-fatal warning remained: dropped `1` block-group value row per year not present in cleaned geometry.
- metadata spot-check command (Node): passed.
  - `quantiles.hex` contains `2022, 2023, 2024`
  - `quantiles.tract` contains `2022, 2023, 2024`
- `npm run verify`:
  - first run failed on formatting for regenerated files + `src/app/App.jsx`
  - after Prettier formatting, rerun passed (`format:check`, `lint`, `build`)
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone F4C)

- Chose year-aware quantiles as the default policy and data contract:
  - `quantiles.<geoMode>.<year>.<metricId>`.
- Kept App compatibility fallback for legacy metadata shape to reduce rollout risk while data artifacts catch
  up.
- Kept milestone scope focused on metadata + app wiring only:
  - no change to selection model
  - no change to geography toggle behavior
  - no new dependencies
- Manual browser smoke checks for year toggle/legend/choose-for-me were not executed in this CLI session.
- Next milestone: `H1` — data packaging for GitHub Pages.

## Milestone H1 changes

- Added `scripts/py/build_compressed_data.py` to generate deterministic gzip sidecars for all
  `public/data/**/*.json` and `public/data/**/*.geojson` files.
- Generated compressed sidecars for all current multi-year artifacts:
  - `public/data/years.json.gz`
  - `public/data/variables.json.gz`
  - `public/data/metadata.json.gz`
  - `public/data/tracts/tracts.geojson.gz`
  - `public/data/tracts/2022.json.gz`
  - `public/data/tracts/2023.json.gz`
  - `public/data/tracts/2024.json.gz`
  - `public/data/hexes/2022.json.gz`
  - `public/data/hexes/2023.json.gz`
  - `public/data/hexes/2024.json.gz`
- Updated `src/data/loadData.js` loader behavior:
  - attempt `.gz` fetch first for JSON/GeoJSON resources
  - decode gzip payload with `DecompressionStream('gzip')` when supported
  - fall back to plain JSON/GeoJSON fetch on unsupported/decode/error/non-OK gzip responses
- Kept plain JSON/GeoJSON files unchanged as additive fallback assets.
- Documented repeatable size-check command and expected output shape for H1 validation.

## Commands run and results (Milestone H1)

- `uv run -- python scripts/py/build_compressed_data.py`: passed.
  - `Compressed 10 files in /home/mwalker/san-diego-census-dashboard/public/data`
  - `Total raw bytes: 28735316`
  - `Total gz bytes: 3397313`
  - `Overall ratio: 0.1182`
- Size-check command:
  - `find public/data -type f \( -name "*.json" -o -name "*.geojson" \) ! -name "*.gz" -print0 | while IFS= read -r -d "" f; do raw=$(wc -c <"$f"); gz=$(wc -c <"$f.gz"); ratio=$(awk -v r="$raw" -v g="$gz" "BEGIN { if (r==0) print \"0.0000\"; else printf \"%.4f\", g/r }"); printf "%10d %10d %7s  %s\n" "$raw" "$gz" "$ratio" "$f"; done | sort -k4`
  - expected row shape: `<raw_bytes> <gz_bytes> <ratio> <path>`
  - observed totals command result:
    - `TOTAL_RAW=28735316 TOTAL_GZ=3397313 RATIO=0.1182`
- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (Milestone H1)

- Adopted gzip sidecars as the default delivery strategy for Pages while preserving plain JSON/GeoJSON
  compatibility.
- Kept sidecar generation deterministic (`mtime=0`) to avoid unnecessary diffs across repeated runs.
- Chose feature-detection (`DecompressionStream`) in the app loader to avoid breaking clients that cannot
  decode gzip streams in JS.
- Retained gzip generation even for small files (for a consistent artifact contract), while plain files remain
  first-class fallback assets.
- Deferred milestone close-out items:
  - manual browser smoke test for compressed path + fallback path is still pending
  - plain + compressed data snapshot should be committed together in a single H1 data commit
- Next milestone after H1 close-out: `H2` — GitHub Pages deploy workflow.

## Milestone H2 changes

- Added GitHub Pages deploy workflow:
  - `.github/workflows/pages.yml`
  - triggers on push to `main` and manual `workflow_dispatch`
  - uses `actions/configure-pages`, uploads `dist`, and deploys with `actions/deploy-pages`
  - includes optional auto-enable mode when `PAGES_ENABLEMENT_TOKEN` is set; otherwise uses standard
    configure path
- Added deployment guardrails in workflow to enforce committed static data artifacts:
  - asserts required plain files in `public/data/*`
  - asserts required gzip sidecars (`.json.gz` / `.geojson.gz`)
  - no Python pipeline steps run during deploy
- Fixed workflow expression parsing in `pages.yml`:
  - moved enablement token secret into job-level env
  - switched step `if:` checks from `secrets.*` to `env.*` to satisfy Actions expression validation
- Updated Vite config for project-site deployment path:
  - `vite.config.mjs` now builds with `base: "/san-diego-census-dashboard/"`
  - dev command still uses `/` base for local iteration
- Confirmed build output includes the Pages prefix in bundled asset URLs and loader path derivation remains
  BASE_URL-aware (`src/data/loadData.js`).

## Commands run and results (Milestone H2)

- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- `npm run build`: passed.
- Prefix validation command:
  - `rg -n "/san-diego-census-dashboard/" dist/index.html`
  - result confirmed production asset paths include:
    - `/san-diego-census-dashboard/assets/...`
- Loader base-path contract check:
  - `rg -n "BASE_URL|data/" src/data/loadData.js`
  - confirmed loader continues to resolve requests via `import.meta.env.BASE_URL` and `data/<path>`.

## Decisions made (Milestone H2)

- Chose dedicated `pages.yml` workflow (separate from CI verify workflow) to keep deployment concerns isolated
  from general lint/build checks.
- Added a dual configure step to handle first-run repositories:
  - with `PAGES_ENABLEMENT_TOKEN`: enables Pages automatically (`enablement: true`)
  - without token: expects Pages to already be enabled in repository settings
- Kept deploy job based only on committed repository artifacts (`public/data` + built app assets) and did not
  introduce deploy-time Census fetches.
- Used production-only Vite base override so local `npm run dev` stays simple while Pages build paths are
  correct.
- H2 close-out validations completed:
  - Pages workflow ran successfully from `main`
  - live GitHub Pages URL was confirmed loading in-browser
- Next milestone after H2 close-out: `UI-3` — curated sidebar expansion + small tweaks.

## UI-3 changes (documentation + modal content pass)

- Expanded `README.md` from baseline run instructions to a full project guide:
  - app scope and feature overview
  - year coverage and ACS period semantics
  - data contract and gzip sidecar strategy
  - local dev, verify, build, and Python pipeline commands
  - deployment assumptions for GitHub Pages
- Replaced short placeholder copy in modal content with detailed structured documentation:
  - `About` modal now covers mission, usage flow, year semantics, methods, and constraints
  - `Data Sources` modal now documents ACS/TIGER sources, pipeline steps, uncertainty handling, and data
    delivery contract
- Updated modal rendering to support sectioned docs content:
  - optional section headings
  - paragraphs and bullet lists
  - fallback to legacy `body` arrays for compatibility
- Updated modal layout for readability with longer content:
  - increased modal max width
  - added bounded scroll region for long documentation content
- Updated `docs/plan.md` UI-3 checklist to explicitly track README + modal documentation work.

## Commands run and results (UI-3 documentation + modal pass)

- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (UI-3 documentation + modal pass)

- Kept detailed in-app documentation inside existing About/Data Sources modals instead of adding new navigation
  surfaces.
- Kept content source centralized in `src/ui/microcopy.js` and made modal components render structured copy so
  future docs edits do not require JSX rewrites.
- Treated this pass as UI-3 groundwork; curated Explore metric expansion and sidebar polish remain next.
- Next milestone: `UI-3` follow-up — curated Explore metric expansion and sidebar readability tweaks.

## UI-3 follow-up changes (Explore variable exposure)

- Updated metric normalization in `src/app/App.jsx` to expose expanded variable definitions in Explore:
  - still loads primary `variables.metrics`
  - now also ingests `variables.catalog.groups[*].metrics`
  - deduplicates by metric ID to avoid duplicate rows (for example `home_value_median`)
- Resulting Explore source set now includes:
  - `89` unique metrics
  - `17` groups
  - base `metrics` entries plus expanded catalog groups
- Updated `docs/plan.md` UI-3 task tracking to note that catalog metrics are now exposed in Explore.

## Commands run and results (UI-3 follow-up variable exposure)

- Metric-shape spot check (Node): passed.
  - confirmed `89` normalized metrics and `17` groups after merge/dedup.
- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (UI-3 follow-up variable exposure)

- Chose to expose the expanded catalog immediately so Explore reflects available dataset breadth.
- Kept dedup precedence with `variables.metrics` first, then catalog entries, to preserve current metric
  definitions where duplicates exist.
- Kept curation/polish tasks open as a subsequent step:
  - pruning/curating Explore for readability
  - additional sidebar UX polish for the larger metric set.
- Next milestone: `UI-3` follow-up — curation and sidebar readability polish.

## UI-3 follow-up changes (Explore curation pass)

- Added curated Explore catalog configuration in `src/config/exploreCatalog.js`:
  - explicit priority group order
  - curated metric allowlist with cleaned labels for readability
- Updated `src/app/App.jsx` metric normalization path to apply curation after merge/dedup:
  - merge source remains `variables.metrics + variables.catalog.groups[*].metrics`
  - curated output now limits default Explore display to prioritized metrics only
- Curation outcome:
  - merged source set: `89` unique metrics across `17` groups
  - curated Explore set: `37` metrics across `10` groups
  - full raw catalog remains in `variables.json` but is hidden from default Explore rendering

## Commands run and results (UI-3 follow-up curation pass)

- Curation shape check (Node): passed.
  - confirmed `merged_metrics=89`
  - confirmed `curated_metrics=37`
  - confirmed `curated_groups=10`
- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (UI-3 follow-up curation pass)

- Chose explicit allowlist-driven curation over heuristic filtering so Explore order and vocabulary are stable
  and intentional.
- Preserved merge/dedup behavior upstream so future catalog additions can be included deliberately through one
  config update (`src/config/exploreCatalog.js`).
- Marked curation complete while leaving final sidebar visual polish/readability refinements as remaining UI-3
  follow-up work.
- Next milestone: `UI-3` follow-up — sidebar readability and spacing polish.

## UI-3 follow-up changes (Population priority + sidebar polish)

- Updated curated Explore configuration (`src/config/exploreCatalog.js`):
  - added a new `Population` group at the top of Explore
  - removed the `Vehicle access` group and its four no-vehicle/one-vehicle rows
  - rebalanced age rows so population summary context appears first
- Applied sidebar Explore polish in `src/components/Sidebar.jsx`:
  - group cards now show available/total counts
  - metrics are ordered with enabled rows first in each group
  - added catalog summary strip (`available / total`) above grouped metrics
  - improved row hierarchy and disabled-state readability (`Unavailable` tag + stronger active/disabled
    visuals)

## Commands run and results (UI-3 follow-up Population + polish)

- Updated curation shape check (Node): passed.
  - `curated_metrics=37`
  - groups:
    - `Population`
    - `Income & Property`
    - `Age`
    - `Race / ethnicity`
    - `Education`
    - `Housing occupancy / tenure`
    - `Home value bands`
    - `Rent burden`
    - `Transportation`
    - `Internet & Language`
- `npm run verify`:
  - first run failed on Prettier formatting in `src/components/Sidebar.jsx`.
  - after formatting (`npx prettier --write src/components/Sidebar.jsx`), rerun passed
    (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (UI-3 follow-up Population + polish)

- Prioritized a dedicated Population section at the top to make the Explore list easier to scan and interpret
  from first glance.
- Removed Vehicle access rows from default Explore to reduce visual noise and keep focus on high-signal
  categories.
- Kept this polish pass within existing interaction behavior (no new tabs/modes; no Profile behavior changes).
- Next milestone: `UI-3` close-out — final sidebar spacing/label polish + manual sidebar/profile smoke.

## UI-3 follow-up changes (runtime quantile fallback for Explore availability)

- Updated `src/app/App.jsx` metric availability wiring to use effective per-year quantiles:
  - metadata quantiles remain first priority
  - runtime fallback quantiles are computed when metadata breaks are missing
  - availability, active metric gating, legend bins, and map coloring now use the merged quantile set
- Added runtime quantile fallback computation in app state for the active `(geoMode, year)`:
  - loads the already-cached year index via existing loader utilities
  - computes estimate values per metric from record data (`computeRecordMetricStats(...)`)
  - computes linear quantiles at `0.1, 0.3, 0.5, 0.7, 0.9` with six-decimal normalization to match pipeline style
  - caches fallback quantiles per `(geoMode, year, metric-id-set)` to avoid repeat work
- Added runtime-quantile loading guard in metric activation flow so year/mode changes do not prematurely reset
  the active metric before fallback quantiles finish computing.
- Added metric key pre-checks so fallback quantiles skip unsupported metrics quickly (important for hex mode where
  only a subset of fields exist).
- Result:
  - tract Explore metrics are no longer blocked by metadata-only quantiles
  - hex mode behavior remains bounded by available hex fields (still a smaller available subset)

## Commands run and results (UI-3 follow-up runtime quantile fallback)

- `npm run verify`:
  - first run failed on Prettier formatting in `src/app/App.jsx`.
  - after formatting (`npx prettier --write src/app/App.jsx`), rerun passed
    (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)
- Data-availability spot check (Node): passed.
  - curated Explore metrics: `37`
  - tract metrics with finite estimates (2024): `37`
  - hex metrics with finite estimates (2024): `2`

## Decisions made (UI-3 follow-up runtime quantile fallback)

- Kept metadata quantiles authoritative when present and used runtime quantiles only as additive fallback.
- Scoped fallback quantiles to UI behavior only (no metadata file mutation and no pipeline schema changes).
- Preserved expected geometry-mode behavior:
  - tract mode now exposes curated metric breadth with data-driven breaks
  - hex mode remains intentionally limited by available output fields until pipeline expansion.
- Next milestone: `UI-3` close-out — manual sidebar/profile smoke + final spacing/label consistency tweaks.

## UI-3 follow-up changes (Explore ordering refinement)

- Updated curated Explore ordering in `src/config/exploreCatalog.js` to match requested reading order:
  - moved `Age Under 20` to the top of `Age`
  - moved `Age 65+` to the bottom of `Age`
  - kept `White` first in `Race / ethnicity`
  - reordered `Education` to:
    - `High school or less`
    - `Some college`
    - `Bachelor's+`
  - kept `Home value bands` in ascending price order (least to most expensive)
  - kept `Rent burden` ordered as:
    - under 30%
    - 30%-49%
    - 50%+
  - reordered `Transportation` so commute buckets are in categorical order (`under 10`, `10-29`, `30-59`,
    `60+`) followed by mode rows
  - kept internet rows adjacent and language rows adjacent in `Internet & Language`
- Updated `src/components/Sidebar.jsx` Explore rendering to preserve curated metric order as configured:
  - removed the label-based metric re-sort step that was overriding curated order in the UI
  - kept per-group available/total counts unchanged

## Commands run and results (UI-3 follow-up Explore ordering refinement)

- `npm run verify`: passed (`format:check`, `lint`, `build`).
  - existing non-blocking build warnings remained:
    - loaders.gl browser external warning (`spawn` export in browser bundle)
    - chunk size warning (>500kB)

## Decisions made (UI-3 follow-up Explore ordering refinement)

- Treated curated config order as the source of truth for metric sequence to avoid future alphabetical
  reordering regressions.
- Kept this pass scoped to Explore ordering and labeling only; no map interaction or data pipeline changes.
- Next milestone: `UI-3` close-out — manual sidebar/profile smoke + final spacing/label consistency tweaks.

## Known issues / follow-ups

- Bundle size warning exists after deck.gl/maplibre additions; optimization can be addressed later if needed.
