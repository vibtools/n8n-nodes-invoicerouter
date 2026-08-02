# Real n8n Dry-Run Validation Checklist

This checklist is the controlled import/run gate before any provider sandbox or live invoice send. It validates that the package installs in self-hosted n8n, the workflow imports cleanly, the private Sheets are mapped correctly, and the guarded Dry Run path produces the expected non-transport outputs.

## Scope

This validation step proves only these things:

1. The community node package can be installed in the target n8n instance.
2. The production workflow template can be imported and opened.
3. The private provider and email Sheets are readable by the selected Google Sheets credential.
4. Conditional routing, strict provider validation, send guard, idempotency, duplicate prevention metadata, execution logging, and status writeback payloads are visible in a Dry Run execution.
5. Invoice Sender does not make provider HTTP calls while **Dry Run** is enabled.

This step does not prove provider sandbox success, provider live success, production deliverability, external database writeback, or multi-worker state behavior.

## Required files

Use these repository files together:

| File | Purpose |
|---|---|
| `workflows/InvoiceRouter-v1-production.json` | Importable n8n workflow template. |
| `examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx` | Reference provider workbook contract only. |
| `examples/n8n_dry_run_validation/provider-accounts-dry-run.csv` | Minimal provider rows for a safe Custom REST Dry Run profile. |
| `examples/n8n_dry_run_validation/email-list-dry-run.csv` | Recipient rows that exercise allowed, blocked, invalid, and duplicate paths. |
| `examples/n8n_dry_run_validation/status-writeback-columns.csv` | Suggested downstream result/writeback columns. |
| `examples/n8n_dry_run_validation/expected-dry-run-outcomes.json` | Expected node-level outcomes for manual comparison. |

## Local package gate

Run this before installing the package into n8n:

```bash
npm ci
npm run verify
npm pack
```

Expected result:

- `validate` passes.
- `format:check` passes.
- `lint` passes.
- `typecheck` passes.
- `build` passes.
- all smoke tests pass.
- `npm pack --dry-run` includes the workflow and dry-run validation package.

## Install gate in self-hosted n8n

For a local/self-hosted install from the packed archive:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/to/n8n-nodes-invoicerouter-1.5.0.tgz
```

Restart n8n after install. In the n8n editor, confirm these custom nodes are searchable:

1. Provider Loader
2. Provider Selector
3. Invoice Template
4. Email List
5. Request Builder
6. Invoice Sender
7. Status Checker
8. Status Manager

## Private Google Sheet setup

Create two private Sheets. Do not use repository files as production credential stores.

### Provider Sheet

Create a sheet named `provider` and import `examples/n8n_dry_run_validation/provider-accounts-dry-run.csv`.

Expected properties:

- two rows are enabled;
- provider is `Custom`;
- environment is `Sandbox`;
- base URL is `https://dry-run.invalid.local`;
- endpoint values are present;
- auth values are demo-only and must not be reused for live runs.

### Email List Sheet

Create a sheet named `email_list` and import `examples/n8n_dry_run_validation/email-list-dry-run.csv`.

Expected test coverage:

- two valid routed recipients;
- one intentionally unrouted recipient that must become `BLOCKED`;
- one invalid email row that must be skipped;
- one duplicate email row that must be skipped by Email List.

## Workflow import gate

Import `workflows/InvoiceRouter-v1-production.json` into n8n.

Before the first execution, confirm:

1. Workflow is inactive.
2. **Invoice Sender → Dry Run** is enabled.
3. **Invoice Sender → Require Send Guard** is enabled.
4. **Invoice Sender → Prevent Duplicate Sends** is enabled.
5. **Invoice Sender → Live Mode Confirmation** is empty.
6. **Provider Selector → Conditional Routing** is enabled.
7. **Provider Selector → Require Conditional Match** is enabled.
8. **Provider Selector → Environment Filter** is set to `sandbox` for this validation run.
9. **Request Builder → Send Guard Mode** is `Strict`.
10. **Request Builder → Strict Provider Validation** is enabled.
11. **Request Builder → Idempotency Key Mode** is `Provider + Invoice + Recipient`.
12. **Status Manager → Include Execution Log** is enabled.
13. **Status Manager → Include Status Writeback** is enabled.

The bundled template is Dry Run-first, but the environment filter may need to be changed from live to sandbox for this validation package.

## Manual run gate

Run the workflow manually from the n8n editor.

