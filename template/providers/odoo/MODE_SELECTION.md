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

## Production v2.1.1

Use `google-sheets-template-live.xlsx` with `n8n-import-workflow-production-v2.1.1.json`. The same workflow supports one-account validation, pilot bulk, failover testing, and production bulk by changing enabled provider rows and campaign safety values.


## Campaign concurrency rule

All production/canary/bulk uses of the v2.1.1 canonical workflow require one pending `Campaign_ID` per execution. Do not launch two executions for the same campaign. `campaign_report` lease verification blocks most overlaps, but Google Sheets is not a transactional lock service.

## Version and issuer behavior for every mode

Dry-run, sandbox, canary, and live-bulk templates share the same capability validation. Odoo version is diagnostic metadata; accounts enter the runtime pool when the required capability surface is validated. `Issuer_Key` and company consistency are optional diagnostics and do not restrict failover-group membership.
