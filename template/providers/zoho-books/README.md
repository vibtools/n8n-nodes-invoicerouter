# InvoiceRouter Template 003 — Zoho Books Complete Bulk Email Sending System

This provider template is for InvoiceRouter v2.0.0 and the Step 14D declarative provider recipe runtime.

## What this template does

- Reads Zoho Books provider/API details from the `provider` sheet.
- Reads recipients from the `email_list` sheet.
- Builds invoices from the InvoiceRouter n8n Invoice Template node.
- Creates a Zoho Books customer contact for the recipient.
- Creates a Zoho Books invoice for that contact.
- Marks the invoice as sent when the lifecycle includes post/finalize.
- Sends the invoice by email through Zoho Books.
- Writes lifecycle results into `invoice_results`.

## Required Zoho fields

- `API Key` = Zoho OAuth access token.
- `Extra Value` = Zoho Books `organization_id`.
- `Base URL` = Zoho API root URL for the correct data center, usually `https://www.zohoapis.com`.
- `Extra Config JSON` = declarative provider recipe config included in this template.

## Default safety

The n8n workflow import is dry-run safe by default:

```text
Dry Run = true
Activation Safety Mode = dryRunValidation
Expected Environment = sandbox
```

## Support tier

This is a template-ready provider pack. It has not been live-proofed in your Zoho Books account yet.
