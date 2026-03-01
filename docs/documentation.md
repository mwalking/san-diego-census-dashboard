<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

<<<<<<< Updated upstream
- **Active milestone:** A3.1 responsive overlay layout fix — completed
- **Next milestone:** Milestone B — map + dual overlays with mock data (hex + tract)
=======
- **Active milestone:** Milestone B1 — completed
- **Next milestone:** Milestone B2 — mock data files and loaders
>>>>>>> Stashed changes

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

## Demo flow (MVP target)

1. Open app and dismiss the welcome modal.
2. Use the geography toggle to switch hex bins and census tracts.
3. Change year with the slider.
4. Click a sidebar metric to recolor map and refresh legend.
5. Hover and click features to inspect selected-area values.
6. Switch to brush mode to multi-select.
7. Use “Choose for me” to fly to an extreme feature and show callout details.

## Milestone 0 changes

- Added root guidance in `AGENTS.md`.
- Added baseline repo docs in `README.md` (what repo is, run, verify, build note).
- Added `.gitignore` entries for `.env*`, `node_modules`, `.venv`, `dist`, and Python cache files.
- Added Prettier config: `.prettierrc.json`, `.prettierignore`, scripts `format` and `format:check`.
- Added ESLint config: `eslint.config.mjs`, script `lint`.
- Added verify entrypoint: `scripts/verify.mjs` and `npm run verify`.
- Added CI workflow `.github/workflows/ci.yml` to run `npm ci` + `npm run verify` on push/PR.

## Milestone A1 changes

- Installed Vite + React deps on the existing project:
  - `react`, `react-dom`
  - `vite`, `@vitejs/plugin-react`
- Updated `package.json` scripts to add:
  - `dev`
  - `build`
  - `preview`
    while keeping `format`, `format:check`, `lint`, and `verify`.
- Added minimal Vite React files:
  - `index.html`
  - `vite.config.mjs`
  - `src/main.jsx`
  - `src/app/App.jsx`
- Added Milestone A1 folder skeleton:
  - `src/components/.gitkeep`
  - `src/data/.gitkeep`
  - `src/ui/.gitkeep`
- Updated ESLint config to include `.jsx` files and browser global `document`.

## Milestone A2 changes

- Installed Tailwind CSS + PostCSS dependencies:
  - `tailwindcss`
  - `postcss`
  - `autoprefixer`
- Added Tailwind config in `tailwind.config.cjs` with content paths:
  - `./index.html`
  - `./src/**/*.{js,jsx}`
- Added PostCSS config in `postcss.config.cjs` with `tailwindcss` + `autoprefixer`.
- Added Tailwind stylesheet entry in `src/styles/index.css`:
  - `@tailwind base;`
  - `@tailwind components;`
  - `@tailwind utilities;`
- Imported `src/styles/index.css` from `src/main.jsx`.
- Updated `src/app/App.jsx` with minimal Tailwind utility classes for visible styling.
- Added CommonJS global support (`module`) in ESLint config so `.cjs` config files lint cleanly.

## Milestone A3 changes

- Added centralized microcopy and key constants in `src/ui/microcopy.js`.
- Added shell components:
  - `src/components/MapShell.jsx` (map placeholder background + text)
  - `src/components/Sidebar.jsx` (year slider shell, metric groups, clickable rows, no-selection text)
  - `src/components/LegendCard.jsx` (top-left legend shell with geography toggle UI: hex/tract)
  - `src/components/SelectionModeCard.jsx` (bottom-left selection mode shell: single/multi)
  - `src/components/Modal.jsx` (generic modal shell)
  - `src/components/WelcomeModal.jsx` (first-load modal)
  - `src/components/AboutModal.jsx`
  - `src/components/DataSourcesModal.jsx`
- Replaced `src/app/App.jsx` with A3 state/layout wiring:
  - state for `geoMode`, `selectionMode`, `activeMetricId`, and `year`
  - navbar links for Data sources, About, and Choose for me placeholder action
  - modal open/close wiring
  - welcome modal persistence using localStorage
  - legend subtext updates from current geography mode
  - selection helper text updates from current selection mode
- Kept map rendering as placeholder only (no MapLibre or deck.gl added).
- Updated ESLint `no-unused-vars` config to avoid false positives for JSX component identifiers.

<<<<<<< Updated upstream
## Milestone A3.1 changes

- Refactored app shell in `src/app/App.jsx` to viewport-fixed layout:
  - root: `h-screen w-screen overflow-hidden`
  - fixed-height navbar
  - map area that fills remaining height
- Anchored overlay cards to the map region using absolute positions:
  - legend: `top-4 left-4`
  - selection mode: `bottom-4 left-4`
  - sidebar: `top-4 right-4 bottom-4` with fixed-ish width
- Added overlay interaction layering for future map interactivity:
  - overlay wrapper: `pointer-events-none`
  - per-card containers: `pointer-events-auto`
- Added width guards (`w-[360px] max-w-[92vw]` sidebar, bounded left cards) and kept root overflow hidden
  to prevent horizontal scrolling during common viewport resizes.
- Kept this as a layout-only pre-step; no Milestone B libraries/features were started.
=======
## Milestone B1 changes

- Installed mapping dependencies only (no additional unrelated libraries):
  - `maplibre-gl`
  - `react-map-gl`
  - `@deck.gl/react`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/geo-layers`, `@deck.gl/mapbox`
  - `d3-array`, `d3-scale`, `d3-format`
  - `h3-js`
- Updated `src/components/MapShell.jsx` to render:
  - MapLibre basemap (`react-map-gl/maplibre`) with a dark style URL
  - DeckGL overlay sharing the same controlled `viewState`
  - empty placeholder deck layer (`ScatterplotLayer` with empty data), so no real data wiring yet
- Imported MapLibre CSS in `src/main.jsx` (`maplibre-gl/dist/maplibre-gl.css`) so map tiles/controls render correctly.
- Kept the existing floating UI shell layout and interaction wiring unchanged.
>>>>>>> Stashed changes

## Commands run and results (latest milestone)

- `npm run build`: passed.
- `npm run verify`: passed.
- Final validation state:
  - `npm run build`: passed.
  - `npm run verify`: passed.
  - Note: Vite emitted a non-blocking warning from loaders.gl (`spawn` export from browser external) and a
    large-chunk warning; build still completed successfully.

## Decisions made (latest milestone)

<<<<<<< Updated upstream
- Treated A3.1 as a milestone-scoped layout fix only and kept Milestone B untouched.
- Used strict absolute anchoring against a map-relative container to keep cards pinned on resize.
- Preserved future map pointer passthrough behavior by combining `pointer-events-none` wrapper +
  `pointer-events-auto` cards.
=======
- Scoped work strictly to Milestone B1 plumbing; no data loading or choropleth logic yet.
- Used a controlled shared `viewState` between DeckGL and MapLibre so upcoming B2/B3 overlay state wiring is
  straightforward.
- Used an empty placeholder DeckGL layer to validate rendering pipeline without introducing mock data early.
>>>>>>> Stashed changes

## Known issues / follow-ups

- Network access may require escalation for dependency installation in this environment.
- Bundle size is currently large after adding deck.gl/maplibre dependencies; optimize chunking later if needed.
