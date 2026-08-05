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

## v2.1.1 canonical production workflow

Use `n8n-import-workflow-production-v2.1.1.json` for new production setups. It is stored in this public `template/` folder so n8n can import it from the release raw URL:

```text
https://raw.githubusercontent.com/vibtools/n8n-nodes-invoicerouter/v2.1.2/template/providers/odoo/n8n-import-workflow-production-v2.1.1.json
```

The production workbook now includes `writeback_queue`; campaign reporting includes `Pause_Reason`, run lease, revision, and last-attempt fields. Job identity and provider allocation are persisted before transport, Sheet writes are ordered before the loop advances, and pending write bundles are repaired before new provider work. `n8n-import-workflow-live-bulk.json` remains an exact compatibility copy.


## Phase 02 campaign execution rule

Keep one pending `Campaign_ID` per execution. Configure the new startup reads (`invoice_results` and `campaign_report`) and all campaign lease Google Sheets nodes with the same workbook/credential. The workflow acquires and rereads an `ACTIVE` lease before the provider loop and releases it afterward. Never run the same campaign concurrently.

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
- `FAILED`: explicit terminal provider evidence or a definitive wizard/setup failure exists.
- `UNVERIFIED`: the send operation may have executed, but current-attempt terminal evidence could not be established.

`SENT` is not a guarantee of recipient inbox delivery. The live-canary checklist includes a separate inbox check.

## Phase 03 truthfulness rule

Evidence precedence is `SENT`, `QUEUED`, explicit failure, then `UNVERIFIED` for ambiguous/no-evidence send transport. Duplicate Odoo contacts are blocked before invoice creation. RFC display-name recipients are normalized. PDF proof reads and validates the actual `ir.attachment` against the current invoice, current attempt, and `invoice_pdf_report_id`.

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


## v2.1.0 bulk reliability (historical)

The v2.1.0 workflow was superseded by the v2.1.1 corrective production template. `n8n-import-workflow-live-bulk.json` now mirrors the v2.1.1 canonical workflow for compatibility. The workbook includes provider status, recipient status, retry queue, account report, and campaign report tabs.

## Odoo capability validation and legal issuer

The production adapter uses a shared capability manifest without a fixed Odoo major-version allowlist. Odoo 18 and 19 retain documented metadata profiles. Set `Issuer_Key` on every enabled provider row. Accounts in one `Failover_Group` must resolve to the same authenticated Odoo company. Missing required capabilities and issuer mismatches are blocked before provider work.

## Phase 06 monotonic reporting

`campaign_report` and `account_report` writes use `Base_Revision`, `Revision`, `Writer_Run_ID`, and `Aggregate_Source`. The workflow rereads the current report row before the main write and rejects stale writers, wrong campaign lease owners, and revision gaps. Startup campaign totals are rebuilt from `email_list`, `invoice_results`, and `retry_queue`; an older aggregate row is not treated as the source of truth. `ISSUER_MISMATCH` preflight evidence is written to `account_report` with `Campaign_ID=PREFLIGHT` and never enters provider selection.
