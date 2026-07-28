# Clean Repository Contract

## Purpose

The repository must contain one authoritative Version 1.0 specification and only the files needed to implement, test, build, and release it.

## Authoritative content

- `VERSION_1_0_FREEZE.md`
- `docs/freeze/v1.0/`
- `manifest/freeze-v1.0.json`
- frozen architecture assets
- frozen provider workbook

## Allowed implementation roots

- `.github/workflows/`
- `credentials/`
- `nodes/`
- `providers/`
- `shared/`
- `scripts/`
- `tests/`

## Generated content

`dist/`, `release/`, `coverage/`, `logs/`, and `temp/` are generated locally or in CI and must not be tracked.

## Forbidden legacy content

- alternate architecture/freeze documents outside `docs/freeze/v1.0/`
- `user-docs/`
- old provider/example workflow JSON
- old architecture, auto-fix, release, roadmap, or project manifests
- PowerShell automation/fixer systems
- committed `dist/` output
- duplicate provider alias re-export files
- an importable workflow that does not implement the frozen eight-node contract

## Conflict rule

When implementation code differs from the freeze, the code is incomplete; the freeze is not reinterpreted to match the code.
