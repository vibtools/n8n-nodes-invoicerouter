# InvoiceRouter Templates

Provider-specific starter templates live under `template/providers/`. These files are public onboarding assets; private planning belongs in ignored `project/`.

## Sandbox + live template modes

Complete provider packs may include explicit mode files:

- `n8n-import-workflow-dry-run.json` — safe default validation.
- `n8n-import-workflow-sandbox-canary.json` — one sandbox/test API send.
- `n8n-import-workflow-sandbox-bulk.json` — sandbox/test bulk send.
- `n8n-import-workflow-live-canary.json` — one live API send.
- `n8n-import-workflow-live-bulk.json` — live bulk send with explicit bulk confirmation.
- `google-sheets-template-sandbox.xlsx` — sandbox row enabled.
- `google-sheets-template-live.xlsx` — live row enabled.

Use canary before bulk for both sandbox and live.
