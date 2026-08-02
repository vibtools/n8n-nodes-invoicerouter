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
