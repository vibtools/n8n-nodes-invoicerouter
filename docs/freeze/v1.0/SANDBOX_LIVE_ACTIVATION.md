# Sandbox and Live Activation Safety

This document defines the production activation ladder for InvoiceRouter after local verification, dry-run validation, and provider mapping review.

## Activation stages

Invoice Sender now has an explicit **Activation Safety Mode**:

| Mode | Purpose | Required state |
|---|---|---|
| `compatibility` | Preserve legacy Dry Run / Live Mode Confirmation behavior for older workflows. | Existing Dry Run and Live Mode Confirmation rules apply. |
| `dryRunValidation` | First imported n8n run. | `Dry Run = true`, request environment must not be `live`, production template expects `sandbox`. |
| `sandboxRealSend` | Real HTTP call to a provider sandbox account. | `Dry Run = false`, request environment `sandbox`, `Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES`. |
| `liveRealSend` | Real HTTP call to a provider live account. | `Dry Run = false`, request environment `live`, `Live Mode Confirmation = SEND_REAL_INVOICES`. |

The production workflow template ships in `dryRunValidation` mode with `Expected Request Environment = sandbox` and both confirmation fields blank.

## Required promotion order

Promotion must happen in this order only:

1. Local `npm run verify` passes.
2. n8n import succeeds with all placeholders replaced.
3. Dry-run validation package passes with sandbox routing.
4. Status writeback branch upserts rows into `invoice_results`.
5. One provider sandbox account is configured with real sandbox credentials.
6. Invoice Sender is changed to `sandboxRealSend`, `Dry Run = false`, and `Sandbox Mode Confirmation = SEND_SANDBOX_INVOICES`.
7. Sandbox real-send evidence is reviewed in `management.executionLog`, `management.statusWriteback`, and provider dashboard/API logs.
8. Only after accepted sandbox evidence, Invoice Sender may be changed to `liveRealSend`, Provider Selector may target `live`, and `Live Mode Confirmation = SEND_REAL_INVOICES` may be entered.

Do not skip sandbox real-send evidence before live activation.

## Production workflow defaults

The canonical production workflow must keep these defaults before user configuration:

| Node | Setting | Default |
|---|---|---|
| Provider Selector | Environment Filter | `sandbox` |
| Request Builder | Send Guard Mode | `strict` |
| Request Builder | Strict Provider Validation | `true` |
| Invoice Sender | Dry Run | `true` |
| Invoice Sender | Require Send Guard | `true` |
| Invoice Sender | Prevent Duplicate Sends | `true` |
| Invoice Sender | Activation Safety Mode | `dryRunValidation` |
| Invoice Sender | Expected Request Environment | `sandbox` |
| Invoice Sender | Sandbox Mode Confirmation | blank |
| Invoice Sender | Live Mode Confirmation | blank |
| Status Manager | Include Execution Log | `true` |
| Status Manager | Include Status Writeback | `true` |

## What the activation gate records

Invoice Sender attaches `rawExecution.activationSafety` to every guarded item after a ready request exists. Status Checker carries it to `standardStatus.activationSafety`, and Status Manager carries activation fields into execution logs and status writeback values.

Downstream writeback rows include:

- `activation_mode`
- `activation_approved`
- `activation_safety`

These fields make later forensic review easier because the Sheet can show exactly which activation stage approved or blocked the execution.

## Safety boundary

Activation safety is a runtime gate. It does not replace:

- provider Sheet credential review;
- conditional routing review;
- sendGuard checks;
- strict provider validation;
- idempotency / duplicate prevention;
- provider sandbox testing;
- final forensic audit before version bump and publish.
