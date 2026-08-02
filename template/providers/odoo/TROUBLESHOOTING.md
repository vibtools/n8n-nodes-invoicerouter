# Troubleshooting — Odoo Complete Bulk Email

## Database does not exist

Root cause: `Database` value in provider sheet is wrong. Use the exact Odoo database technical name.

## Authentication failed or empty UID

Check Username, Password/API key, Odoo plan/API access, and database name.

## Invoice posts but email is not received

Check Odoo outgoing mail configuration, customer email, Odoo mail/chatter log, and Odoo permissions.

## Duplicate blocked

This is expected if the same idempotency key already sent. Run the full workflow from Manual Trigger with a fresh request, not only the Invoice Sender step.

## Google Sheets missing columns

Use the workbook in this template or run the Apps Script header fixer included in `google-sheets/auto-fix-invoice-results-headers.gs`.
