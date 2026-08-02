# Sandbox + Live Mode Templates

This provider pack now includes explicit mode-ready files. The original workflow remains safe dry-run/default behavior for first import, while the new mode files are ready for sandbox/test API execution and live execution.

## File selection

| Goal | Google Sheets file | Provider CSV | n8n workflow JSON | Real send? | Safety token |
|---|---|---|---|---|---|
| Dry-run validation | google-sheets-template.xlsx | provider.csv | n8n-import-workflow-dry-run.json | No | none |
| Sandbox canary | google-sheets-template-sandbox.xlsx | provider.sandbox.csv | n8n-import-workflow-sandbox-canary.json | Yes, sandbox/test API | SEND_SANDBOX_INVOICES |
| Sandbox bulk | google-sheets-template-sandbox.xlsx | provider.sandbox.csv | n8n-import-workflow-sandbox-bulk.json | Yes, sandbox/test API bulk | SEND_SANDBOX_INVOICES + SEND_BULK_SANDBOX_INVOICES |
| Live canary | google-sheets-template-live.xlsx | provider.live.csv | n8n-import-workflow-live-canary.json | Yes, live API, max 1 invoice | SEND_REAL_INVOICES |
| Live bulk | google-sheets-template-live.xlsx | provider.live.csv | n8n-import-workflow-live-bulk.json | Yes, live API bulk | SEND_REAL_INVOICES + SEND_BULK_REAL_INVOICES |

## Live safety sequence

1. Run dry-run/default template first.
2. Run sandbox canary with one row.
3. Run sandbox bulk with a tiny test list.
4. Run live canary with one real customer/invoice.
5. Run live bulk only after live canary proof is correct in the provider dashboard, recipient inbox, and `invoice_results`.

Do not use live bulk with placeholder credentials or unverified email recipients.
