# Provider Google Sheet Contract

## Version 1 workbook

Reference workbook:

`examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx`

The workbook contains one sheet named `provider`, 18 columns, and 20 action rows covering 19 provider names. Stripe has separate Create and Send rows.

This committed workbook is a **demo/reference preset workbook**. It documents the expected columns, supported provider names, example actions, and example endpoint/value placement. It is not a production credential source and must not be used as-is for live invoice sending.

## Frozen columns

1. Enabled
2. Provider
3. Account
4. Environment
5. Action
6. Method
7. Base URL
8. Endpoint
9. Auth Type
10. API Version
11. Content-Type
12. Header Name
13. Header Value
14. API Key
15. API Secret
16. Extra Value
17. Timeout
18. Notes

## Row model

Each row is an **account action profile**, not merely an account. A provider/account may therefore have multiple rows for different actions.

Stable profile identity:

```text
provider + account + environment + action
```

## Beginner-friendly rule

Provider-specific payload/response presets belong in the package's provider template library. Users normally edit account, credentials, environment, and endpoint overrides in the Sheet rather than writing full payload schemas.

The `Custom` row is the escape hatch for generic REST APIs.

## Required validation

- Enabled must be a boolean-compatible value.
- Provider, Account, Environment, Action, Method, Auth Type, and Timeout are required.
- Base URL and Endpoint are required unless a self-hosted/custom profile is intentionally incomplete and rejected until configured.
- Method must be supported.
- Timeout must be a positive finite number.
- Auth placeholders must match the selected auth type.
- Duplicate profile identities produce a validation error or explicit warning according to node setting.

## Demo data rule

The committed workbook must contain demo values only. Real credentials must never be committed to GitHub.

Any demo conditional examples in a spreadsheet are explanatory only. Runtime approval logic must be represented in the n8n workflow through **Provider Selector → Conditional Routing**, Provider Selector static filters, or explicit n8n IF/Switch nodes. A spreadsheet note or example row must never be treated as the final approval to send a real invoice.

## Production workbook rule

For real use, create a private Google Sheet copy and configure one provider/action/environment profile at a time. Before disabling Dry Run, the enabled rows must satisfy all of these requirements:

1. Placeholder spreadsheet IDs and credential IDs are replaced in n8n.
2. Enabled rows contain real Base URL and Endpoint values for the selected environment.
3. Auth fields match the selected Auth Type.
4. Provider-specific required values are supplied through the Sheet's **Extra Value** field or recipient/template custom fields.
5. Provider Selector filters or conditional routing rules are narrowed to the provider, action, and environment being tested.
6. Recipient rows contain the routing columns expected by the workflow, normally `Provider`, `Action`, and `Environment`, unless static filters are intentionally used.
7. Request Builder produces `sendGuard.approved = true`.
8. Request Builder produces the expected idempotency key for the selected provider/action/recipient.
9. The invoice ID source is stable enough for duplicate-send prevention.
10. The profile has passed a manual Dry Run and a provider sandbox execution.

## Provider-specific required values

The provider Sheet contract covers account/action transport configuration. Runtime invoice-provider requirements are enforced later by Request Builder because it can inspect the selected provider profile, invoice template, and recipient row together.

With **Strict Provider Validation** enabled, these missing values stop request preparation before Invoice Sender:

| Provider | Required runtime values |
|---|---|
| Stripe | `custom_fields.customer_id` |
| Paddle | `custom_fields.price_id` or line-specific `custom_fields.price_id_*` |
| LemonSqueezy | `custom_fields.store_id`, `custom_fields.variant_id` |
| Invoice Ninja | `custom_fields.client_id` |
| Zoho Books | `custom_fields.customer_id`, `custom_fields.organization_id` |
| Xero | `custom_fields.contact_id` or `custom_fields.contact_number` |
| ERPNext | `custom_fields.customer`, `custom_fields.item_code` or line-specific `custom_fields.item_code_*` |
| Odoo | `custom_fields.database`, `custom_fields.uid`, `custom_fields.password`, `custom_fields.partner_id` |
| QuickBooks | `custom_fields.customer_id`, `custom_fields.item_id` or line-specific `custom_fields.item_id_*` |
| FreshBooks | `custom_fields.customer_id` |
| Chargebee | `custom_fields.customer_id` |
| Recurly | `custom_fields.account_code` |
| Square | `custom_fields.location_id`, `custom_fields.order_id`, `custom_fields.customer_id` |
| Braintree | `custom_fields.payment_method_id` |
| Razorpay | `custom_fields.customer_id` or `custom_fields.contact_id` |

These fields may come from Invoice Template custom fields or preserved Email List custom columns. The demo workbook's conditional notes are not approval logic and do not satisfy missing runtime values unless those columns are actually present in the item data.

## Idempotency and recipient data rule

Duplicate-send prevention depends on the `readyRequest.idempotency.value` emitted by Request Builder. The bundled workflow uses provider, profile, action, environment, invoice ID, and recipient email. For production, the recipient/template data should provide a stable invoice ID or stable upstream reference; regenerated demo invoice IDs are acceptable for Dry Run but should not be treated as the only live duplicate-prevention identity.


## Status writeback boundary

The provider workbook remains an input contract. It is not the status-result database. Status/result writeback is emitted by Status Manager as `management.statusWriteback` and should be connected to an explicit downstream n8n write node, such as Google Sheets, database, or HTTP Request. Keep production provider credentials and production result tables separate.

## Step 07 dry-run validation package

`examples/n8n_dry_run_validation/provider-accounts-dry-run.csv` is a minimal Custom REST provider Sheet sample for import/run validation. It is intentionally sandbox-scoped and points to `https://dry-run.invalid.local`. Use it only while Invoice Sender Dry Run is enabled. It exists to validate workflow wiring, routing, guard metadata, and status/writeback outputs; it is not a provider sandbox credential file and must not be used for live invoice sending.
