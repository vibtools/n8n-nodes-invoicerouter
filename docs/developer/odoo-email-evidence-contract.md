# Odoo Invoice Email Evidence Contract

## Scope

This contract defines how the built-in Odoo JSON-RPC adapter executes and reports the invoice email stage without changing the frozen eight-node architecture.

## Execution path

For `createPostAndSendEmail`, Invoice Sender performs the Odoo lifecycle in this order:

1. Authenticate against the configured database.
2. Resolve or create the customer.
3. Create the `account.move` customer invoice.
4. Post the invoice with `account.move.action_post`.
5. Read the posted invoice metadata.
6. Create `account.move.send.wizard` for the existing invoice.
7. Execute `account.move.send.wizard.action_send_and_print`.
8. Inspect provider-side message, notification, mail, and PDF evidence.

Calling `account.move.action_send_and_print` alone is not considered an email-send operation because that model method opens the interactive send wizard. Headless execution must create and execute the wizard itself.

## Status meanings

| Status | Required meaning |
|---|---|
| `NOT_REQUESTED` | The selected lifecycle did not request an email stage. |
| `QUEUED` | Odoo accepted the email and provider evidence shows an outgoing/ready/process state, but not a terminal sent state. |
| `SENT` | Provider evidence shows a terminal sent state for the invoice recipient. |
| `FAILED` | The wizard failed or Odoo evidence shows exception, bounce, cancel, or another terminal failure. |
| `UNVERIFIED` | The wizard completed, but InvoiceRouter could not read sufficient provider evidence to claim queued or sent. |

`SENT` is transport evidence, not proof that the message reached the recipient inbox. Inbox delivery remains a separate live-canary acceptance check.

## Evidence output

Invoice Sender exposes the evidence through the lifecycle response and downstream status/writeback fields:

```text
email_send_status
email_send_method
email_error_message
email_evidence
lifecycle_outcome
lifecycle_failed_step
lifecycle_checkpoint
```

`email_evidence` may contain wizard completion, mail message IDs, notification states, outgoing mail states, recipient information, and PDF attachment information. Consumers must not replace these values with HTTP-success assumptions.

### Attempt-bound evidence rule

Terminal evidence is valid only when InvoiceRouter can read a pre-send `mail.message` baseline and bind the post-send notification/mail records to a newly created message ID from the current wizard execution. Historical messages, notifications, or `mail.mail` records from an earlier attempt are never accepted as proof for the current attempt. When the baseline is unreadable or no new message appears, the result is `UNVERIFIED`.

For email notifications, `pending` is treated as queued/processing evidence. Only `sent` (or `mail.mail.state = sent`) is terminal sent evidence.

## Partial outcomes

When the invoice exists or is posted but the requested email stage is queued, failed, or unverified, Status Checker reports a partial lifecycle outcome instead of treating the complete operation as a successful sent invoice.

## Production proof

A deployment is email-proofed only after all of the following are captured for the target Odoo account:

- n8n lifecycle output and `invoice_results` row;
- one Odoo invoice ID and actual invoice number;
- posted invoice state;
- wizard/message/notification/mail evidence;
- generated invoice PDF evidence;
- correct recipient;
- recipient inbox result from a controlled live canary.
