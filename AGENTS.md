# Repository Agent Instructions

## Required reading before coding

- Read `docs/prompt.md`, `docs/plan.md`, and `docs/documentation.md` first.
- Treat `docs/prompt.md` as source of truth if there is any conflict.

## Milestone workflow

- Keep changes scoped to the active milestone only.
- Prefer small, reviewable diffs.
- Validate milestone commands before moving on.
- Update `docs/documentation.md` after each milestone with:
  - what changed
  - commands run and results
  - decisions made
  - next milestone

## Guardrails

- Do not add dependencies unless needed for the milestone; record any additions in `docs/documentation.md`.
- Do not remove or weaken the hex/tract geography toggle requirement.
- Do not add runtime Census API calls in the web app.
- Never commit secrets; keep API keys in environment variables only.
