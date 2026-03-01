<!-- docs/implement.md -->
# Codex Runbook (How to Work in This Repo)

This file is the operating system for Codex work. Follow it strictly.

## 1) Source of truth
Codex must read these files before making changes:
- `docs/prompt.md` — spec, scope, constraints, DoD
- `docs/plan.md` — milestones + acceptance checkpoints
- `docs/documentation.md` — current status, decisions, known issues

If anything conflicts, treat `docs/prompt.md` as the highest priority and ask the user before proceeding.

## 2) Execution loop (required for every milestone)
For each milestone or subtask:

1. **Read** the relevant plan section and any referenced files.
2. **Propose** a short plan:
   - what will change
   - which files will be touched
   - which validations will be run
3. **Implement** with minimal diffs:
   - avoid refactors not required by the milestone
   - avoid adding dependencies unless necessary
4. **Validate**:
   - run the milestone validation commands
   - fix failures before moving on
5. **Document**:
   - update `docs/documentation.md` with:
     - what changed
     - commands run and results
     - decisions made
     - next milestone to tackle

Do not “continue to the next milestone” unless current one is validated and documented.

## 3) Guardrails (do not violate)
- Keep diffs small and reviewable.
- Do not introduce new libraries unless:
  - clearly justified for the milestone, and
  - recorded in `docs/documentation.md`.
- Do not remove the **hex ↔ tract toggle requirement**.
- Do not add runtime Census API calls in the web app.
- Never commit secrets (Census API key stays in env only for Python scripts).
- Prefer configuration and composition over one-off hacks.

## 4) File conventions
### Data loading
- Put all fetch/load logic in `src/data/loadData.js`
- Cache by year and geography.
- Tract geometry loads once and is cached.

### Geography branching
- Only one place should branch on `geoMode` to choose the layer / adapter.
- Use `src/data/geography.js` to centralize:
  - IDs, centers, selection parsing, record lookup/join logic

### Metrics
- Metric definitions live in `src/data/metrics.js`
- Formatting helpers in `src/data/format.js`
- Variable registry loaded from `public/data/variables.json`

## 5) Git workflow expectations
- Create a clean checkpoint commit before starting a milestone.
- After milestone passes validations, commit again with a clear message:
  - `Milestone 0: add repo memory + verify`
  - `Milestone B: dual mock datasets + geo toggle wiring`
- If changes become messy, stop and regroup:
  - revert to last good commit
  - re-implement in smaller steps

## 6) Default validation commands
Unless the plan says otherwise, run:
- `npm run verify`

When Python pipeline is added, also run:
- `python scripts/py/build_data.py --config scripts/py/config.yaml` (or equivalent)
- Basic sanity check of output files in `public/data/`

## 7) How to handle ambiguity
If a detail is missing:
- Make the smallest reasonable assumption consistent with `docs/prompt.md`.
- Record the assumption in `docs/documentation.md` under “Decisions”.
- If it affects product scope/UX materially, ask the user before coding.

## 8) “Stop conditions”
Stop and ask the user if any of these occurs:
- A required dependency or API choice is unclear and would force rework.
- Data contract changes would break previously completed milestones.
- You cannot run validations due to environment/tooling issues.

Otherwise: proceed using best-effort assumptions and document them.