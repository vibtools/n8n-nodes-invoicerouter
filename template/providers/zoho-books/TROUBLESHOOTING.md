# Troubleshooting — Zoho Books Template

## 401 / unauthorized

Likely causes:
- Expired OAuth access token.
- Incorrect data-center base URL.
- Missing Zoho Books scopes.

## Invalid organization_id

Check provider sheet `Extra Value`. It must be the numeric Zoho Books organization ID.

## Invoice email endpoint succeeds but customer does not receive email

Check:
- Zoho Books email sending settings.
- Organization email verification.
- Recipient spam/junk folder.
- Zoho Books sent/activity logs.

## Duplicate contacts

The current declarative recipe creates a contact per run. For persistent contact reuse, a future template revision can add contact lookup/reuse proof when runtime branching is supported for Zoho search results.

## Missing invoice_results columns

Run the Apps Script in `google-sheets/auto-fix-invoice-results-headers.gs`.
