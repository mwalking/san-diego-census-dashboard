<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone A3 — completed
- **Next milestone:** Milestone B — map + dual overlays with mock data (hex + tract)

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

## Commands run and results (latest milestone)

- `npm run build`: passed.
- `npm run verify`: initially failed on formatting (A3 files), then passed after formatting fixes.
- `npm run verify`: then failed on ESLint false positives for JSX component imports, then passed after
  minimal ESLint `varsIgnorePattern` update.
- Final validation state:
  - `npm run build`: passed.
  - `npm run verify`: passed.

## Decisions made (latest milestone)

- Scoped this milestone strictly to UI shell/chrome and placeholder interactions; no mapping libraries were
  added.
- Centralized nearly all user-facing shell text in `src/ui/microcopy.js` to keep component code lightweight.
- Used localStorage key `san-diego-mosaic.welcome-dismissed-v1` for first-load welcome modal persistence.
- Used a temporary Choose-for-me placeholder message in navbar; real behavior is deferred to Milestone E.
- Kept A3 implementation static and state-driven to preserve clean handoff for Milestone B map integration.

## Known issues / follow-ups

- Network access may require escalation for dependency installation in this environment.
