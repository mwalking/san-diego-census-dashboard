<!-- docs/documentation.md -->

# Project Log (Documentation)

## Current status

- **Active milestone:** Milestone 0 — completed
- **Next milestone:** Milestone A — UI shell + geography toggle UI (non-functional)

## Repository overview

This repo contains the San Diego Mosaic census dashboard project. The app target is a static web UI for
San Diego County with a map that supports both:

- **Hex bins (H3)**
- **Census tracts**

The browser app must use precomputed files under `public/data/` and must not call the Census API at
runtime.

## How to run

Milestone 0 only sets up baseline tooling. App runtime scripts (`dev`/`build`) are expected in later
milestones.

```bash
npm install
```

## How to verify

```bash
npm run verify
```

## How to build

`npm run build` is not defined yet in Milestone 0 and is intentionally skipped by `npm run verify`.

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

## Commands run and results

- `npm install` (sandbox): failed with `EAI_AGAIN` reaching `registry.npmjs.org`.
- `npm install` (escalated): passed.
- `npm run format`: passed.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run verify`: passed (`build` step correctly skipped because no `build` script exists).

## Decisions made

- Kept Milestone 0 scoped to repo memory + verification tooling only; no app scaffold changes.
- Implemented `verify` as a Node script so it can deterministically run `format:check` and `lint`,
  then conditionally run `build` only if present.
- Added pre-existing planning docs (`docs/prompt.md`, `docs/plan.md`, `docs/implement.md`) to
  `.prettierignore` to avoid broad reformat churn while keeping Milestone 0 diffs minimal.
- Used `npm ci` in CI because `package-lock.json` now exists.

## Known issues / follow-ups

- No `dev` or `build` scripts yet; they are expected in Milestone A when the app scaffold is added.
- Network access may require escalation for dependency installation in this environment.
