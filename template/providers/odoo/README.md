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
