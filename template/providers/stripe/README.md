# InvoiceRouter Template 002 — Stripe Complete Bulk Email Sending System

This provider template is for InvoiceRouter v2.0.0 Step 14D and Stripe Billing/Invoicing.

## What this template does

- Reads Stripe API key/config from the `provider` sheet.
- Reads recipients from the `email_list` sheet.
- Builds invoices from the InvoiceRouter n8n Invoice Template node.
- Creates a Stripe Customer for each invoice recipient.
- Creates a Stripe draft invoice with `collection_method=send_invoice`.
- Adds one invoice item to the draft invoice.
- Finalizes the invoice.
- Sends the invoice email through Stripe.
- Writes lifecycle output into `invoice_results`.

## Included files

- `InvoiceRouter_TEMPLATE002_STRIPE_COMPLETE_BULK_EMAIL_GOOGLE_SHEETS_TEMPLATE.xlsx`
- `InvoiceRouter_TEMPLATE002_STRIPE_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`
- `provider.csv`
- `email_list.csv`
- `invoice_results.csv`
- `provider.lifecycle.json`
- `provider.recipe.json`
- `extra-config.example.json`
- `provider.template.ygit`
- `QUICKSTART.md`
- `STRIPE_SETUP.md`
- `N8N_IMPORT_GUIDE.md`
- `LIVE_TEST_CHECKLIST.md`
- `TROUBLESHOOTING.md`
- `SOURCES.md`

## Default safety

The workflow import is dry-run safe by default:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

Stripe sandbox/test mode means using a Stripe `sk_test_...` key in the sandbox row.

## Amount handling

Stripe invoice item amounts are in the smallest currency unit. The default n8n Invoice Template uses:

```json
{
  "stripeAmountCents": "10000",
  "stripeCurrencyLower": "usd",
  "stripeDaysUntilDue": "30",
  "stripeCollectionMethod": "send_invoice"
}
```

`10000` means `$100.00 USD`.

## Production claim

This is a provider template. Run Stripe test-mode proof and one live canary before using it for live bulk.
