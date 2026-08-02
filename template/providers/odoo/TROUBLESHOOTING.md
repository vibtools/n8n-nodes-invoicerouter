# Troubleshooting — Odoo Complete Bulk Email

## Database does not exist

The `Database` value is wrong. Use the exact Odoo database technical name.

## Authentication failed or empty UID

Check Username, Password/API key, Odoo API access, and database name. Authentication/authorization failures are not automatically retried.

## Invoice creates but does not post

Read `lifecycle_failed_step`, `email_error_message`, and `lifecycle_checkpoint`. A safe retry should use `retry_resume_stage=invoice.post` and reuse the same `provider_invoice_id`.

## Invoice posts but email status is `FAILED`

Inspect `email_error_message` and `email_evidence`. Check:

- recipient address;
- Odoo outgoing mail server;
- sender/from address;
- invoice mail template;
- Odoo permissions;
- notification bounce/exception/cancel state.

A retry must come from Status Manager as `invoice.send_email` resume against the same invoice.

## Email status is `QUEUED`

Odoo accepted the operation but has not exposed terminal sent evidence. Inspect outgoing mail and scheduled actions. Do not rerun the full create flow.

## Email status is `UNVERIFIED`

The wizard completed, but sufficient evidence could not be read. Review the invoice chatter, notifications, outgoing mail, PDF, and inbox. `UNVERIFIED` is manual-review only and is not automatically retried.

## Status is `SENT` but inbox is empty

`SENT` is provider-side transport evidence, not guaranteed inbox delivery. Check spam, recipient address, Odoo mail logs, domain authentication, sender reputation, and provider limits.

## Duplicate blocked

This is expected when the same idempotency key is executed again. Run the complete workflow with a legitimate new input, or allow the approved retry-resume branch to continue the existing invoice. Do not execute Invoice Sender manually.

## A retry created another invoice

Stop live/bulk execution. Confirm the installed package and workflow include Delta 02-or-later lifecycle resume fields:

```text
lifecycle_checkpoint
retry_resume_stage
retry_resume
```

The email-stage retry must preserve the original `provider_invoice_id`.

## Google Sheets missing columns

Use the workbook in this template or run `google-sheets/auto-fix-invoice-results-headers.gs`. The header must match `template/status-writeback-columns.csv`.

## Google Sheets contains literal expressions

Use a synchronized workflow. Valid n8n mappings look like:

```text
={{ $json.email_send_status }}
```
