# InvoiceRouter Templates

Provider-specific starter templates live under `template/providers/`. These files are public onboarding assets; private planning belongs in ignored `project/`.

## Odoo v2.1.1 canonical production template

New Odoo production setups use the versioned workflow stored inside this public template tree:

```text
template/providers/odoo/n8n-import-workflow-production-v2.1.1.json
```

For the corrected `v2.1.3` package release, n8n can import the same compatibility-named repository file by raw URL:

```text
https://raw.githubusercontent.com/vibtools/n8n-nodes-invoicerouter/v2.1.3/template/providers/odoo/n8n-import-workflow-production-v2.1.1.json
```

The compatibility file `template/providers/odoo/n8n-import-workflow-live-bulk.json` is byte-identical to the versioned v2.1.1 workflow. One workflow and one native Google Sheet support one-account production validation, pilot bulk, and production bulk.

## Compatibility template modes

Historical provider packs may also include explicit mode files:

- `n8n-import-workflow-dry-run.json`
- `n8n-import-workflow-sandbox-canary.json`
- `n8n-import-workflow-sandbox-bulk.json`
- `n8n-import-workflow-live-canary.json`
- `n8n-import-workflow-live-bulk.json`
- `google-sheets-template-sandbox.xlsx`
- `google-sheets-template-live.xlsx`

For Odoo v2.1.1, validate each production account separately in the canonical workflow before enabling the verified account pool for pilot bulk.
