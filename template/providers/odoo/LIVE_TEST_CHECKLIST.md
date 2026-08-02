# Live Test Checklist — Odoo Complete Bulk Email

## Release gate before live testing

- [ ] All approved delta patches are applied in order.
- [ ] `npm run verify` passes.
- [ ] The complete project ZIP has passed final forensic audit.
- [ ] All forensic findings, if any, have been corrected and re-audited.
- [ ] The approved version has been published.
- [ ] n8n Community Nodes shows the approved InvoiceRouter update.
- [ ] n8n has been restarted or otherwise confirmed to load the updated compiled package.

## Dry-run

- [ ] `Dry Run=true`.
- [ ] `activation_mode=dryRunValidation`.
- [ ] `transport_status=DRY_RUN`.
- [ ] No Odoo customer, invoice, mail, or PDF was created.

## Sandbox/test real single

- [ ] One controlled recipient only.
- [ ] `Dry Run=false`.
- [ ] `activationSafetyMode=sandboxRealSend`.
- [ ] `Sandbox Mode Confirmation=SEND_SANDBOX_INVOICES`.
- [ ] Exactly one Odoo invoice was created.
- [ ] Actual invoice number and posted state were recorded.
- [ ] Lifecycle writeback and email evidence were recorded.

## Retry-resume proof

- [ ] A controlled retryable post or email failure was produced safely.
- [ ] `retry_resume_stage` matches the failed stage.
- [ ] `provider_invoice_id` is unchanged after retry.
- [ ] No second customer or invoice was created.
- [ ] `UNVERIFIED` did not retry automatically.

## Live canary

- [ ] One controlled recipient only.
- [ ] `Environment Filter=live`.
- [ ] Live provider row enabled.
- [ ] `Live Mode Confirmation=SEND_REAL_INVOICES`.
- [ ] `Max Invoices Per Execution=1`.
- [ ] Exactly one Odoo invoice was created and posted.
- [ ] Actual Odoo invoice number was recorded.
- [ ] `email_send_method=account.move.send.wizard.action_send_and_print`.
- [ ] `email_send_status` is reviewed as `SENT`, `QUEUED`, `FAILED`, or `UNVERIFIED`.
- [ ] `email_evidence` contains the available provider records.
- [ ] Invoice PDF evidence exists.
- [ ] Recipient address is correct.
- [ ] Odoo chatter/outgoing-mail evidence was captured.
- [ ] The recipient inbox/spam result was captured separately.
- [ ] `invoice_results` matches the provider evidence.

## Live bulk

- [ ] Live canary evidence was accepted.
- [ ] Recipient count and maximum cap were approved.
- [ ] `Live Bulk Confirmation=SEND_BULK_REAL_INVOICES`.
- [ ] Uniform live environment is enforced.
- [ ] Abort thresholds and delay are approved.
- [ ] `invoice_results` records every recipient.
- [ ] Bulk counters distinguish invoice created/posted, email queued/sent/failed/unverified.
- [ ] Odoo and inbox evidence sampling was captured.

## Stop conditions

Stop the run and investigate when:

- a duplicate invoice appears;
- provider invoice IDs change during a stage retry;
- `SENT` lacks provider evidence;
- literal/blank lifecycle fields appear in writeback;
- critical authentication, authorization, validation, or environment errors occur.
