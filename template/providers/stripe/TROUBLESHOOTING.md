# Troubleshooting — Stripe

## `401 Unauthorized`

Usually wrong API key, wrong mode, or missing Authorization header.

Fix:

```text
Use sk_test_ for sandbox/test row.
Use sk_live_ only for live row.
Confirm API Key cell is not blank.
```

## Invoice amount wrong

Stripe expects minor units/cents.

```text
10000 = $100.00 USD
100 = $1.00 USD
```

Update n8n Invoice Template:

```json
{"stripeAmountCents":"10000","stripeCurrencyLower":"usd"}
```

## Email not received

Check:

```text
Stripe dashboard → Billing → Invoices
Invoice status
Customer email
Email logs/events
Spam folder
```

## Duplicate blocked

InvoiceRouter duplicate prevention is working. Run a fresh full workflow execution instead of re-running only the Invoice Sender step.

## Google Sheets writeback missing columns

Run:

```text
google-sheets/auto-fix-invoice-results-headers.gs
```

from Apps Script, then refresh the Google Sheets Status Writeback node schema.
