# InvoiceRouter Template 001 — Odoo Complete Bulk Email Sending System

This provider template is for InvoiceRouter v2.0.0 and the Odoo JSON-RPC adapter.

## What this template does

- Reads Odoo provider/API details from the `provider` sheet.
- Reads recipients from the `email_list` sheet.
- Builds invoices from the InvoiceRouter n8n Invoice Template node.
- Searches or creates Odoo customers by email.
- Creates Odoo customer invoices.
- Posts invoices when `odooPostInvoice` is true.
- Attempts invoice email sending when `odooSendInvoiceEmail` is true.
- Writes lifecycle results into `invoice_results`.

## Included files

- `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_GOOGLE_SHEETS_TEMPLATE.xlsx`
- `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`
- `provider.csv`
- `email_list.csv`
- `invoice_results.csv`
- `provider.lifecycle.json`
- `provider.recipe.json`
- `provider.template.ygit`
- `QUICKSTART.md`
- `N8N_IMPORT_GUIDE.md`
- `ODOO_SETUP.md`
- `LIVE_TEST_CHECKLIST.md`
- `TROUBLESHOOTING.md`

## Default safety

The workflow import is dry-run safe by default:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

Do not switch to live bulk until dry-run, sandbox/test, and live canary are proven.

## Important Odoo note

This template uses InvoiceRouter's current Odoo JSON-RPC `/jsonrpc` adapter. Odoo 19 documentation states XML-RPC and JSON-RPC endpoints are scheduled for future removal and External JSON-2 is the replacement path. Keep this in mind for long-term provider maintenance.

## Sandbox + live mode files

This template pack now includes both sandbox/test and live-ready files. The original import remains dry-run safe. Use the explicit mode files below when you want real provider API execution.

| Mode | Workbook | Workflow | Provider CSV |
|---|---|---|---|
| Dry-run/default | `google-sheets-template.xlsx` | `n8n-import-workflow-dry-run.json` | `provider.csv` |
| Sandbox canary | `google-sheets-template-sandbox.xlsx` | `n8n-import-workflow-sandbox-canary.json` | `provider.sandbox.csv` |
| Sandbox bulk | `google-sheets-template-sandbox.xlsx` | `n8n-import-workflow-sandbox-bulk.json` | `provider.sandbox.csv` |
| Live canary | `google-sheets-template-live.xlsx` | `n8n-import-workflow-live-canary.json` | `provider.live.csv` |
| Live bulk | `google-sheets-template-live.xlsx` | `n8n-import-workflow-live-bulk.json` | `provider.live.csv` |

Live bulk keeps InvoiceRouter safety tokens enabled: `SEND_REAL_INVOICES` and `SEND_BULK_REAL_INVOICES`.
