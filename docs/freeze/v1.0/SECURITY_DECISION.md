# Version 1 Credential Decision and Guardrails

## Accepted product decision

Version 1 allows provider API keys, secrets, and action configuration to be maintained in Google Sheets because accounts change frequently and many accounts must be managed by non-technical users.

This is a deliberate usability/security trade-off.

## Known boundary

When the built-in Google Sheets node reads a row, secret values may exist in n8n execution input data. Custom nodes cannot retroactively hide data already displayed or saved by the Google Sheets node.

Therefore Version 1 must apply the following guardrails:

- the provider spreadsheet must be private and shared only with the minimum required Google account/service account
- real credentials must never be stored in the repository workbook
- n8n successful execution-data saving should be disabled or minimized for the production workflow
- error execution data and logs must be reviewed because inputs may contain secrets
- Provider Loader must mask API Key, API Secret, tokens, Authorization values, cookies, and session values in its visible output
- Request Builder and Invoice Sender must redact secrets from output, errors, and logs
- Status Manager and audit records must never persist credentials
- screenshots, exports, support bundles, and GitHub issues must use demo credentials only
- the workflow must not expose raw execution data to untrusted n8n users
- Google Sheet revision history may retain old credentials; credential rotation procedures must account for this

## Future hardening

A later version may support n8n Credentials, external secret stores, encrypted sheet values, or credential references. That does not change the accepted Version 1 workflow unless a new freeze is approved.
