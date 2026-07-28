# InvoiceRouter for n8n

[![InvoiceRouter CI](https://github.com/vibtools/n8n-nodes-invoicerouter/actions/workflows/ci.yml/badge.svg)](https://github.com/vibtools/n8n-nodes-invoicerouter/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/n8n-nodes-invoicerouter.svg)](https://www.npmjs.com/package/n8n-nodes-invoicerouter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

InvoiceRouter is an eight-node n8n community-node package for loading many provider accounts from Google Sheets, assigning accounts safely, personalizing invoice data, executing provider requests, standardizing results, and creating retry/metrics/alert/audit events.

**Package version:** `1.2.0`  
**Architecture:** Version 1.0 Final Freeze  
**Implementation:** Complete — 8/8 custom nodes registered

## Final workflow diagram

![InvoiceRouter Version 1 architecture](assets/architecture/invoice-router-architecture-v1.0.png)

```text
Manual Trigger
  ├─> Google Sheets: Provider Accounts/Credentials -> Provider Loader ─┐
  ├─> Google Sheets: Email List -> Email List -------------------------┼─> Provider Selector
  └─> Invoice Template ------------------------------------------------┘

Provider Selector allocation ----\
Invoice Template -------------------> Request Builder
One normalized recipient ---------/

Request Builder -> Invoice Sender -> Status Checker -> Status Manager
                                                       ├─ workflow result
                                                       ├─ retry queue event
                                                       ├─ metrics/analytics events
                                                       ├─ alert/audit events
                                                       └─ provider feedback/state update
```

The importable workflow is included at:

```text
workflows/InvoiceRouter-v1-production.json
```

## Custom nodes

| # | Node | Responsibility |
|---|---|---|
| 1 | **Provider Loader** | Validates Google Sheets provider rows, creates the frozen `providers[]` structure, stores runtime secrets in an in-process vault, and masks visible credentials. |
| 2 | **Provider Selector** | Maintains provider state, selects an eligible account, applies rate limits/circuit-breaker rules, and creates lock metadata. |
| 3 | **Invoice Template** | Builds fixed invoice fields, repeatable line items, totals, payment terms, custom fields, and dynamic tag definitions. |
| 4 | **Email List** | Validates recipients, removes duplicate emails, generates missing names, preserves custom columns, and reserves each email once per batch. |
| 5 | **Request Builder** | Merges exactly one account + one template + one recipient, resolves dynamic tags, applies provider presets, and creates one ready request. |
| 6 | **Invoice Sender** | Resolves the runtime credential, executes exactly one HTTP request, measures latency/size, and returns a redacted raw result. |
| 7 | **Status Checker** | Analyzes the raw response, classifies errors, extracts invoice metadata, and emits a standard status object. |
| 8 | **Status Manager** | Applies retry policy, emits management events, determines the final workflow state, and updates provider feedback. |

`Manual Trigger` and `Google Sheets` are built-in n8n nodes and are not part of this package.

## Request Builder input order

Request Builder deliberately performs the merge; no extra custom Merge node exists.

| Input | Source | Data |
|---|---|---|
| Input 1 | Provider Selector | Allocated provider/account profile |
| Input 2 | Invoice Template | Standard invoice template |
| Input 3 | Email List | One normalized recipient per item |

The production workflow JSON already wires these inputs correctly.

## Provider workbook

The Version 1 reference workbook is:

```text
examples/google_sheets/InvoiceRouter_20_Provider_Production_Presets_v1.0.xlsx
```

It contains 20 action rows across 19 provider names:

- Stripe
- Paddle
- Polar
- LemonSqueezy
- Invoice Ninja
- Zoho Books
- Xero
- ERPNext
- Odoo
- QuickBooks
- FreshBooks
- Chargebee
- Recurly
- Square
- PayPal
- Braintree
- Razorpay
- Bill.com
- Custom REST

The built-in provider registry normalizes these names and provides request/response mapping presets. Some providers require provider-specific IDs such as `customer_id`, `organization_id`, `realmId`, `contact_id`, or `location_id`. Put those values in recipient/template custom fields or in the Sheet's **Extra Value** field where the endpoint uses a placeholder.

## Dynamic invoice tags

Invoice Template and Request Builder support:

| Tag | Generated value |
|---|---|
| `#INV#` | Deterministic invoice code per provider/recipient/request |
| `#TRX#` | Deterministic transaction code |
| `#RANDOM#` | 13-character deterministic random-style code |
| `#EMAIL#` | Recipient email |
| `#NAME#` | Recipient name |
| `#PROVIDER#` | Selected provider ID |
| `#ACCOUNT#` | Selected account ID |

The same request seed always produces the same tag values, which helps idempotency and retry safety.

## Processing modes

Provider Selector offers two modes:

### Sequential — default

Best for Version 1 and beginners. Multiple recipients may reuse the same account because Invoice Sender processes items in order. This is the default in the bundled workflow.

### Parallel locks

Keeps each account locked until Status Manager feedback. Use this only when running controlled parallel workers with enough provider accounts. Unavailable work items are marked `QUEUED` rather than being sent with the wrong account.

## Credential model and security boundary

Version 1 intentionally stores provider API keys/secrets in Google Sheets so many changing accounts can be managed without editing n8n credentials individually.

Provider Loader:

- reads the Sheet row received from the built-in Google Sheets node;
- stores real credential material only in the active InvoiceRouter runtime vault;
- outputs masked previews and a credential reference;
- never sends credentials through Request Builder output;
- lets Invoice Sender inject the secret only at HTTP execution time;
- redacts secrets from normal response/error output.

Important boundary: the built-in Google Sheets node receives the original row before Provider Loader runs. In production:

1. Keep the spreadsheet private and use least-privilege Google access.
2. Do not commit real credentials to GitHub.
3. Disable or minimize successful execution-data retention in n8n.
4. Restrict access to workflow executions and logs.
5. Rotate credentials with awareness that Google Sheet revision history may retain previous values.
6. Start with **Dry Run** enabled and test provider sandboxes before live use.

## Install from source

Use Node.js 24 for the supported build environment.

```bash
npm ci
npm run verify
npm pack
```

For a typical self-hosted n8n installation:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/n8n-nodes-invoicerouter-1.2.0.tgz
```

Restart n8n after installation.

## Import and configure the workflow

1. Import `workflows/InvoiceRouter-v1-production.json` in n8n.
2. Open **Google Sheets - Provider Accounts** and replace the provider spreadsheet ID.
3. Open **Google Sheets - Email List** and replace the recipient spreadsheet ID.
4. Select your Google Sheets OAuth2 or Service Account credential.
5. Keep **Invoice Sender → Dry Run** enabled.
6. Execute the workflow manually and inspect Provider Loader, Request Builder, Status Checker, and Status Manager output.
7. Configure required provider-specific IDs through custom fields.
8. Disable Dry Run only after a successful sandbox test.
9. Activate a scheduled/webhook copy only after the manual workflow is stable.

## Standard runtime objects

The main internal contracts are:

```text
Provider Loader  -> providers[]
Provider Selector -> providerAllocation
Invoice Template -> invoiceTemplate
Email List       -> recipient
Request Builder  -> readyRequest
Invoice Sender   -> rawExecution
Status Checker   -> standardStatus
Status Manager   -> management
```

Normal outputs contain no plain API key or API secret.

## Validation and tests

```bash
npm run validate
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

The test suite verifies:

- 8/8 n8n node registration;
- production workflow wiring;
- Sheet credential masking;
- recipient validation/deduplication;
- invoice totals and dynamic tags;
- three-input Request Builder merging;
- secret injection only at HTTP execution;
- status normalization;
- success completion and retry scheduling.

## Production scope

The package is production-oriented as a **configurable routing/runtime framework**. Provider APIs still differ in mandatory IDs, OAuth token lifecycle, multi-step invoice creation, and account-specific rules. The bundled presets provide request/response structures and clear warnings, but live provider onboarding must be verified against that provider's sandbox and account configuration.

Version 1 runtime state is process-local, with best-effort workflow static feedback. For multi-process n8n queue deployments, use sequential mode per worker or introduce an external state backend in a later freeze version before sharing one account pool across processes.

## Source of truth

Read these files in order:

1. [`VERSION_1_0_FREEZE.md`](VERSION_1_0_FREEZE.md)
2. [`docs/freeze/v1.0/FINAL_ARCHITECTURE.md`](docs/freeze/v1.0/FINAL_ARCHITECTURE.md)
3. [`docs/freeze/v1.0/NODE_CONTRACTS.md`](docs/freeze/v1.0/NODE_CONTRACTS.md)
4. [`docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md`](docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md)
5. [`docs/freeze/v1.0/SECURITY_DECISION.md`](docs/freeze/v1.0/SECURITY_DECISION.md)

## License

MIT
