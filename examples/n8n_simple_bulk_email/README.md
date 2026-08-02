# InvoiceRouter v1.6.0 Simple Bulk Email Example

Use this folder for the easy workflow:

1. Put provider/API/secrets in `provider`.
2. Paste recipients in `email_list` with only `Email`, optional `Name`, optional `Address`.
3. Edit the Invoice Template node in n8n.
4. Run dry-run first, then sandbox, then live canary.

Odoo rows use provider-sheet credentials only. Email rows never require `partner_id`, `database`, `uid`, or password.
