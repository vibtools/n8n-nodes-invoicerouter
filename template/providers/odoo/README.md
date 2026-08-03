# Odoo Complete Bulk Email Template

This pack configures InvoiceRouter's built-in Odoo JSON-RPC lifecycle without changing the frozen eight-node architecture.

## Runtime flow

```text
provider sheet credentials
→ customer search/create
→ invoice create
→ invoice post
→ account.move.send.wizard create
→ account.move.send.wizard action_send_and_print
→ mail/PDF evidence inspection
→ truthful status writeback
```

## Included modes

| Mode | Workbook | Workflow | Provider CSV |
|---|---|---|---|
| Dry-run/default | `google-sheets-template.xlsx` | `n8n-import-workflow-dry-run.json` | `provider.csv` |
| Sandbox canary | `google-sheets-template-sandbox.xlsx` | `n8n-import-workflow-sandbox-canary.json` | `provider.sandbox.csv` |
| Sandbox bulk | `google-sheets-template-sandbox.xlsx` | `n8n-import-workflow-sandbox-bulk.json` | `provider.sandbox.csv` |
| Live canary | `google-sheets-template-live.xlsx` | `n8n-import-workflow-live-canary.json` | `provider.live.csv` |
| Live bulk | `google-sheets-template-live.xlsx` | `n8n-import-workflow-live-bulk.json` | `provider.live.csv` |

The default import remains dry-run safe. Live bulk retains `SEND_REAL_INVOICES` and `SEND_BULK_REAL_INVOICES` gates.

## Recipient contract

`email_list` requires only `Email`; `Name` and `Address` are optional. Public samples use reserved `example.com` addresses. Replace them only in your private working Sheet.

## Email result contract

- `SENT`: provider-side terminal sent evidence was found.
- `QUEUED`: provider accepted/processing evidence was found.
- `FAILED`: the send stage or provider evidence failed.
- `UNVERIFIED`: the wizard completed but final evidence could not be established.

`SENT` is not a guarantee of recipient inbox delivery. The live-canary checklist includes a separate inbox check.

## Safe retry

Post and email failures resume the existing provider invoice when Status Manager supplies an approved lifecycle checkpoint. Do not rerun a failed live item by executing Invoice Sender manually.

## Release order

Use this order:

1. Apply all approved deltas and run `npm run verify`.
2. Submit the complete final project ZIP for forensic audit.
3. Correct any audit finding and repeat the audit.
4. Publish only after the final audit passes.
5. Update InvoiceRouter through n8n Community Nodes.
6. Run a one-recipient live canary.
7. Enable live bulk only after evidence is accepted.

## Guides

- `QUICKSTART.md`
- `N8N_IMPORT_GUIDE.md`
- `ODOO_SETUP.md`
- `MODE_SELECTION.md`
- `LIVE_TEST_CHECKLIST.md`
- `TROUBLESHOOTING.md`


## v2.1.0 bulk reliability

Use `n8n-import-workflow-live-bulk.json` as the canonical one-workflow Odoo template. The workbook includes provider status, recipient status, retry queue, account report, and campaign report tabs.
