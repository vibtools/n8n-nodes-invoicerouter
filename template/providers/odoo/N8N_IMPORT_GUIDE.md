# n8n Import Guide — Odoo Complete Bulk Email

## v2.1.1 recommended import

For every new production setup, import `n8n-import-workflow-production-v2.1.1.json` or the release raw URL. Connect the same native Google Spreadsheet to every Google Sheets node. Required managed tabs are `provider`, `email_list`, `invoice_results`, `retry_queue`, `writeback_queue`, `account_report`, and `campaign_report`.

Do not manually rewire Request Builder. The v2.1.1 package supports the canonical embedded input directly.

## Nodes to configure after import

### Google Sheets - Provider Accounts

```text
Document ID = your Google Spreadsheet ID
Sheet Name = provider
Credential = your Google Sheets OAuth credential
```

### Google Sheets - Email List

```text
Document ID = same spreadsheet ID
Sheet Name = email_list
Credential = same Google Sheets OAuth credential
```

### Google Sheets - Status Writeback

```text
Document ID = same spreadsheet ID
Sheet Name = invoice_results
Matching Column = writeback_key
```

## Provider Selector defaults

```text
Provider Filter = Odoo
Action Filter = Create Invoice
Environment Filter = sandbox
Conditional Routing = false
```

## Invoice Sender modes

### Dry-run

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

### Sandbox/test real send

```text
Dry Run = false
Activation Safety Mode = sandboxRealSend
Expected Environment = sandbox
Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES
```

### Live single/canary

```text
Dry Run = false
Activation Safety Mode = liveRealSend
Expected Environment = live
Live Mode Confirmation = SEND_REAL_INVOICES
Max Invoices Per Execution = 1
```

### Live bulk

```text
Dry Run = false
Activation Safety Mode = liveRealSend
Expected Environment = live
Live Mode Confirmation = SEND_REAL_INVOICES
Live Bulk Confirmation = SEND_BULK_REAL_INVOICES
Max Invoices Per Execution = exact recipient count or approved cap
```

## Sandbox/live file choice

For Odoo, choose the pair that matches your target mode:

- Sandbox canary: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-canary.json`
- Sandbox bulk: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-bulk.json`
- Live canary: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-canary.json`
- Production/canary/bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-production-v2.1.1.json`

Use the single v2.1.1 production workflow with one enabled account and one PENDING recipient for account validation, then enable individually verified accounts for a five-recipient pilot.
## v2.1.1 Phase 01 retry/failover rehydration nodes

The canonical production workflow includes two additional provider reads used only after waits:

- `Google Sheets - Retry Provider Accounts`
- `Google Sheets - Failover Provider Accounts`

Set both nodes to the same native Google Spreadsheet, `provider` tab, and Google Sheets credential used by `Google Sheets - Provider Accounts`. Do not reconnect either Wait node directly to Invoice Sender or Provider Selector.



## v2.1.1 Phase 02 campaign nodes

Configure these nodes with the same native Spreadsheet and Google Sheets credential:

- `Google Sheets - Invoice Results Input` → `invoice_results`
- `Google Sheets - Campaign Report Input` → `campaign_report`
- `Google Sheets - Campaign Lease Acquire` → `campaign_report`
- `Google Sheets - Campaign Lease Verify` → `campaign_report`
- `Google Sheets - Campaign Release Read` → `campaign_report`
- `Google Sheets - Campaign Lease Release` → `campaign_report`

Do not bypass `Prepare Campaign Lease`, `Verify Campaign Lease`, or the release path. Submit only one pending `Campaign_ID` in each execution.

## Phase 04 provider columns

The `provider` tab must include `Issuer_Key`, `Company_ID`, `Company_Name`, `Odoo_Server_Version`, `Odoo_Major_Version`, `Capability_Status`, and `Issuer_Compatibility`. Fill `Issuer_Key`; preflight writes the remaining evidence. Use only Odoo 18 or 19.
