# Provider Google Sheet Contract

## Version 1 workbook

Reference workbook:

`examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx`

The workbook contains one sheet named `provider`, 18 columns, and 20 action rows covering 19 provider names. Stripe has separate Create and Send rows.

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
