# n8n Import Guide — Stripe

## Import

1. Open n8n.
2. Import `InvoiceRouter_TEMPLATE002_STRIPE_COMPLETE_BULK_EMAIL_N8N_IMPORT.json`.
3. Keep workflow inactive until configured.

## Replace placeholders

All three Google Sheets nodes:

```text
Document ID = your Google Sheet spreadsheet ID
Credential = your Google Sheets OAuth credential
```

## Default node settings

Provider Selector:

```text
Provider Filter = Stripe
Action Filter = Create Invoice
Environment Filter = sandbox
Conditional Routing = false
```

Invoice Sender:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

## Stripe test-mode real send

Set:

```text
Invoice Sender > Dry Run = false
Activation Safety Mode = sandboxRealSend
Expected Environment = sandbox
Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES
Max Invoices Per Execution = 1
```

## Stripe live canary

Set:

```text
Provider sheet sandbox row Enabled = FALSE
Provider sheet live row Enabled = TRUE
Provider Selector > Environment Filter = live
Invoice Sender > Dry Run = false
Activation Safety Mode = liveRealSend
Expected Environment = live
Live Mode Confirmation = SEND_REAL_INVOICES
Max Invoices Per Execution = 1
```
