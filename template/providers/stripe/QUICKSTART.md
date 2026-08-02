# Quickstart — Stripe Complete Bulk Email

## 1. Create Google Sheet

1. Upload `InvoiceRouter_TEMPLATE002_STRIPE_COMPLETE_BULK_EMAIL_GOOGLE_SHEETS_TEMPLATE.xlsx` to Google Drive.
2. Open it with Google Sheets.
3. Copy the spreadsheet ID from the URL.

## 2. Fill provider sheet

Use the sandbox row first:

```text
Enabled = TRUE
Provider = Stripe
Account = Stripe Test/Sandbox
Environment = sandbox
Base URL = https://api.stripe.com
Endpoint = /v1/invoices
Auth Type = bearer
API Key = sk_test_...
```

Keep the live row disabled until test-mode proof passes.

## 3. Fill email_list

Only `Email` is required.

```text
Email,Name,Address
customer@example.com,Customer Example,
```

## 4. Import n8n workflow

Import `InvoiceRouter_TEMPLATE002_STRIPE_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`.

Replace the Google Sheet ID and credential in:

```text
Google Sheets - Provider Accounts
Google Sheets - Email List
Google Sheets - Status Writeback
```

## 5. Run in order

1. Dry-run validation.
2. Stripe test-mode real send with one controlled email.
3. Stripe live draft/send canary with one controlled email.
4. Live bulk only after canary success.

## 6. Expected result

`invoice_results` should show:

```text
transport_status = SUCCESS
provider_id = stripe
provider_invoice_id = in_...
email_send_status = SENT
invoice_url / pdf_url = Stripe hosted links when returned
```

## Sandbox/live file choice

For Stripe, choose the pair that matches your target mode:

- Sandbox canary: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-canary.json`
- Sandbox bulk: `google-sheets-template-sandbox.xlsx` + `n8n-import-workflow-sandbox-bulk.json`
- Live canary: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-canary.json`
- Live bulk: `google-sheets-template-live.xlsx` + `n8n-import-workflow-live-bulk.json`

Start live with the canary workflow before the bulk workflow.
