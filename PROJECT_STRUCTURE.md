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
