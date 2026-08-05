# Odoo Production Workflow v2.1.1

Use `template/providers/odoo/n8n-import-workflow-production-v2.1.1.json` with the v2.1.1 workbook. The workflow is designed for one production workbook, one account at a time during account verification, and all verified accounts during pilot/production bulk.

## Raw URL import

After the `v2.1.1` tag is published, import this URL in n8n:

```text
https://raw.githubusercontent.com/vibtools/n8n-nodes-invoicerouter/v2.1.1/template/providers/odoo/n8n-import-workflow-production-v2.1.1.json
```

## Required workbook tabs

`provider`, `email_list`, `invoice_results`, `retry_queue`, `writeback_queue`, `account_report`, and `campaign_report` are managed by the workflow. Do not rename their headers.

## Safety behavior

- Blank `Job_ID` is persisted before sending.
- `PROCESSING` is written before the provider call.
- A provider shortage remains `QUEUED`.
- `SENT`, `QUEUED`, `COMPLETED`, and `MANUAL_REVIEW` are never automatically resent.
- Pending Sheet writebacks are repaired before new invoices are created.
- An ambiguous Odoo result stops automatic retry and requires review.
## Long retry and failover behavior

A retry or failover may wait long enough for n8n to resume on another process. The v2.1.1 Phase 01 workflow therefore reads `provider` again and reruns Provider Loader after the wait. Do not bypass the new `Google Sheets - Retry Provider Accounts` or `Google Sheets - Failover Provider Accounts` nodes. Configure the same native Google Spreadsheet and Google Sheets credential on these nodes when importing the final workflow.

- Retry: the original provider profile is required and reselected.
- Failover: previously attempted profiles remain excluded and the next eligible profile is selected.
- A missing/disabled required retry account remains queued or blocked by provider selection; it is not silently replaced after a provider side effect.


## Phase 02 campaign lease

Use exactly one pending `Campaign_ID` per execution. The workflow reads `invoice_results` and `campaign_report` during startup, reconstructs prior campaign state, writes an `ACTIVE` lease, rereads it, and verifies ownership before provider selection.

Do not start another execution for the same campaign while `Run_State=ACTIVE` and `Lock_Expires_At` is in the future. An interrupted run remains blocked until its lease expires or an operator verifies that no execution is active and deliberately resets the lease row. Do not clear sent/terminal recipient rows to bypass the guard.

The managed `campaign_report` headers now include `Run_State`, `Run_ID`, `Lock_Acquired_At`, `Lock_Expires_At`, `Revision`, and `Last_Attempt_At`.

## Phase 03 Odoo evidence behavior

For an ambiguous send-wizard timeout, use provider evidence rather than the transport exception alone:

```text
SENT evidence -> SENT
QUEUED evidence -> QUEUED
explicit failure evidence -> FAILED
no terminal evidence -> UNVERIFIED / manual review
```

Customer lookup is case-insensitive and blocks duplicate Odoo contacts before invoice creation. Mail recipients in RFC display-name form are normalized. `email_evidence.pdfEvidence` separately confirms whether the current-attempt `ir.attachment` is an invoice PDF bound to the expected invoice/report.

Do not manually retry an `UNVERIFIED` email. Reconcile the Odoo invoice, chatter, notifications, outgoing mail, PDF attachment, and recipient inbox first.

## Odoo version and issuer setup

Use Odoo 18 or Odoo 19 only. Put the same stable `Issuer_Key` on every account that is legally allowed to issue interchangeable invoices in one failover group. After preflight, review `Company_ID`, `Company_Name`, `Odoo_Server_Version`, `Capability_Status`, and `Issuer_Compatibility`. Do not proceed when the group reports `ISSUER_MISMATCH` or `ODOO_VERSION_UNSUPPORTED`. A READY capability result still requires a one-recipient canary because create/post/send permission is not proven by read-only preflight.

## Row and provider identity
Do not edit generated `Row_ID` or `Profile_ID`. They are the durable matching keys used for recipient and provider updates. `writeback_queue` operation rows beginning with `OP:` must not be deleted while a run is active.

## Phase 06 report revisions

Do not manually reduce or reuse `Revision`, `Base_Revision`, or `Writer_Run_ID`. The workflow reads the report row again immediately before writing. If another row has advanced the revision, the stale candidate is rejected rather than overwriting newer totals.

`Aggregate_Source=DURABLE_SHEET_REBUILD` means campaign totals were reconstructed from managed recipient/result/retry evidence. `DURABLE_ACCOUNT_REPORT_PLUS_EVENT` means an account total resumed from its highest durable revision and added the current event. `ODOO_PREFLIGHT_ISSUER_EVIDENCE` rows use `Campaign_ID=PREFLIGHT`; they document blocked issuer groups and must not be counted as sent campaign work.

## Final Phase 07 approval

Before production bulk, run the exact n8n 2.31.6 engine smoke, then a reviewed one-recipient canary and a five-recipient/two-account failover pilot. Provider `SENT`, valid PDF evidence, and inbox receipt are separate checks. Production is not approved while any Phase 07 evidence file remains `PENDING`.
