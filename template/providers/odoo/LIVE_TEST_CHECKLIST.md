# Live Test Checklist — Odoo Complete Bulk Email

## Dry-run

- [ ] `Dry Run=true`
- [ ] `activation_mode=dryRunValidation`
- [ ] `transport_status=DRY_RUN`

## Sandbox/test real single

- [ ] One recipient only.
- [ ] `Dry Run=false`
- [ ] `activationSafetyMode=sandboxRealSend`
- [ ] `Sandbox Mode Confirmation=SEND_SANDBOX_INVOICES`
- [ ] Odoo invoice created.
- [ ] Lifecycle writeback present.

## Live canary

- [ ] One recipient only.
- [ ] `Environment Filter=live`
- [ ] Live provider row enabled.
- [ ] `Live Mode Confirmation=SEND_REAL_INVOICES`
- [ ] `Max Invoices Per Execution=1`
- [ ] Odoo invoice created and posted.
- [ ] Email send attempted and status recorded.

## Live bulk

- [ ] Recipient count approved.
- [ ] `Live Bulk Confirmation=SEND_BULK_REAL_INVOICES`
- [ ] `Max Invoices Per Execution` set to approved cap.
- [ ] `invoice_results` records every recipient.
- [ ] Odoo and inbox evidence captured.

## Sandbox/live file choice

For Odoo, choose the pair that matches your target mode:

- Sandbox canary: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-canary.json`
- Sandbox bulk: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-bulk.json`
- Live canary: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-canary.json`
- Live bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-bulk.json`

Start live with the canary workflow before the bulk workflow.
