
---

```md
<!-- docs/plan.md -->
# San Diego Mosaic — Execution Plan

This plan is written for Codex to execute step-by-step with small, verifiable milestones.

## North Star
Build a static census dashboard for **San Diego County** with:
- Dark basemap + deck.gl overlay
- Right sidebar: year slider + metric groups
- Top-left legend with quantiles
- Bottom-left selection mode control (single vs brush)
- Modals: Welcome, Data sources, About
- “Choose for me” jump-to-extreme + callout
- **Geography toggle:** Hex bins (H3) ↔ Census tracts

## Success criteria (MVP)
- `npm run dev`, `npm run build`, `npm run verify` pass
- Hex mode:
  - choropleth render + hover + click + brush
- Tract mode:
  - choropleth render + hover + click + brush
- Sidebar:
  - metric click recolors map
  - selection stats update (single/multi)
- Toggle:
  - switches geometry & legend quantiles
- Choose-for-me:
  - works in both modes and flies to center
- No runtime Census API calls from browser
- Data lives in `public/data/`

---

## Milestone 0 — Project memory, Codex steering, and baseline verification

### Objective
Before implementing UI or data features, establish durable project memory and a repeatable verify loop.

### Deliverables
- `docs/prompt.md`, `docs/plan.md`, `docs/implement.md`, `docs/documentation.md`
- `AGENTS.md` at repo root
- Prettier + ESLint configured
- `npm run verify` exists and passes
- CI workflow runs `npm run verify`

### Tasks
#### 0.1 Durable project memory files
- [x] Create/update:
  - [x] `docs/prompt.md`
  - [x] `docs/plan.md`
  - [x] `docs/implement.md`
  - [x] `docs/documentation.md`
- [x] Ensure documentation.md has:
  - how to run + verify
  - demo flow
  - decisions + known issues

#### 0.2 Codex repo instructions
- [x] Create `AGENTS.md` with:
  - read docs first
  - small diffs + validate + update docs/documentation.md
  - no new deps without noting
  - do not remove geo toggle requirement
  - no runtime Census API calls

#### 0.3 Repo hygiene
- [x] `.gitignore` covers: `.env*`, `node_modules`, `.venv`, `dist`, python caches
- [x] minimal `README.md` includes run/verify/build

#### 0.4 Tooling
- [x] Add Prettier:
  - [x] `.prettierrc` / config
  - [x] `.prettierignore`
  - [x] scripts: `format`, `format:check`
- [x] Add ESLint (minimal):
  - [x] config file
  - [x] script: `lint`
- [x] Add `npm run verify`:
  - must run `format:check` + `lint`
  - if a `build` script exists, run it; otherwise skip gracefully
  - recommended: `scripts/verify.mjs`

#### 0.5 CI
- [x] `.github/workflows/ci.yml` runs `npm run verify` on push/PR

#### 0.6 Log
- [x] Update `docs/documentation.md` with what changed + commands run

### Validation commands
- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm run verify`

---

## Milestone A — Web app skeleton + layout chrome (no real data)

### Objective
Create a working Vite+React+Tailwind app that matches the screenshot layout with placeholder content.

### Tasks
#### A1. Bootstrap Vite + React + Tailwind
- [x] Initialize Vite React app
- [x] Install Tailwind and verify it loads
- [x] Create folder structure:
  - [x] `src/app/`
  - [x] `src/components/`
  - [x] `src/data/`
  - [x] `src/ui/` (microcopy)

#### A2. Implement UI shells (static)
Create:
- [x] `src/app/App.jsx`
- [x] `src/components/MapShell.jsx` (placeholder map container ok)
- [x] `src/components/Sidebar.jsx`
- [x] `src/components/LegendCard.jsx` (must include geo toggle UI)
- [x] `src/components/SelectionModeCard.jsx`
- [x] `src/components/Modal.jsx`
- [x] `src/components/WelcomeModal.jsx`
- [x] `src/components/AboutModal.jsx`
- [x] `src/components/DataSourcesModal.jsx`

