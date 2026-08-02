# Google Sheets Easy Mode

InvoiceRouter keeps user input simple:

- `provider`: provider/API/secrets/config only.
- `email_list`: `Email` required; `Name` and `Address` optional.
- `invoice_results`: system output only.

Use `template/status-writeback-columns.csv` as the canonical `invoice_results` header row. If headers are missing, paste the Apps Script in `template/google-sheets/auto-fix-invoice-results-headers.gs` into Google Sheets Apps Script and run `fixInvoiceRouterInvoiceResultsHeaders`.
