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
- [ ] Duplicate-contact ambiguity blocks before invoice creation.
- [ ] Mixed-case partner email reuses the exact existing contact.

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
- [ ] `email_evidence.pdfEvidence.status=VALID`.
- [ ] PDF MIME/model/invoice ID/current-attempt/report binding were recorded.
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
- ambiguous wizard transport has no terminal evidence but is reported as sent or automatically retried;
- duplicate contacts are selected automatically;
- PDF evidence is reported valid without the expected attachment identity;
- literal/blank lifecycle fields appear in writeback;
- critical authentication, authorization, validation, or environment errors occur.

## Capability and issuer gate

- [ ] Every enabled Odoo account reports major version 18 or 19.
- [ ] `Capability_Status=CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN` was reviewed.
- [ ] Every enabled account has a non-placeholder `Issuer_Key`.
- [ ] All accounts in each failover group resolve to the same `Company_ID`/`Company_Name`.
- [ ] `Issuer_Compatibility=VERIFIED` before canary/failover.
- [ ] Create/post/send permission was proven by the controlled canary, not inferred from preflight.

## Phase 06 report acceptance

- [ ] Campaign and account `Revision` values only increase.
- [ ] Every candidate uses the current row's `Revision` as `Base_Revision`.
- [ ] Campaign `Writer_Run_ID` matches the active lease `Run_ID`.
- [ ] Restart reconstruction matches `email_list`, `invoice_results`, and `retry_queue` evidence.
- [ ] An intentionally stale report candidate is rejected without overwriting the newer row.
- [ ] An already-applied stale repair payload is skipped and its repair envelope can complete.
- [ ] `ISSUER_MISMATCH` evidence appears in `account_report` with `Campaign_ID=PREFLIGHT` and no provider side effect.

## Phase 07 final release evidence

- [ ] Exact `n8n@2.31.6` engine smoke evidence is `PASS`.
- [ ] One-recipient canary: one posted invoice, zero duplicates, provider `SENT`, valid PDF, inbox confirmed, Sheet row matched, operation envelope `COMPLETE`.
- [ ] Five-recipient/two-account pilot: failover and restart/other-worker resume exercised, five terminal rows, zero duplicates, no revision regression, stale writer rejected.
- [ ] Sanitized evidence contains no recipient addresses or secrets.
- [ ] After GitHub/npm publication and the n8n Community Nodes update, `npm run verify:phase07:evidence` passes before production bulk approval.


## Final corrective audit acceptance

- [ ] Exact n8n 2.31.6 evidence reports canonical import/export at 126 nodes, 141 edges, and eight custom nodes.
- [ ] A forced restart after `PROVIDER_PENDING` reuses the same stable reference and creates no duplicate invoice/email.
- [ ] A changed/expired Run_ID immediately before provider work blocks the operation.
- [ ] Canary/pilot evidence hashes match the engine-tested tarball and canonical workflow.
- [ ] Tag release npm credential preflight passes before GitHub Release creation.

- [ ] First-run identity persistence updates the original `email_list` row by virtual `row_number`; it does not append a duplicate row.
- [ ] Subsequent processing/status writes target the same row by immutable `Row_ID`.
