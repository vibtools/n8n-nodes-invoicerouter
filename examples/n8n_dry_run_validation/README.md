# InvoiceRouter n8n Dry-Run Validation Package

This folder contains safe, demo-only data for validating the imported n8n workflow before any sandbox or live invoice send.

## Files

| File | Use |
|---|---|
| `provider-accounts-dry-run.csv` | Import into a private Google Sheet tab named `provider`. |
| `email-list-dry-run.csv` | Import into a private Google Sheet tab named `email_list`. |
| `status-writeback-columns.csv` | Optional result/writeback sheet header reference. |
| `expected-dry-run-outcomes.json` | Expected manual-run outcomes for comparison. |

## Required workflow setting for this package

Before running the imported workflow with these CSV files, set:

```text
Provider Selector -> Environment Filter = sandbox
Invoice Sender -> Dry Run = true
Invoice Sender -> Live Mode Confirmation = empty
```

Do not disable Dry Run for this validation package. The `dry-run.invalid.local` host is intentionally non-production and must not be used for a live send.

## Step 09 status writeback

Use `status-writeback-columns.csv` as the header row for the `invoice_results` tab consumed by `Google Sheets - Status Writeback`. The first column, `writeback_key`, is the append/update matching column. Keep Dry Run enabled while validating row creation and updates.

## Step 11 activation safety fields

The status writeback column template includes activation fields so dry-run, sandbox, and live runs can be audited later:

- `activation_mode`
- `activation_approved`
- `activation_safety`

For the bundled production workflow's first run, `activation_mode` should be `dryRunValidation` and `activation_approved` should be `true` for items that reach Invoice Sender.
