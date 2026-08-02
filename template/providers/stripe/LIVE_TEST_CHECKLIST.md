# Live Test Checklist — Stripe

## Before running

```text
[ ] Stripe sandbox row uses sk_test_ key
[ ] email_list has one controlled email
[ ] Invoice Sender is dry-run first
[ ] invoice_results headers exist
[ ] No live row enabled during sandbox proof
```

## Test-mode real send

```text
[ ] Dry Run = false
[ ] Activation Safety Mode = sandboxRealSend
[ ] Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES
[ ] Max Invoices Per Execution = 1
[ ] Stripe dashboard test-mode invoice appears
[ ] invoice_results has provider_invoice_id
[ ] email_send_status is SENT
```

## Live canary

```text
[ ] Live row enabled only
[ ] Environment Filter = live
[ ] Live Mode Confirmation = SEND_REAL_INVOICES
[ ] Max Invoices Per Execution = 1
[ ] Customer receives Stripe invoice email
```

## Live bulk

```text
[ ] Canary passed
[ ] Max Invoices Per Execution equals intended row count
[ ] Live Bulk Confirmation = SEND_BULK_REAL_INVOICES
[ ] Results written for all recipients
```

## Sandbox/live file choice

For Stripe, choose the pair that matches your target mode:

- Sandbox canary: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-canary.json`
- Sandbox bulk: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-bulk.json`
- Live canary: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-canary.json`
- Live bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-bulk.json`

Start live with the canary workflow before the bulk workflow.
