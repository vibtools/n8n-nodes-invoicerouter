# Odoo Setup — Complete Bulk Email

## Required Odoo information

- Base URL, for example `https://your-company.odoo.com`
- Database technical name
- Username/email
- Password or API key accepted by your Odoo instance
- Accounting/Invoicing permissions for customer and invoice operations
- Outgoing email configured in Odoo if you expect customer inbox delivery

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

## What InvoiceRouter attempts

1. Authenticate.
2. Search `res.partner` by email.
3. Create `res.partner` if missing.
4. Create `account.move` customer invoice.
5. Run `account.move.action_post` when posting is enabled.
6. Run Odoo email-send path when email sending is enabled.

## Proof required

For production proof, capture:

- n8n execution success.
- `invoice_results` row with lifecycle fields.
- Odoo invoice status posted.
- Odoo chatter/mail log evidence.
- Recipient inbox evidence.
