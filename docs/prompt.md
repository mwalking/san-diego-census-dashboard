<!-- docs/prompt.md -->
# San Diego Mosaic — Project Spec (Source of Truth)

## Purpose
Build a static, interactive **census dashboard web app** for **San Diego County, CA** that closely mirrors the UI/interaction style shown in the provided screenshots (Metro Mosaic–style).

The app must support switching the map between **H3 hex bins** and **Census tracts** (toggle “in the map” UI).

## Core user experience
1. User lands on a full-screen map with floating UI cards.
2. A welcome modal explains how to use the app.
3. User picks a year via a slider.
4. User clicks a metric in the sidebar; the map recolors, and the legend updates.
5. User can:
   - hover to highlight a feature (hex or tract),
   - click to select one,
   - brush to select many (multi-select mode),
   - see selected-area demographics in the sidebar,
   - see **In view** and **Selected area** summaries for the active metric/year with estimate ± MOE when available.
6. “Choose for me” jumps the map to an interesting extreme feature (high/low) for the current metric/year and shows a callout.

## Geography modes (must-have)
Two overlay modes controlled by a toggle visible on the map (recommended placement: legend card header):

- **Hex bins**:
  - Uses H3 cells at a configured resolution (default: `8`).
  - Values are precomputed by interpolating/aggregating Census polygon estimates onto hexes.

- **Census tracts**:
  - Uses official tract boundaries (stable geometry file).
  - Values are tract-level ACS estimates for each year.

### Toggle behavior requirements
- Switching geography must preserve:
  - Year
  - Active metric
- Switching geography should not create confusing state:
  - Store hover/selection separately per geography OR clear on toggle.
  - Sidebar always reflects the *current* geography.

## Data constraints (must-have)
- **No runtime Census API calls** from the browser.
- Data are precomputed with Python and committed into the repo under `public/data/`.
- No secrets in git. Census API key must be read from environment variables only in the Python pipeline.

## Tech constraints (MVP)
- JavaScript web app (Vite + React + Tailwind)
- MapLibre basemap (via react-map-gl)
- deck.gl overlays:
  - H3HexagonLayer for hex mode
  - GeoJsonLayer for tract mode
- Static hosting target: GitHub Pages

## Data outputs (must-have contract)
The web app assumes these exist:

- `public/data/years.json`
- `public/data/variables.json`
- `public/data/metadata.json`
- Hex mode:
  - `public/data/hexes/<YEAR>.json`
- Tract mode:
  - `public/data/tracts/tracts.geojson` (geometry only; stable IDs)
  - `public/data/tracts/<YEAR>.json` (values keyed by GEOID)
  - optional `public/data/tracts/centroids.json`

## Variable requirements (MVP set)
Include the following groups and metrics (raw columns may vary but must support these computations):

**Population & Race**
- Total population
- White, Black, Asian counts
- Hispanic (any race) count
- Median age

**Income & Property**
- Median household income (inflation adjusted)
- Median home value (inflation adjusted)
- Median rent (inflation adjusted)
- Poverty rate (ratio)

**Employment & Education**
- BA+ rate (ratio)
- Employed rate (ratio)
- Work-from-home rate (ratio)

**Other**
- Total housing units
- Occupied housing units

## Performance requirements
- Smooth map interactions (pan/zoom).
- Avoid shipping heavy per-year geometry:
  - Tract geometry should be a single stable file.
  - Per-year values should be compact JSON (prefer keyed object map).
- Lazy-load year files on demand and cache them in-memory.

## MVP Definition of Done (DoD)
All of the below must be true:

### Build & run
- `npm run dev` works
- `npm run build` works
- `npm run verify` passes

### UI + interaction
- Welcome modal appears once and can be dismissed (persist via localStorage).
- Sidebar lists metric groups and metrics; clicking a metric recolors the map and updates legend.
- Year slider updates map and sidebar.
- Geography toggle switches between hex and tract overlays; legend updates accordingly.
- Hover highlight works in both modes.
- Single click selection works in both modes.
- Brush selection works in both modes.
- Sidebar shows selected-area stats (single and multi).
- Sidebar shows active-metric **In view** and **Selected area** summaries with estimate ± MOE when available.
- Aggregated medians (multi selection or in-view) may display N/A unless a distribution-based aggregation method is implemented.
- “Choose for me” works in both modes (fly-to + callout shows value + county average).

### Data pipeline contract
- Python script exists to generate `public/data/*` deterministically (at least one year works end-to-end for SD County).

## Out of scope (MVP)
- No backend services
- No user authentication
- No address search/geocoder
- No Orange County yet (design must make it easy later)

## References (informational)
- Inspiration repo: https://github.com/emoro/atlas_inequality
- Codex long-horizon workflow: https://github.com/openai/openai-cookbook/blob/main/examples/codex/long_horizon_tasks.md
- pytidycensus docs: https://mmann1123.github.io/pytidycensus/