Add:
- [x] Welcome modal shows on first load; dismiss persists in localStorage
- [x] Navbar links open/close modals
- [x] Sidebar groups render with placeholder rows
- [x] Selection mode buttons render (single/multi)

### Acceptance checkpoint
- [ ] `npm run dev` renders the full layout without console errors
- [x] geo toggle UI exists and changes app state (even if map not wired yet)

### Validation commands
- [x] `npm run verify`
- [x] `npm run build` (once build exists)

#### A3.1 Responsive overlay layout fix (pre-step)
- [x] Refactor app shell to `h-screen w-screen overflow-hidden`
- [x] Reserve navbar height and keep map region filling remaining height
- [x] Anchor overlay cards to map area with absolute positioning:
  - [x] Legend: `top-4 left-4`
  - [x] Selection mode: `bottom-4 left-4`
  - [x] Sidebar: `top-4 right-4 bottom-4` with fixed-ish width
- [x] Use `pointer-events-none` overlay wrapper and `pointer-events-auto` per card
- [x] Validate with `npm run build` and `npm run verify`

---

## Milestone B — Map + dual overlays with mock data (hex + tract)

### Objective
Render a choropleth in both modes using small mock datasets and switch instantly with the geo toggle.

### Tasks
#### B1. Add mapping dependencies + basemap
- [x] Install:
  - `maplibre-gl`, `react-map-gl`
  - `@deck.gl/react`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox`
  - `d3-scale`, `d3-array`, `d3-format`
  - `h3-js`
- [x] Render MapLibre basemap with DeckGL overlay

#### B2. Add mock files
Create:
- [x] `public/data/years.json`
- [x] `public/data/variables.json`
- [x] `public/data/metadata.json` including:
  - quantiles per geography: `quantiles.hex.*`, `quantiles.tract.*`
  - county averages per year for key metrics
- [x] `public/data/hexes/2023.json` (50–300 hexes)
- [x] `public/data/tracts/tracts.geojson` (10–50 tracts)
- [x] `public/data/tracts/2023.json` (values keyed by GEOID)

#### B3. Implement loaders + caching
- [x] `src/data/loadData.js`:
  - load metadata, years, variables
  - load hex year
  - load tract geometry (once)
  - load tract year
  - cache everything in-memory

#### B4. Implement geography adapter (centralize mode logic)
- [x] `src/data/geography.js`:
  - get IDs, join tract values to geometry, compute centers

#### B5. Render choropleths
- [x] Hex mode uses `H3HexagonLayer`
- [x] Tract mode uses `GeoJsonLayer` and joins values by GEOID
- [x] Legend reads quantiles for current `(geoMode, metric)`
- [x] No-data is a dark fill

### Acceptance checkpoint
- [x] Toggle switches between hex and tract choropleths
- [x] Legend updates when toggling geo mode

### Validation commands
- [x] `npm run verify`
- [x] `npm run build`

---

## Milestone C — Hover + selection + brush selection (both modes)

### Objective
Implement hover highlight, click-to-select (single), and brush selection (multi) for both hex and tracts.

### Tasks
#### C1. Hover highlight
- [x] Track hover ID per geoMode
- [x] Highlight hovered feature:
  - hex outline or separate highlight layer
  - tract line color/width

#### C2. Click selection
- [x] Click sets selected IDs for current geoMode
- [x] Store selections separately per geography:
  - `selectedIdsByGeo.hex`, `selectedIdsByGeo.tract`

#### C3. Brush selection
- [x] Multi-select mode uses rectangle brush UI
- [x] On mouse up, call deck `pickObjects` with `layerIds=[activeLayerId]`
- [x] Deduplicate IDs and store in `selectedIdsByGeo[geoMode]`

### Acceptance checkpoint
- [x] Hover works in both modes
- [x] Click selection works in both modes
- [x] Brush selection works in both modes

### Validation commands
- [x] `npm run verify`
- [x] `npm run build`

---

## Milestone D — Sidebar metrics drive map + sidebar stats (single & aggregate)

### Objective
Make sidebar metric rows drive choropleth variable, and show selected-area demographics in sidebar.

### Tasks
#### D1. Active metric summaries + MOE
- [x] Add active-metric **In view** summary at top of sidebar (active metric/year).
- [x] Add active-metric **Selected area** summary with estimate ± MOE.
- [x] Support MOE math for sums and derived ratios/proportions.
- [x] For median aggregation over multi/in-view records, show N/A until distribution-based method is added.

#### D2. Per-row selected-area metric values + MOE
- [x] Sidebar metric rows show selected-area estimate for each enabled metric.
- [x] Sidebar metric rows show `± MOE` for each enabled metric when selection exists.
- [x] Computation is centralized through `src/data/metricStats.js` (no duplicated MOE math in Sidebar).
- [x] Aggregation behavior:
  - [x] sums/counts: sum estimate + RSS MOE
  - [x] ratios/proportions: aggregate numerator/denominator then derive estimate + MOE
  - [x] medians: single-record supported; multi-record aggregation shows placeholder (`—`)
- [x] Sidebar loads year data once per `(geoMode, year)`, indexes once, and reuses selected records across metrics.
- [x] Map interaction behavior remains unchanged.

### Acceptance checkpoint
- [x] Clicking a metric recolors map and updates legend
- [x] Sidebar shows correct values for single selection
- [x] Sidebar shows aggregate values for multi selection

### Validation commands
- [x] `npm run verify`
- [x] `npm run build`

---

## Milestone E — Choose for me (both modes)

### Objective
Implement “Choose for me” to select a high/low extreme feature and fly to it with a callout.

### Tasks
- [x] Choose logic:
  - filter non-null values
  - pick randomly among top/bottom ~1–2%
- [x] Fly-to:
  - hex center via h3-js
  - tract center via centroids (recommended) or geojson properties
- [x] Callout shows:
  - high/low descriptor
  - selected value
  - county average

### Acceptance checkpoint
- [x] Choose-for-me works in hex and tract modes

### Validation commands
- [x] `npm run verify`
- [x] `npm run build`

---

## UI-1 — Consolidated summary strip

### Objective
Replace separate **In view** and **Selected area** summary cards with one consolidated strip showing
Selected, In view, and All summaries for the active metric.

### Tasks
- [x] Replace top sidebar summary card with a 3-column strip:
  - [x] Selected
  - [x] In view
  - [x] All
- [x] Each column shows:
  - [x] label
  - [x] estimate
  - [x] `± MOE` (or `± —`)
- [x] Keep summary strip in the same location as the previous In view box.
- [x] Data behavior:
  - [x] Selected uses `selectedIds` and existing aggregation rules.
  - [x] In view uses `visibleIds` and existing aggregation rules.
  - [x] All uses all records in loaded dataset for current `(geoMode, year)`.
  - [x] For `aggregation === "median"` in All, use metadata region average fallback when available.
- [x] Sidebar loads/indexes year data once and reuses that index for selected/in-view/all record sets.
- [x] Do not change map interaction behavior.

### Acceptance checkpoint
- [x] Sidebar shows one consolidated summary strip with three columns.
- [x] Selected and In view summary behavior remains correct for zero/single/multi selections.
- [x] All summary computes from all records (with metadata fallback for median metrics).

### Validation commands
- [x] `npm run build`
- [x] `npm run verify`
- [x] `npm run dev` starts without runtime startup errors

---

## UI-2 — Clickable legend buckets

### Objective
When a user clicks a legend bucket, select all features in that bucket so map highlights and sidebar
stats update through the existing selection path.

### Tasks
- [x] Legend bucket click behavior:
  - [x] legend buckets are clickable buttons in `LegendCard.jsx`
  - [x] clicking a bucket applies a legend filter
  - [x] clicking the same active bucket clears filter and restores previous selection
  - [x] filter auto-clears on metric/geo/year changes
  - [x] filter auto-clears on normal map selection actions (click/brush)
- [x] Filter application:
  - [x] compute bucket-member IDs for current `(geoMode, year, metric, quantileBreaks, bucketIndex)`
  - [x] apply IDs to `selectedIdsByGeo[geoMode]`
  - [x] do not force-change `selectionMode`
- [x] Bucket consistency:
  - [x] use shared `getBucketIndexForValue(value, quantileBreaks)`
  - [x] ensure fill-color bucket mapping and legend bucket mapping are 1:1
- [x] Map highlighting:
  - [x] selected outline layers highlight all bucket members
  - [x] non-matching features are dimmed while legend filter is active
- [x] Legend affordance:
  - [x] active bucket visual state
  - [x] clear button shown when filter is active

### Acceptance checkpoint
- [x] Clicking a legend bucket highlights many matching features and updates sidebar selected stats.
- [x] Toggling off the same bucket restores prior selection state.
- [x] Bucket membership matches choropleth bucket colors.

### Validation commands
- [x] `npm run build`
- [x] `npm run verify`
- [x] `npm run dev` starts without runtime startup errors
- [ ] Manual smoke check:
  - click legend bucket -> selected count increases and sidebar stats update
  - click same bucket/Clear -> previous selection returns

---

## Milestone F1 — Real Tract Pipeline (San Diego County)

### Objective
Generate real tract-level ACS + TIGER outputs for San Diego County using a uv-managed Python pipeline.

### Outputs
- `public/data/years.json`
- `public/data/variables.json`
- `public/data/metadata.json` (quantiles per geography + averages)
- `public/data/tracts/tracts.geojson`
- `public/data/tracts/<YEAR>.json`

### Tasks
- [x] Add uv Python project config:
  - [x] `pyproject.toml`
  - [x] `uv.lock`
- [x] Add tract pipeline modules:
  - [x] `scripts/py/config.py`
  - [x] `scripts/py/build_tracts.py`
  - [x] `scripts/py/utils_io.py`
  - [x] `scripts/py/utils_geo.py`
  - [x] `scripts/py/utils_acs.py`
- [x] Use env var `CENSUS_API_KEY` (never commit keys)
- [x] Fetch ACS 5-year tract estimates + MOEs for:
  - [x] `home_value_median` (`B25077_001`)
  - [x] `poverty_below` (`B17001_002`)
  - [x] `poverty_universe` (`B17001_001`)
- [x] Write TIGER tract geometry in EPSG:4326 with:
  - [x] `properties.GEOID`
  - [x] `properties.centroid_lon`
  - [x] `properties.centroid_lat`
- [x] Validate outputs:
  - required keys present
  - no duplicate IDs
  - sanity checks on denominators
  - file sizes reasonable

### Acceptance checkpoint
- [x] Running the script produces files that the web app can load
- [x] At least one year fully works end-to-end

### Validation commands
- [x] `uv sync`
- [x] `uv run --env-file .env -- python scripts/py/build_tracts.py`
- [x] `npm run verify`

---

## Milestone F1.1 — Remove / Erase Water From Tract Geometries

### Objective
Clean San Diego County tract geometries in the Python pipeline so offshore and water-only tracts do
not appear as land in the app.

### Tasks
- [x] Keep detailed TIGER/Line tract geometry as the source before cleanup.
- [x] Add pygris water erasing in the tract geometry build path.
- [x] Make water erase area threshold configurable in `scripts/py/config.py`.
- [x] Add defensive post-erase tract filtering:
  - [x] drop `ALAND <= 0`
  - [x] drop `TRACTCE` in `990000`-`990099`
  - [x] drop empty / invalid geometries
  - [x] recompute representative-point centroids after final cleanup
- [x] Keep tract value outputs aligned to remaining geometry GEOIDs.
- [x] Add pipeline validation for:
  - [x] no empty geometries
  - [x] all remaining features have GEOID
  - [x] no remaining `TRACTCE` in `990000`-`990099`
  - [x] `ALAND > 0` for all remaining features

### Acceptance checkpoint
- [x] `public/data/tracts/tracts.geojson` regenerated from cleaned geometries.
- [x] `public/data/tracts/2023.json` remains aligned to the cleaned GEOID set.
- [x] No frontend/schema changes were required.

### Validation commands
- [x] `uv sync`
- [x] `uv run --env-file .env -- python scripts/py/build_tracts.py`
- [x] `npm run verify`

---

## Milestone F2 — Hex Pipeline Outputs (San Diego County)

### Objective
Generate real hex-level data outputs from tract/census inputs and wire them into `public/data/hexes`.

### Outputs
- `public/data/hexes/<YEAR>.json`
- `metadata.quantiles.hex.*` and `metadata.averages.hex.*` from real pipeline output

### Tasks
- [x] Add hex generation script/module (compatible with F1 config and uv workflow)
- [x] Interpolate/aggregate tract estimates onto configured H3 resolution
- [x] Carry through required estimate + MOE fields for active metrics
- [x] Write `public/data/hexes/<YEAR>.json` for configured years
- [x] Recompute `metadata.quantiles.hex` for enabled metrics
- [x] Validate file contract and map render compatibility

### Acceptance checkpoint
- [x] Hex files are generated and load in app without schema changes
- [x] Hex quantiles/averages are real pipeline outputs (not mock)

### Validation commands
- [x] `uv sync`
- [x] `uv run -- python scripts/py/build_hexes.py`
- [x] `npm run verify`

---

## Milestone F3.5 — Expand Tract Variables With ACS Map + Recodes

### Objective
Expand tract pipeline variables using uploaded ACS variable map + recode definitions while preserving the
existing frontend schema and interaction behavior.

### Tasks
- [x] Add durable ACS config files:
  - [x] `scripts/py/config/census_variables.json`
  - [x] `scripts/py/config/census_recodes.json`
- [x] Implement two-layer tract pipeline flow:
  - [x] fetch layer loads raw ACS map and fetches mapped internal columns by GEOID
  - [x] recode layer collapses dashboard variables from mapped columns
- [x] Add split fetch planning:
  - [x] detailed `B...` variables via `acs5` endpoint
  - [x] subject `S...` variables via `acs5/subject` endpoint
  - [x] batching by table prefix and variable limit
- [x] Add centralized recode helper (`collapse_census_data`) with tests.
- [x] Preserve frontend-compatible tract output schema:
  - [x] include existing required frontend fields
  - [x] normalize `_m` recode outputs to `*_moe` in public JSON
- [x] Update `public/data/variables.json` with conservative catalog grouping for expanded variables.
- [x] Keep scope strict to tract-variable expansion only (no new frontend interactions, no OC expansion,
  no hex methodology changes).

### Acceptance checkpoint
- [x] Expanded tract data is generated from ACS map + recodes and written to `public/data/tracts/<YEAR>.json`.
- [x] Frontend-compatible tract keys remain present for current UI metrics.
- [x] Validation passes for recode source fields, GEOID presence, and non-empty recoded output.

### Validation commands
- [x] `uv run -- python scripts/py/test_recode_utils.py`
- [x] `uv run --env-file .env -- python scripts/py/build_tracts.py`
- [x] `npm run verify`

---

## Milestone F5 — Sidebar Explore/Profile Tabs

### Objective
Keep the existing sidebar as the default Explore workflow and add a Profile tab for richer single-feature
detail without changing map interactions.

### Tasks
- [x] Preserve current Explore structure/behavior as default:
  - [x] consolidated Selected / In view / All summary strip
  - [x] grouped metric list + click-to-recolor behavior
  - [x] per-row estimate ± MOE output
  - [x] existing legend bucket integration compatibility
- [x] Add top tab control in sidebar:
  - [x] Explore tab
  - [x] Profile tab
  - [x] default tab remains Explore
- [x] Add Profile layout config for curated sections and ordered blocks:
  - [x] `src/config/profileLayout.js`
  - [x] section/block metadata for `comparisonRows`, `metricRows`, `stackedBar`
- [x] Implement Profile rendering for selected feature:
  - [x] empty state when nothing is selected
  - [x] single-selection detail card with active metric estimate ± MOE and all-area comparison
  - [x] curated sections in order: People, Economic conditions, Housing, Mobility
  - [x] compact comparison rows and stacked distribution bars
  - [x] defensive missing-data hiding for unavailable rows/blocks
- [x] Add optional collapsed `More details` block listing additional available variables.
- [x] Keep scope strict:
  - [x] no map selection logic changes
  - [x] no pipeline changes
  - [x] no legend filter behavior changes (except compatibility with tabbed sidebar wrapper)

### Acceptance checkpoint
- [x] Explore tab remains the default and retains existing UI behavior.
- [x] Profile tab shows a richer single-feature profile and a clear empty state with no selection.
- [x] Sidebar width and internal scrolling remain consistent with prior layout.

### Validation commands
- [x] `npm run build`
- [x] `npm run verify`
- [x] `npm run dev -- --host 127.0.0.1 --port 4173` starts successfully (after sandbox elevation)
- [ ] Manual visual smoke in browser:
  - Explore tab unchanged
  - Profile tab available and populated for single selection
  - Empty-state messaging for no selection
  - Legend bucket filtering still behaves as before in Explore

---

## Milestone F4A — Multi-Year Tract Outputs (2022, 2023, 2024)

### Objective
Expand the tract pipeline to generate aligned tract outputs for `2022`, `2023`, and `2024`.

### Tasks
- [x] Update Python pipeline year configuration to include:
  - [x] `2022`
  - [x] `2023`
  - [x] `2024`
- [x] Regenerate tract files for each year:
  - [x] `public/data/tracts/2022.json`
  - [x] `public/data/tracts/2023.json`
  - [x] `public/data/tracts/2024.json`
- [x] Keep stable tract geometry and align value outputs to geometry GEOIDs.
- [x] Update `public/data/years.json` to include `[2022, 2023, 2024]`.
- [x] Document ACS period semantics:
  - [x] `2022` -> ACS 2018-2022
  - [x] `2023` -> ACS 2019-2023
  - [x] `2024` -> ACS 2020-2024

### Acceptance checkpoint
- [x] Tract pipeline emits all three years with matching GEOID sets.
- [x] `public/data/years.json` and tract outputs are app-loadable without runtime Census API calls.

### Validation commands
- [x] `uv run --env-file .env -- python scripts/py/build_tracts.py`
- [x] `npm run verify`

### Temporary repo policy
- [ ] Defer committing regenerated multi-year tract data artifacts to GitHub until H1 gzip packaging is
  implemented.
- [ ] When H1 is complete, commit the data snapshot together (plain + `.gz` sidecars) in one coordinated
  commit.

---

## Milestone F4B — Block-Group-Backed Hex Methodology

### Objective
Improve hex methodology by using ACS block groups as the interpolation source while keeping tract mode
unchanged in the app.

### Tasks
- [x] Add block-group source geometry + value extraction in the Python pipeline.
- [x] Use block groups as the intermediate source for hex interpolation and MOE propagation.
- [x] Keep tract outputs and tract-mode app behavior unchanged.
- [x] Regenerate hex files for all configured years:
  - [x] `public/data/hexes/2022.json`
  - [x] `public/data/hexes/2023.json`
  - [x] `public/data/hexes/2024.json`
- [x] Add/expand pipeline assertions for:
  - [x] required output keys
  - [x] non-empty outputs
  - [x] parity/sanity checks for aggregate counts and ratios

### Acceptance checkpoint
- [x] Hex files are generated from a block-group-backed method for all years.
- [x] Hex methodology and MOE handling are documented and validated.

### Validation commands
- [x] `uv run --env-file .env -- python scripts/py/build_hexes.py`
- [x] `npm run verify`

---

## Milestone F4C — Multi-Year Metadata + App Wiring

### Objective
Wire multi-year data through the app (`2022`, `2023`, `2024`) and make metadata quantiles year-aware.

### Tasks
- [x] Update metadata schema and app readers to support per-year quantiles.
- [x] Ensure year slider and lazy-loading work for all three years in both geographies.
- [x] Keep geography toggle, selection state, legend behavior, and choose-for-me working across years.
- [x] Set default legend policy to per-year breaks.

### Acceptance checkpoint
- [x] Year slider supports `2022`/`2023`/`2024` in both hex and tract modes.
- [x] Legend and map coloring use the active year metadata without regressions.

### Validation commands
- [x] `npm run verify`
- [ ] Manual smoke in browser:
  - [ ] year toggle in both geographies
  - [ ] legend update per year
  - [ ] choose-for-me in both geographies

---

## Milestone H1 — Data Packaging for GitHub Pages

### Objective
Ship compressed sidecars for large static data files while preserving plain JSON/GeoJSON compatibility.

### Tasks
- [x] Generate compressed data sidecars:
  - [x] `.json.gz`
  - [x] `.geojson.gz`
- [x] Keep plain JSON/GeoJSON files in place as additive fallback assets.
- [ ] Finalize deferred data commit:
  - [x] include regenerated multi-year tract outputs
  - [x] include compressed sidecars
  - [ ] commit plain + compressed assets together
- [x] Update app data loaders to attempt compressed files first, then plain fallback.
- [x] Document a repeatable size-check command and expected output shape.

### Acceptance checkpoint
- [x] Compressed sidecars are generated for large data assets and app loading still works with fallback.

### Validation commands
- [x] Size check command (documented in `docs/documentation.md`)
- [x] `npm run verify`
- [ ] Manual loader smoke test (compressed path + fallback path)

---

## Milestone H2 — GitHub Pages Deploy Workflow

### Objective
Deploy the static app to GitHub Pages project URL with automatic deploys on `main`.

### Tasks
- [x] Add GitHub Actions Pages deploy workflow.
- [x] Configure Vite base path for project Pages deploy:
  - [x] `/san-diego-census-dashboard/`
- [x] Deploy from committed `public/data` assets (no runtime Census API calls and no deploy-time Census
  fetch).
- [x] Validate that `public/data/*` assets are served correctly from the Pages path prefix.

### Acceptance checkpoint
- [x] Live site loads and functions under GitHub Pages project URL.

### Validation commands
- [x] Local build prefix check (`dist/index.html` asset paths include `/san-diego-census-dashboard/`)
- [x] GitHub Actions deploy workflow run (push to `main`)
- [x] Live Pages sanity check (map load + data fetch + interactions)

---

## Milestone UI-3 — Curated Sidebar Expansion + Small Tweaks

### Objective
Expand Explore sidebar metrics in a curated way and apply small UI polish without exposing the full catalog.

### Tasks
- [x] Add curated metric expansion to Explore groups while keeping current interaction model.
  - [x] expose `variables.catalog.groups[*].metrics` in Explore (deduped with base `metrics` list)
  - [x] apply curated Explore allowlist + priority ordering (37 metrics / 10 groups)
  - [x] move Population group to top and remove Vehicle access group
- [x] Keep full catalog hidden from default Explore to avoid overwhelming UI.
- [ ] Add small UI tweaks:
  - [x] replace placeholder About/Data Sources modal copy with detailed project documentation
  - [x] expand `README.md` with detailed run/data/deploy guidance
  - [x] sidebar readability/polish
  - [x] show percent-based Explore row summaries for share metrics when denominator/base fields exist
  - [x] keep legend/map units aligned with share rows by promoting `proportionOf` metrics to ratio definitions
  - [x] add runtime quantile fallback so tract Explore metrics remain available beyond metadata-limited defaults
  - [x] default initial geography view to census tracts
  - [ ] minor spacing/label consistency improvements
- [ ] Preserve Profile tab behavior and existing map interactions.

### Acceptance checkpoint
- [x] Explore shows curated expanded metrics with stable performance and readability.
- [ ] Profile and map interaction behaviors remain intact.

### Validation commands
- [x] `npm run verify`
- [ ] Manual sidebar/profile smoke in browser
