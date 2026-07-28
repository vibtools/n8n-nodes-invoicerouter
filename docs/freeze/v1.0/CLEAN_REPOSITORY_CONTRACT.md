# Clean Repository Contract

## Purpose

The repository contains one authoritative Version 1.0 specification and only the files needed to implement, test, build, document, and release it.

## Authoritative content

- `VERSION_1_0_FREEZE.md`
- `docs/freeze/v1.0/`
- `manifest/freeze-v1.0.json`
- frozen architecture assets
- frozen provider workbook
- canonical full workflow: `workflows/InvoiceRouter-v1-production.json`

## Allowed implementation roots

- `.github/workflows/`
- `assets/`
- `nodes/`
- `providers/`
- `shared/`
- `scripts/`
- `tests/`
- `workflows/`

## Generated content

`dist/`, `release/`, `coverage/`, `logs/`, `temp/`, `node_modules/`, and package archives are generated locally or in CI and must not be tracked.

## Forbidden legacy content

- alternate architecture/freeze documents outside `docs/freeze/v1.0/`
- `user-docs/`
- incomplete or pre-freeze workflow JSON
- old architecture, auto-fix, release, roadmap, or project manifests
- PowerShell fixer systems
- committed `dist/` output
- duplicate provider alias/stub trees
- a separate credential path that contradicts the frozen Sheet-credential default flow

## Conflict rule

When implementation code differs from the freeze, the code is incomplete; the freeze is not reinterpreted to match the code.