Inspect the execution from left to right:

| Node | Expected Dry Run evidence |
|---|---|
| Provider Loader | Provider rows load successfully; visible output masks secrets. |
| Email List | Invalid email and duplicate row are reported/skipped. |
| Provider Selector | Routed rows match `Custom / Custom Request / Sandbox`; unrouted row becomes `BLOCKED`. |
| Invoice Template | Invoice number, totals, currency, due date, line items, and dynamic tags are populated. |
| Request Builder | Routed rows produce URL/body/headers/idempotency; `providerValidation.errors = []`; `sendGuard.approved = true`. |
| Request Builder | Unrouted row remains blocked and must not be approved for send. |
| Invoice Sender | Routed rows report `transportStatus = DRY_RUN`; blocked row reports `transportStatus = BLOCKED`; no real provider HTTP call occurs. |
| Status Checker | Dry Run is not classified as provider transport failure. |
| Status Manager | Every item emits `management.executionLog` and `management.statusWriteback`. |

## Pass criteria

The Dry Run validation passes only when all of these are true:

1. n8n imports the workflow without missing custom node types.
2. Both Google Sheets nodes read the intended private Sheets.
3. Provider Loader reports enabled provider profiles.
4. Email List skips invalid and duplicate rows instead of sending them forward as valid recipients.
5. Conditional routing selects the intended `Custom / Custom Request / Sandbox` profile for routed recipients.
6. At least one intentionally unrouted recipient is blocked before Invoice Sender transport.
7. Request Builder shows no provider validation errors for the routed rows.
8. Request Builder shows `sendGuard.approved = true` only for routed/valid rows.
9. Invoice Sender produces `DRY_RUN` for routed/valid rows.
10. Invoice Sender produces `BLOCKED` for unrouted/guarded rows.
11. Invoice Sender makes no provider HTTP call.
12. Status Manager outputs `management.executionLog` for every item.
13. Status Manager outputs `management.statusWriteback` for every item.
14. No real invoice is created in any provider account.

## Fail/stop criteria

Stop immediately and do not disable Dry Run if any of these happen:

- a custom node is missing after import;
- a Google Sheets node reads a wrong spreadsheet;
- provider secrets appear unmasked in Provider Loader visible output;
- an unrouted recipient reaches Invoice Sender as an approved request;
- Request Builder approves a request with provider validation errors;
- Invoice Sender sends live HTTP traffic while Dry Run is enabled;
- Status Manager writeback payloads are missing for completed, blocked, duplicate, or dry-run items.

## Evidence to capture

Save these artifacts from the n8n execution:

1. Screenshot or exported JSON of Provider Loader output with masked credentials.
2. Screenshot or exported JSON of Provider Selector routed and blocked outputs.
3. Screenshot or exported JSON of Request Builder `sendGuard`, `providerValidation`, and `idempotency` fields.
4. Screenshot or exported JSON of Invoice Sender `rawExecution.transportStatus` fields.
5. Screenshot or exported JSON of Status Manager `management.executionLog` and `management.statusWriteback` fields.
6. The exact n8n version and Node.js runtime used by the self-hosted instance.

## Boundary before Step 08

After this Dry Run passes, the next safe step is provider sandbox execution. Do not switch to production/live credentials from this step alone. Step 08 should configure one sandbox provider/action/environment profile, keep the recipient list limited to test recipients, and disable Dry Run only with `SEND_REAL_INVOICES` on the reviewed sandbox workflow copy.

## Step 09 Status Writeback Branch

The production workflow now wires Status Manager output to:

```text
Prepare Status Writeback Row -> Google Sheets - Status Writeback
```

Before executing the dry-run workflow in n8n, create an `invoice_results` tab using:

```text
examples/n8n_dry_run_validation/status-writeback-columns.csv
```

Then replace `REPLACE_STATUS_SPREADSHEET_ID` on `Google Sheets - Status Writeback` and select the approved Google Sheets credential. The node uses `appendOrUpdate` with `writeback_key` as the matching column.


## Activation safety check

For the first import/run validation, confirm these Invoice Sender values before executing:

- `Dry Run = true`
- `Activation Safety Mode = dryRunValidation`
- `Expected Request Environment = sandbox`
- `Sandbox Mode Confirmation` is blank
- `Live Mode Confirmation` is blank

If any item reports `rawExecution.activationSafety.approved = false`, do not move to sandbox real send until the reason is understood and fixed.
