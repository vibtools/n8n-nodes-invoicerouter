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
