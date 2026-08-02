# Odoo Invoice Email Troubleshooting

## Start with the recorded status

### `SENT`

InvoiceRouter found provider-side terminal sent evidence. This does not prove inbox delivery. Check the recipient inbox, spam folder, recipient address, and Odoo outgoing-email configuration if the message is not visible.

### `QUEUED`

Odoo accepted the send operation but the mail is still outgoing, ready, or processing. Inspect Odoo's outgoing mail queue and scheduled actions. Do not rerun the complete workflow merely to force delivery; that can create duplicate business records outside the guarded resume path.

### `FAILED`

Read `email_error_message` and `email_evidence`. Common causes include:

- missing or invalid recipient email;
- outgoing mail server failure;
- sender/from-address rejection;
- Odoo access or template error;
- notification bounce or cancellation.

A retry is automatic only when Status Checker classifies the failure as safe and Status Manager provides an approved send-only resume for the existing invoice.

### `UNVERIFIED`

The Odoo send wizard completed, but the account did not expose sufficient mail evidence. Do not interpret this as sent and do not automatically retry. Review the invoice chatter, outgoing mail records, notifications, PDF attachment, and recipient inbox manually.

InvoiceRouter also returns `UNVERIFIED` when it cannot establish an attempt-specific pre-send baseline or when the wizard creates no new `mail.message`. Existing historical sent records on the invoice are intentionally ignored because they do not prove the current execution sent an email.

## Invoice exists but no email message appears

Verify that the installed package contains the fixed Odoo sender path. The actual headless path must create `account.move.send.wizard` and execute `account.move.send.wizard.action_send_and_print`. A call to `account.move.action_send_and_print` only opens the interactive wizard and is not sufficient.

## Invoice email fails during retry

Confirm these fields are present in `invoice_results`:

```text
provider_invoice_id
lifecycle_checkpoint
retry_resume_stage
retry_resume
```

For an email-stage retry, `retry_resume_stage` must be `invoice.send_email`, and the provider invoice ID must remain unchanged. A second invoice indicates that the old package/workflow is still installed or the retry item bypassed Status Manager.

## Chatter shows an email, but `SENT` is not reported

The chatter message alone may not expose a terminal mail state. Review `email_evidence` for notification and mail state. Depending on Odoo retention and permissions, InvoiceRouter may correctly return `UNVERIFIED` even though the operator can see a message.

## Google Sheets status is blank or literal text

Use a Delta 02-or-later workflow. Lifecycle writeback expressions must use n8n expression syntax such as:

```text
={{ $json.email_send_status }}
```

Run the included header fixer when the `invoice_results` columns do not match `template/status-writeback-columns.csv`.
 The workflow boolean formatter recognizes real booleans and explicit true tokens; the string `"false"` remains `false` rather than becoming truthy JavaScript data.

## Safe escalation sequence

1. Keep the run to one recipient.
2. Record the provider invoice ID.
3. Inspect n8n `rawExecution`, `standardStatus`, and `management.statusWriteback`.
4. Inspect the Odoo invoice, chatter, PDF, notifications, and outgoing mail.
5. Correct the provider or mail configuration.
6. Retry only through the approved Status Manager branch.
7. Move to bulk only after a live canary proves the complete path.
