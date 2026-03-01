<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone A1 — completed
- **Next milestone:** Milestone A2 — UI shell + geography toggle UI (non-functional)

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

## Commands run and results (latest milestone)

- `npm run build`: passed.
- `npm run verify`: initially failed on ESLint (`src/main.jsx` + missing `document` global), then passed
  after minimal lint-safe adjustments.
- Final validation state:
  - `npm run build`: passed.
  - `npm run verify`: passed.

## Decisions made (latest milestone)

- Followed user instruction to avoid `npm create vite@latest .`; installed dependencies directly and added
  only the minimal Vite files manually.
- Kept diffs scoped to A1 setup only; no A2 UI shell work was added.
- Deferred Tailwind setup to later Milestone A tasks to keep this change focused on Vite + React bootstrap.

## Known issues / follow-ups

- Network access may require escalation for dependency installation in this environment.
- Tailwind is not wired yet (planned for subsequent Milestone A work).
