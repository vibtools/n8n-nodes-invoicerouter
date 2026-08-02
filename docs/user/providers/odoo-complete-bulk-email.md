# InvoiceRouter Template 001 — Odoo Complete Bulk Email Sending System

This provider template is for InvoiceRouter v2.0.0 and the Odoo JSON-RPC adapter.

## What this template does

- Reads Odoo provider/API details from the `provider` sheet.
- Reads recipients from the `email_list` sheet.
- Builds invoices from the InvoiceRouter n8n Invoice Template node.
- Searches or creates Odoo customers by email.
- Creates Odoo customer invoices.
- Posts invoices when `odooPostInvoice` is true.
- Attempts invoice email sending when `odooSendInvoiceEmail` is true.
- Writes lifecycle results into `invoice_results`.

## Included files

- `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_GOOGLE_SHEETS_TEMPLATE.xlsx`
- `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`
- `provider.csv`
- `email_list.csv`
- `invoice_results.csv`
- `provider.lifecycle.json`
- `provider.recipe.json`
- `provider.template.ygit`
- `QUICKSTART.md`
- `N8N_IMPORT_GUIDE.md`
- `ODOO_SETUP.md`
- `LIVE_TEST_CHECKLIST.md`
- `TROUBLESHOOTING.md`

## Default safety

The workflow import is dry-run safe by default:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

Do not switch to live bulk until dry-run, sandbox/test, and live canary are proven.

## Important Odoo note

This template uses InvoiceRouter's current Odoo JSON-RPC `/jsonrpc` adapter. Odoo 19 documentation states XML-RPC and JSON-RPC endpoints are scheduled for future removal and External JSON-2 is the replacement path. Keep this in mind for long-term provider maintenance.


# Quickstart — Odoo Complete Bulk Email

## 1. Create Google Sheet

1. Upload `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_GOOGLE_SHEETS_TEMPLATE.xlsx` to Google Drive.
2. Open it with Google Sheets.
3. Copy the spreadsheet ID from the URL.

## 2. Fill provider sheet

Replace the placeholder cells in `provider`:

```text
Base URL = https://YOUR-SUBDOMAIN.odoo.com
Endpoint = /jsonrpc
Username = your Odoo username/email
Password = your Odoo password or API key
Database = exact Odoo database name
Extra Config JSON = {"invoiceLifecycle":"createPostAndSendEmail","odooPostInvoice":true,"odooSendInvoiceEmail":true,"odooEmailForceSend":true,"odooEmailBody":"Your invoice has been created and posted."}
```

Keep only one provider environment active while testing.

## 3. Fill email_list

Only `Email` is required.

```text
Email,Name,Address
customer@example.com,Customer Name,
```

## 4. Import n8n workflow

Import `InvoiceRouter_TEMPLATE001_ODOO_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`.
Replace the Google Sheet ID and Google credential in all three Google Sheets nodes.

## 5. Run in order

1. Dry-run validation.
2. Sandbox/test real single recipient.
3. Sandbox/test real bulk.
4. Live canary single recipient.
5. Live bulk.

Never start with live bulk.


# n8n Import Guide — Odoo Complete Bulk Email

## Nodes to configure after import

### Google Sheets - Provider Accounts

```text
Document ID = your Google Spreadsheet ID
Sheet Name = provider
Credential = your Google Sheets OAuth credential
```

### Google Sheets - Email List

```text
Document ID = same spreadsheet ID
Sheet Name = email_list
Credential = same Google Sheets OAuth credential
```

### Google Sheets - Status Writeback

```text
Document ID = same spreadsheet ID
Sheet Name = invoice_results
Matching Column = writeback_key
```

## Provider Selector defaults

```text
Provider Filter = Odoo
Action Filter = Create Invoice
Environment Filter = sandbox
Conditional Routing = false
```

## Invoice Sender modes

### Dry-run

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

### Sandbox/test real send

```text
Dry Run = false
Activation Safety Mode = sandboxRealSend
Expected Environment = sandbox
Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES
```

### Live single/canary

```text
Dry Run = false
Activation Safety Mode = liveRealSend
Expected Environment = live
Live Mode Confirmation = SEND_REAL_INVOICES
Max Invoices Per Execution = 1
```

### Live bulk

```text
Dry Run = false
Activation Safety Mode = liveRealSend
Expected Environment = live
Live Mode Confirmation = SEND_REAL_INVOICES
Live Bulk Confirmation = SEND_BULK_REAL_INVOICES
Max Invoices Per Execution = exact recipient count or approved cap
```


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
