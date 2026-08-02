# InvoiceRouter v1.6.0 Simple Bulk Email Workflow

## Goal

v1.6.0 keeps the frozen eight-node InvoiceRouter architecture and changes the default workflow contract so non-technical operators only manage two Google Sheet inputs:

1. `provider` — provider account/API/secret details.
2. `email_list` — customer recipients, where only `Email` is required.

The invoice body, line items, dates, currency, notes, and dynamic tags stay in the n8n **Invoice Template** node.

## Operator flow

1. Open the Google Sheet template.
2. Enter provider API account details and secrets in `provider`.
3. Paste bulk recipient emails in `email_list`.
4. Connect Google Sheets in n8n.
5. Configure invoice details in **InvoiceRouter Invoice Template**.
6. Execute the workflow.

InvoiceRouter then processes one recipient row at a time: Email List normalizes the recipient, Provider Selector allocates the configured account, Request Builder merges the provider + invoice template + recipient, Invoice Sender applies safety gates and sends when approved, and Status Manager writes results to `invoice_results`.

## `email_list` contract

Required:

| Column | Required | Behavior |
|---|---:|---|
| `Email` | yes | Recipient email address. Invalid rows are skipped or blocked according to node policy. |
| `Name` | no | If blank, Email List generates a formatted name from the email username. |
| `Address` | no | If blank, address stays empty. |

No provider IDs, Odoo `partner_id`, customer IDs, database names, UID, passwords, provider, action, or environment fields are required in `email_list` for the simple workflow.

## `provider` contract

Provider API and account fields belong in `provider`, including:

| Column | Purpose |
|---|---|
| `Enabled` | enable one or more provider profiles |
| `Provider` | provider name, for example `Odoo` |
| `Account` | account label |
| `Environment` | `sandbox` or `live` |
| `Action` | for example `Create Invoice` |
| `Base URL` | provider host, for example `https://example.odoo.com` |
| `Endpoint` | provider path, for Odoo `/jsonrpc` |
| `Auth Type` | for Odoo use `Odoo JSON-RPC` |
| `Username` | provider/Odoo login or API username |
| `Password` | provider/Odoo password or API key |
| `Database` | Odoo database name when using Odoo |
| `Extra Config JSON` | provider-specific options such as `{ "odooPostInvoice": false }` |

## Odoo v1.6.0 behavior

Odoo no longer requires `partner_id` in the recipient row.

For each recipient, InvoiceRouter performs this provider-side flow in Invoice Sender when Dry Run is disabled and the activation gates approve the item:

1. Authenticate to Odoo JSON-RPC using provider-sheet `Database`, `Username`, and `Password`.
2. Search `res.partner` by recipient email.
3. Create `res.partner` automatically if no match exists, using recipient email, generated/supplied name, and optional address.
4. Create an `account.move` customer invoice for that partner.
5. Keep the invoice as draft by default. Posting can be enabled with `Extra Config JSON` using `{ "odooPostInvoice": true }` after sandbox evidence is accepted.

Dry Run never calls Odoo.

## Safety defaults

The bundled simple workflow keeps the first import run safe:

| Node | Default |
|---|---|
| Provider Selector | `providerFilter = Odoo`, `actionFilter = Create Invoice`, `environmentFilter = sandbox`, `conditionalRouting = false` |
| Email List | `Email`, optional `Name`, optional `Address`, custom columns disabled |
| Request Builder | strict provider validation on, idempotency by provider + invoice + recipient |
| Invoice Sender | Dry Run on, activation mode `dryRunValidation`, bulk safety on |

Sandbox real sends require `SEND_SANDBOX_INVOICES`. Live real sends require `SEND_REAL_INVOICES`.
