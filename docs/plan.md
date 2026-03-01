
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
- [ ] Install:
  - `maplibre-gl`, `react-map-gl`
  - `@deck.gl/react`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox`
  - `d3-scale`, `d3-array`, `d3-format`
  - `h3-js`
- [ ] Render MapLibre basemap with DeckGL overlay

#### B2. Add mock files
Create:
- [ ] `public/data/years.json`
- [ ] `public/data/variables.json`
- [ ] `public/data/metadata.json` including:
  - quantiles per geography: `quantiles.hex.*`, `quantiles.tract.*`
  - county averages per year for key metrics
- [ ] `public/data/hexes/2023.json` (50–300 hexes)
- [ ] `public/data/tracts/tracts.geojson` (10–50 tracts)
- [ ] `public/data/tracts/2023.json` (values keyed by GEOID)

#### B3. Implement loaders + caching
- [ ] `src/data/loadData.js`:
  - load metadata, years, variables
  - load hex year
  - load tract geometry (once)
  - load tract year
  - cache everything in-memory

#### B4. Implement geography adapter (centralize mode logic)
- [ ] `src/data/geography.js`:
  - get IDs, join tract values to geometry, compute centers

#### B5. Render choropleths
- [ ] Hex mode uses `H3HexagonLayer`
- [ ] Tract mode uses `GeoJsonLayer` and joins values by GEOID
- [ ] Legend reads quantiles for current `(geoMode, metric)`
- [ ] No-data is a dark fill

### Acceptance checkpoint
- [ ] Toggle switches between hex and tract choropleths
- [ ] Legend updates when toggling geo mode

### Validation commands
- [ ] `npm run verify`
- [ ] `npm run build`

---

## Milestone C — Hover + selection + brush selection (both modes)

### Objective
Implement hover highlight, click-to-select (single), and brush selection (multi) for both hex and tracts.

### Tasks
#### C1. Hover highlight
- [ ] Track hover ID per geoMode
- [ ] Highlight hovered feature:
  - hex outline or separate highlight layer
  - tract line color/width

#### C2. Click selection
- [ ] Click sets selected IDs for current geoMode
- [ ] Store selections separately per geography:
  - `selectedIdsByGeo.hex`, `selectedIdsByGeo.tract`

#### C3. Brush selection
- [ ] Multi-select mode uses rectangle brush UI
- [ ] On mouse up, call deck `pickObjects` with `layerIds=[activeLayerId]`
- [ ] Deduplicate IDs and store in `selectedIdsByGeo[geoMode]`

### Acceptance checkpoint
- [ ] Hover works in both modes
- [ ] Click selection works in both modes
- [ ] Brush selection works in both modes

### Validation commands
- [ ] `npm run verify`
- [ ] `npm run build`

---

## Milestone D — Sidebar metrics drive map + sidebar stats (single & aggregate)

### Objective
Make sidebar metric rows drive choropleth variable, and show selected-area demographics in sidebar.

### Tasks
- [ ] `src/data/metrics.js`: metric registry (value getter + label + format)
- [ ] `src/data/format.js`: number/currency/percent formatting
- [ ] Sidebar:
  - clickable metric rows
  - active row highlight
  - “no selection” state
- [ ] Compute:
  - counts: sums
  - rates: sum(num)/sum(den)
  - medians: weighted-average approximation (document in Data Sources modal)

### Acceptance checkpoint
- [ ] Clicking a metric recolors map and updates legend
- [ ] Sidebar shows correct values for single selection
- [ ] Sidebar shows aggregate values for multi selection

### Validation commands
- [ ] `npm run verify`
- [ ] `npm run build`

---

## Milestone E — Choose for me (both modes)

### Objective
Implement “Choose for me” to select a high/low extreme feature and fly to it with a callout.

### Tasks
- [ ] Choose logic:
  - filter non-null values
  - pick randomly among top/bottom ~1–2%
- [ ] Fly-to:
  - hex center via h3-js
  - tract center via centroids (recommended) or geojson properties
- [ ] Callout shows:
  - high/low descriptor
  - selected value
  - county average

### Acceptance checkpoint
- [ ] Choose-for-me works in hex and tract modes

### Validation commands
- [ ] `npm run verify`
- [ ] `npm run build`

---

## Milestone F — Python pipeline outputs (San Diego County)

### Objective
Create Python scripts to generate `public/data/*` for San Diego County across configured years.

### Outputs
- `public/data/years.json`
- `public/data/variables.json`
- `public/data/metadata.json` (quantiles per geography + averages)
- `public/data/hexes/<YEAR>.json`
- `public/data/tracts/tracts.geojson`
- `public/data/tracts/<YEAR>.json`
- optional `public/data/tracts/centroids.json`

### Tasks
- [ ] `scripts/py/requirements.txt`
- [ ] `scripts/py/config.example.yaml`
- [ ] `scripts/py/build_data.py`
- [ ] Use env var `CENSUS_API_KEY` (never commit keys)
- [ ] Inflation adjust dollar vars to target year
- [ ] Validate outputs:
  - required keys present
  - no duplicate IDs
  - sanity checks on denominators
  - file sizes reasonable

### Acceptance checkpoint
- [ ] Running the script produces files that the web app can load
- [ ] At least one year fully works end-to-end

---

## Milestone G — Switch app from mock to real data + loading states

### Objective
Load real generated data, cache efficiently, and show minimal loading UI.

### Acceptance checkpoint
- [ ] Both geo modes render SD County with real data
- [ ] Toggle remains responsive after first load (geometry cached)

---

## Milestone H — GitHub Pages deploy

### Objective
Add a deployment workflow for static hosting.

### Tasks
- [ ] Vite base path configured
- [ ] GitHub Actions deploy workflow
- [ ] Confirm `public/data/*` is served correctly

### Acceptance checkpoint
- [ ] Live site loads and functions under GitHub Pages
