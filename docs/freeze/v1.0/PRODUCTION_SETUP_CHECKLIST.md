# Production Setup Checklist

This checklist separates the committed demo/reference assets from the private configuration required for a real n8n execution.

## Demo/reference assets

The repository may contain:

- the importable workflow template at `workflows/InvoiceRouter-v1-production.json`;
- the reference provider workbook at `examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx`;
- placeholder spreadsheet IDs and placeholder credential IDs;
- demo provider rows and explanatory conditional examples;
- the safe Step 07 import/run validation package under `examples/n8n_dry_run_validation/`.

These assets prove structure, wiring, and package contracts. They do not approve a live invoice send.

## Private production assets

A real run requires private assets outside the repository:

1. A private provider Google Sheet copied from the reference workbook.
2. A private email/recipient Google Sheet.
3. A real Google Sheets credential selected in n8n.
4. One verified provider/action/environment profile enabled at a time during onboarding.
5. Provider-specific IDs, tenant/account values, endpoints, tokens, and required custom fields.
6. A provider sandbox or non-production test account for the first live HTTP execution.

## Before manual Dry Run

For the first imported workflow test, use `examples/n8n_dry_run_validation/` and follow `docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md`. Complete these gates before executing the imported workflow manually:

1. The workflow remains inactive.
2. **Invoice Sender → Dry Run** remains enabled.
3. **Google Sheets - Provider Accounts** points to the private provider Sheet.
4. **Google Sheets - Email List** points to the private recipient Sheet.
5. Both Google Sheets nodes use the intended n8n credential.
6. Disabled/demo rows are not used for the test.
7. Provider Selector routing is intentionally configured:
   - for Step 07 Dry Run validation, keep `environmentFilter = sandbox`;
   - for single-provider onboarding, set static `providerFilter`, `actionFilter`, and `environmentFilter`; or
   - for conditional onboarding, keep **Conditional Routing** enabled and provide recipient `Provider`, `Action`, and `Environment` columns or **Routing Rules JSON**.
8. **Require Conditional Match** remains enabled unless a human explicitly approves fallback routing.
9. The selected provider row has no placeholder Base URL, Endpoint, auth value, or required Extra Value.

## Manual Dry Run review

After a manual Dry Run execution, inspect these outputs before any live HTTP request:

1. **Provider Loader** outputs only masked credential previews.
2. **Provider Selector** selects the intended provider/account/action/environment.
3. **Invoice Template** produces the expected invoice number, totals, currency, due date, and custom fields.
4. **Email List** keeps only intended recipients and skips invalid or duplicate addresses.
5. **Request Builder** produces the expected method, URL, headers, query, body, idempotency key, `providerValidation.errors = []`, and `sendGuard.approved = true`.
6. **Invoice Sender** reports Dry Run output and does not call the provider.
7. **Status Checker** and **Status Manager** do not mark Dry Run or guarded BLOCKED items as provider transport failures.
8. **Status Manager** emits the expected `management.executionLog` and `management.statusWriteback` payloads for every item.
9. The Step 07 expected outcomes file is manually reconciled against the n8n execution output when using the validation package.

## Before disabling Dry Run

Dry Run may be disabled only after all of these are true:

1. The request has been reviewed manually.
2. Provider sandbox credentials are configured.
3. Provider-specific required values are present and **Request Builder → Strict Provider Validation** remains enabled.
4. The provider action is known to be safe for the sandbox account.
5. The recipient list is limited to test recipients.
6. Duplicate-send risk has been reviewed for the selected provider/action.
7. Real invoice IDs are stable enough for the selected idempotency key mode.
8. **Request Builder → Idempotency Key Mode** is reviewed; the bundled workflow uses `Provider + Invoice + Recipient`.
9. **Invoice Sender → Prevent Duplicate Sends** remains enabled, with an approved duplicate TTL and reservation TTL.
10. Execution-data retention and access controls are acceptable for credentials and invoice data.
11. **Invoice Sender → Require Send Guard** is enabled.
12. If Dry Run is disabled, **Live Mode Confirmation** is set to exactly `SEND_REAL_INVOICES` only on the reviewed workflow copy.

## Before production/live activation

A scheduled or webhook copy must not be activated until:

1. The same provider/action/environment profile passes sandbox execution.
2. Live provider credentials are configured in the private Sheet only.
3. Provider Selector filters or conditional routing rules intentionally target the live provider/action/environment.
4. Dry Run has been disabled only on the reviewed live workflow copy.
5. Live Mode Confirmation is set to `SEND_REAL_INVOICES` only after the final review.
6. The recipient Sheet contains only approved production recipients.
7. n8n execution access is restricted.
8. Credential rotation and provider rollback procedures are known.
9. Duplicate idempotency retention has been reviewed for the production billing cycle.
10. Status writeback target, key mode, downstream Sheet/DB destination, and access controls are reviewed.

## Current boundary

Conditional routing, send guard enforcement, provider-specific strict validation, workflow-scoped duplicate-send prevention, normalized execution-log/status-writeback payloads, and the real n8n Dry Run validation package are now implemented in the workflow template and repository assets. Multi-worker external state remains a future change; for clustered n8n deployments, duplicate prevention relies on workflow static data plus in-process reservations and should be validated against the deployment topology before live activation.

## Step 08 request/response mapping gate

Before disabling Dry Run, compare at least one sandbox provider response against `readyRequest.responsePaths`, `rawExecution.responsePolicy`, and `standardStatus.parsedMetadata`. Follow `PROVIDER_REQUEST_RESPONSE_MAPPING.md` for the required checks.

## Step 09 status writeback gate

Before any real n8n dry-run execution, configure the writeback branch:

- Create or select a private Google Sheet tab named `invoice_results`.
- Add the headers from `examples/n8n_dry_run_validation/status-writeback-columns.csv`.
- Replace `Google Sheets - Status Writeback -> Document ID` with the private status Sheet ID.
- Select the approved Google Sheets credential on `Google Sheets - Status Writeback`.
- Confirm the operation is `appendOrUpdate` and the matching column is `writeback_key`.
- Keep `Invoice Sender -> Dry Run = true` while validating writeback rows.

## Retry/error classification gate

Before sandbox or live sends, keep Status Manager `Respect Provider Retry-After` enabled, keep a finite `Retry Max Delay`, and verify validation/authentication errors are reviewed instead of automatically retried. See `RETRY_ERROR_CLASSIFICATION.md`.


## Step 11 activation safety gates

Before sandbox real send:

- Invoice Sender Activation Safety Mode is changed from `dryRunValidation` to `sandboxRealSend`.
- Provider Selector still targets `sandbox`.
- Invoice Sender Dry Run is disabled only for the sandbox run.
- Sandbox Mode Confirmation exactly equals `SEND_SANDBOX_INVOICES`.
- Live Mode Confirmation remains blank.

Before live real send:

- Accepted sandbox evidence is present in provider logs and `invoice_results` writeback rows.
- Provider Selector routes only the intended live rows/accounts.
- Invoice Sender Activation Safety Mode is `liveRealSend`.
- Invoice Sender Expected Request Environment is `live`.
- Live Mode Confirmation exactly equals `SEND_REAL_INVOICES`.
