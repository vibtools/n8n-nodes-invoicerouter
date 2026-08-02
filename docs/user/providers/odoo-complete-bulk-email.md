# InvoiceRouter Template 001 — Odoo Complete Bulk Email Sending System

This provider template is for InvoiceRouter v2.0.0 and the built-in Odoo JSON-RPC adapter.

## What this template does

- Reads Odoo provider/API details from the `provider` sheet.
- Reads recipients from the `email_list` sheet.
- Builds invoices from the InvoiceRouter n8n Invoice Template node.
- Searches or creates Odoo customers by email.
- Creates Odoo customer invoices.
- Posts invoices when `odooPostInvoice` is true.
- Creates and executes the standard Odoo invoice send wizard when `odooSendInvoiceEmail` is true.
- Reads Odoo message, notification, outgoing-mail, and PDF evidence when the account permits it.
- Writes truthful lifecycle results, checkpoints, evidence, and retry-resume fields into `invoice_results`.

## Included files

- `google-sheets-template.xlsx`
- `google-sheets-template-sandbox.xlsx`
- `google-sheets-template-live.xlsx`
- `n8n-import-workflow-dry-run.json`
- `n8n-import-workflow-sandbox-canary.json`
- `n8n-import-workflow-sandbox-bulk.json`
- `n8n-import-workflow-live-canary.json`
- `n8n-import-workflow-live-bulk.json`
- `provider.csv`
- `provider.sandbox.csv`
- `provider.live.csv`
- `email_list.csv`
- `invoice_results.csv`
- `provider.lifecycle.json`
- `provider.recipe.json`
- `provider.template.ygit`
- setup, import, troubleshooting, and live-test guides

## Default safety

The default workflow import is dry-run safe:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

Do not switch to live bulk until the package has passed the final full-project forensic audit, has been published, has been updated through n8n Community Nodes, and a one-recipient live canary has passed.

## Actual email path

The headless Odoo email path is:

```text
account.move create
→ account.move action_post
→ account.move.send.wizard create
→ account.move.send.wizard action_send_and_print
→ provider evidence inspection
```

The older `account.move.action_send_and_print` opener is not treated as a completed email send.

## Status meanings

| Status | Operator action |
|---|---|
| `SENT` | Confirm recipient inbox result; retain provider evidence. |
| `QUEUED` | Wait for Odoo mail processing and inspect the outgoing queue. |
| `FAILED` | Correct the recorded error; retry only through the approved resume branch. |
| `UNVERIFIED` | Review Odoo manually; do not automatically retry or claim sent. |

## Duplicate-safe retry

When an invoice already exists:

- post failure resumes the existing invoice at `invoice.post`;
- email failure resumes the existing invoice at `invoice.send_email`;
- the retry branch must preserve the provider invoice ID and lifecycle checkpoint;
- an unverified email requires manual review and is not retried automatically.

## Required run order

1. Dry-run validation.
2. Sandbox/test single recipient.
3. Sandbox/test retry-resume proof.
4. Sandbox/test approved bulk.
5. Final full-source forensic audit and any required correction.
6. Publish the approved release.
7. Update the package through n8n Community Nodes and restart/verify the runtime.
8. Live canary with one recipient.
9. Live bulk only after the canary evidence is accepted.

## Production evidence

Capture all of the following:

- request ID and idempotency key;
- Odoo customer and invoice IDs;
- actual Odoo invoice number and posted state;
- invoice PDF attachment evidence;
- email status and `email_evidence`;
- lifecycle checkpoint and retry-resume evidence;
- `invoice_results` row;
- Odoo chatter/outgoing-mail evidence;
- recipient inbox result.

## Important Odoo API note

This template uses InvoiceRouter's current Odoo JSON-RPC `/jsonrpc` adapter. Odoo's long-term API direction may require a future approved adapter update. That future migration is outside this release and must not be performed silently.
