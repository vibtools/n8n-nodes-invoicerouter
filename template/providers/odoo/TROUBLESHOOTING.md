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

The send operation completed or may have executed, but sufficient current-attempt evidence could not be read. Review the invoice chatter, notifications, outgoing mail, PDF, and inbox. `UNVERIFIED` is manual-review only and is not automatically retried.

## Wizard transport timeout

Read current-attempt evidence before deciding the result. Sent evidence is `SENT`; outgoing/pending evidence is `QUEUED`; exception/bounce/cancel evidence is `FAILED`; no terminal evidence after an ambiguous send is `UNVERIFIED`. Never force an automatic resend from the timeout alone.

## Duplicate contacts found

InvoiceRouter blocks when more than one Odoo contact matches the recipient email. Correct or merge the contacts before rerunning. Mixed-case emails are matched case-insensitively.

## PDF evidence is invalid

Inspect `email_evidence.pdfEvidence`. Confirm `application/pdf`, `res_model=account.move`, the current invoice ID, current-attempt message attachment, and the invoice's `invoice_pdf_report_id`.

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

## Active campaign lease blocks the run

Inspect `campaign_report.Run_State`, `Run_ID`, and `Lock_Expires_At`. Do not clear the lease while its n8n execution is active. For an interrupted run, reconcile n8n execution status and `writeback_queue` before waiting for expiry or deliberately resetting the lease.

## Mixed pending campaigns found

The v2.1.1 production workflow accepts one pending `Campaign_ID` per execution. Isolate the intended campaign rows and rerun; do not bypass the guard or merge unrelated campaigns under the default ID.

## Capability or issuer diagnostic

A fixed-version `ODOO_VERSION_UNSUPPORTED` result is no longer expected. Review the specific missing model/field/method capability reported by preflight. `Issuer_Compatibility=WARNING` is informational only; `Issuer_Key` may be blank, and differing issuer/company evidence does not block provider selection or sending.

## Report stale writer or revision gap

Compare the candidate `Base_Revision` and `Writer_Run_ID` with the current `Revision` and active campaign `Run_ID`. Stop overlapping executions. Preserve the pending writeback envelope. Already-applied or older repair payloads are skipped; a forward revision gap remains blocked for manual reconciliation. Do not lower the Sheet revision or copy an older aggregate over a newer row.
