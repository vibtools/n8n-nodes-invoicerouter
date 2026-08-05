# InvoiceRouter Project Structure

InvoiceRouter follows the VibProject-compatible public repository structure while preserving the existing n8n community node implementation paths.

```text
.github/
assets/
config/
data/
docs/
examples/
manifest/
nodes/
providers/
scripts/
shared/
src/
template/
tests/
workflows/

PROJECT_STRUCTURE.md
vibproject.ygit
```

## Public folders

- `nodes/` contains the eight production n8n custom nodes. These paths are intentionally unchanged.
- `providers/` contains provider registry, capability, and lifecycle support code.
- `shared/` contains shared runtime, security, type, and utility helpers.
- `config/` contains public lifecycle schemas and provider recipe examples.
- `template/` contains public provider starter templates and onboarding packs.
- `docs/` contains public user and developer documentation.
- `data/` contains public sample data and reusable import/export resources.
- `workflows/` contains import-ready n8n workflow JSON files.
- `tests/` contains automated tests.

## Private local folder

`project/` is reserved for private Vib Tools planning, research, roadmap, and personal development notes. It is intentionally ignored by Git and must not be pushed to GitHub.

## Rule

Do not move existing `nodes/`, `providers/`, or `shared/` files unless explicitly approved. The VibProject structure is an organizational layer, not a migration.


## v2.1.0 Odoo managed workbook assets

`template/providers/odoo/` now includes `retry_queue.csv`, `account_report.csv`, and `campaign_report.csv` beside the existing provider, recipient, and invoice-result templates. Existing source paths and custom-node directories are unchanged.

## v2.1.1 Odoo corrective assets

`template/providers/odoo/` additionally contains the URL-importable `n8n-import-workflow-production-v2.1.1.json`, `writeback_queue.csv`, synchronized production workbooks, and the non-destructive Google Apps Script schema repair helper. No existing source folder or custom-node path is renamed.

## Phase 07 verification assets

```text
scripts/phase07-n8n-engine-smoke.mjs
scripts/phase07-final-release-gate.mjs
tests/helpers/phase07-runtime-worker.cjs
tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json
tests/fixtures/odoo/odoo-18-phase07-e2e.json
tests/fixtures/odoo/odoo-19-phase07-e2e.json
evidence/phase07/
docs/developer/phase07-final-release-gate.md
```


## Final corrective audit assets

The Phase 07 scripts also enforce complete canonical workflow import/export, `PROVIDER_PENDING` recovery, immediate provider-side-effect lease verification, and cryptographically bound release evidence. No custom-node folder or module was renamed.
