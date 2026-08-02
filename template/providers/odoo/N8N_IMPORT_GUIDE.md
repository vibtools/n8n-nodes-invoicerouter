# n8n Import Guide — Odoo Complete Bulk Email

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
- Live bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-bulk.json`

Start live with the canary workflow before the bulk workflow.
