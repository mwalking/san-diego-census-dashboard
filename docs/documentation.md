<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone A2 — completed
- **Next milestone:** Milestone A3 — UI shell component implementation (static, no map wiring)

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

## Commands run and results (latest milestone)

- `npm run build`: passed.
- `npm run verify`: initially failed on ESLint (`module` undefined in `postcss.config.cjs` and
  `tailwind.config.cjs`), then passed after minimal ESLint global update.
- Final validation state:
  - `npm run build`: passed.
  - `npm run verify`: passed.

## Decisions made (latest milestone)

- Scoped this milestone strictly to Tailwind setup and proof-of-wiring only; no map/sidebar/modal UI work.
- Used `.cjs` config files for Tailwind/PostCSS to avoid changing package module type.
- Kept dependency additions limited to `tailwindcss`, `postcss`, and `autoprefixer` only.

## Known issues / follow-ups

- Network access may require escalation for dependency installation in this environment.
