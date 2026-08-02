# Live Test Checklist — Zoho Books

## Dry-run
- [ ] Provider sheet row loads.
- [ ] email_list rows load.
- [ ] InvoiceRouter builds ready requests.
- [ ] No Zoho API write/email occurs.
- [ ] invoice_results writes dry-run status.

## Test organization real send
- [ ] One email only.
- [ ] Use a Zoho test organization or non-production organization.
- [ ] Set Dry Run = false.
- [ ] Activation Safety Mode = sandboxRealSend.
- [ ] Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES.
- [ ] Confirm Zoho Books contact created.
- [ ] Confirm Zoho Books invoice created.
- [ ] Confirm email endpoint accepted by Zoho.

## Live canary
- [ ] One controlled recipient only.
- [ ] Environment Filter = live.
- [ ] Live provider row Enabled = TRUE.
- [ ] Dry Run = false.
- [ ] Activation Safety Mode = liveRealSend.
- [ ] Live Mode Confirmation = SEND_REAL_INVOICES.
- [ ] Max Invoices Per Execution = 1.
- [ ] Confirm email received or Zoho mail/send log confirms send.

## Live bulk
- [ ] Canary proof is complete.
- [ ] Max Invoices Per Execution equals intended row count.
- [ ] Live Bulk Confirmation = SEND_BULK_REAL_INVOICES.

## Sandbox/live file choice

For Zoho Books, choose the pair that matches your target mode:

- Sandbox canary: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-canary.json`
- Sandbox bulk: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-bulk.json`
- Live canary: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-canary.json`
- Live bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-bulk.json`

Start live with the canary workflow before the bulk workflow.
