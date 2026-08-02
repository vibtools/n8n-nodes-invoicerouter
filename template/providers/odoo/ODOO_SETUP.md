# Odoo Setup — Complete Bulk Email

## Required Odoo information

- Base URL, for example `https://your-company.odoo.com`.
- Database technical name.
- Username/email.
- Password or API key accepted by the Odoo instance.
- Accounting/Invoicing permissions for customer and invoice operations.
- Access to create and execute the invoice send wizard.
- Read access needed for invoice, message, notification, outgoing-mail, and attachment evidence.
- Working outgoing email configuration for customer delivery.

## Required provider sheet fields

```text
Provider = Odoo
Environment = sandbox or live
Action = Create Invoice
Method = POST
Endpoint = /jsonrpc
Auth Type = Odoo JSON-RPC
```

## Extra Config JSON

```json
{"invoiceLifecycle":"createPostAndSendEmail","odooPostInvoice":true,"odooSendInvoiceEmail":true,"odooEmailForceSend":true,"odooEmailBody":"Your invoice has been created and posted."}
```

## Runtime sequence

1. Authenticate.
2. Search `res.partner` by recipient email.
3. Create the partner if missing.
4. Create the `account.move` customer invoice.
5. Post the invoice with `account.move.action_post`.
6. Read the actual invoice number and state.
7. Create `account.move.send.wizard` for the existing invoice.
8. Execute `account.move.send.wizard.action_send_and_print`.
9. Inspect message, notification, outgoing-mail, recipient, and PDF evidence.

`account.move.action_send_and_print` alone is only an interactive wizard opener and is not used as sent proof.

## Permissions check

Before live use, confirm the configured Odoo user can:

- read/create customers;
- create/post customer invoices;
- create/execute `account.move.send.wizard`;
- read the generated invoice/PDF;
- read the relevant mail evidence models required by your Odoo deployment.

Insufficient evidence-model permissions may produce `UNVERIFIED` even when the wizard completes.

## Production proof

Capture:

- n8n execution and `invoice_results` output;
- provider customer/invoice IDs;
- actual invoice number and posted state;
- wizard completion and email evidence;
- PDF attachment evidence;
- correct recipient;
- outgoing queue or sent state;
- recipient inbox result.
