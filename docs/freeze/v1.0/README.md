# Version 1.0 Freeze Index

Read in this order:

1. [`../../../VERSION_1_0_FREEZE.md`](../../../VERSION_1_0_FREEZE.md)
2. [`FINAL_ARCHITECTURE.md`](./FINAL_ARCHITECTURE.md)
3. [`NODE_CONTRACTS.md`](./NODE_CONTRACTS.md)
4. [`PROVIDER_SHEET_CONTRACT.md`](./PROVIDER_SHEET_CONTRACT.md)
5. [`SECURITY_DECISION.md`](./SECURITY_DECISION.md)
6. [`PRODUCTION_SETUP_CHECKLIST.md`](./PRODUCTION_SETUP_CHECKLIST.md)
7. [`N8N_DRY_RUN_VALIDATION.md`](./N8N_DRY_RUN_VALIDATION.md)
8. [`STATUS_WRITEBACK_WIRING.md`](./STATUS_WRITEBACK_WIRING.md)
9. [`IMPLEMENTATION_GAP_MATRIX.md`](./IMPLEMENTATION_GAP_MATRIX.md)
10. [`IMPLEMENTATION_ORDER.md`](./IMPLEMENTATION_ORDER.md)
11. [`NOTION_SOURCE_MAP.md`](./NOTION_SOURCE_MAP.md)
12. [`CLEAN_REPOSITORY_CONTRACT.md`](./CLEAN_REPOSITORY_CONTRACT.md)
13. [`IMPLEMENTATION_AUDIT.md`](./IMPLEMENTATION_AUDIT.md)
14. [`SANDBOX_LIVE_ACTIVATION.md`](./SANDBOX_LIVE_ACTIVATION.md)
15. [`V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md`](./V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md)
16. [`N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md`](./N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md)

The architecture diagram and provider workbook are immutable Version 1 reference assets unless the freeze version is increased.


Implementation status: **Complete — package 1.5.0, eight custom nodes registered, v1.5.0 release identity ready for live acceptance testing.** Step patches add conditional routing, guarded blocking, provider validation, idempotency hardening, and production setup hardening without changing the frozen eight-node topology.

## Step 04 validation boundary

Provider-specific required values are enforced in Request Builder, not in the demo workbook. The production workflow keeps Strict Provider Validation enabled so incomplete provider-specific requests are blocked before Invoice Sender.

## Step 05 idempotency boundary

Request Builder creates structured idempotency metadata. Invoice Sender enforces duplicate-send prevention only for live mode; Dry Run does not reserve keys. Duplicate results are represented as `DUPLICATE` and are not treated as provider transport failures.


## Step 06 logging/writeback boundary

Status Manager emits normalized `executionLog` and `statusWriteback` payloads. These are prepared outputs for explicit downstream writeback nodes; the custom node package does not silently write to Google Sheets, databases, or APIs outside the configured n8n workflow.

## Step 07 n8n dry-run validation boundary

`N8N_DRY_RUN_VALIDATION.md` and `examples/n8n_dry_run_validation/` define the first real n8n import/run test. This validation keeps Invoice Sender in Dry Run mode, uses sandbox routing, and verifies guarded outputs without making provider HTTP calls. Passing this checklist is required before a provider sandbox send, but it is not live-send approval.

## Step 08 provider mapping

Provider request/response mapping hardening is documented in [`PROVIDER_REQUEST_RESPONSE_MAPPING.md`](PROVIDER_REQUEST_RESPONSE_MAPPING.md).

## Step 09 status writeback wiring

The production workflow now includes explicit built-in n8n nodes after Status Manager: `Prepare Status Writeback Row` and `Google Sheets - Status Writeback`. They flatten `management.statusWriteback` and upsert into an `invoice_results` Sheet using `writeback_key`. See [`STATUS_WRITEBACK_WIRING.md`](STATUS_WRITEBACK_WIRING.md).

- [`RETRY_ERROR_CLASSIFICATION.md`](RETRY_ERROR_CLASSIFICATION.md) — retry/error classification contract and provider retry-after handling.
- [`SANDBOX_LIVE_ACTIVATION.md`](SANDBOX_LIVE_ACTIVATION.md) — dry-run, sandbox real-send, and live real-send activation gates.

- [`NODE_ICON_CARD_WIRING.md`](NODE_ICON_CARD_WIRING.md) — n8n runtime SVG icon wiring and node-card asset boundary.

- [Bulk Run Safety](BULK_RUN_SAFETY.md) - run-level gates for smooth and safe bulk invoice sending.
- [Production Preset Self-Check and Retry Wiring](./PRODUCTION_PRESET_SELF_CHECK_AND_RETRY_WIRING.md)


- [`V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md`](./V1_5_0_BUILD_INSTALL_LIVE_TEST_RUNBOOK.md) — master build, install, dry-run, sandbox, retry/writeback, live canary, rollback, and publish checklist for v1.5.0.

- [`N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md`](./N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md) — npm registry discovery, n8n UI installation, display-name searchability, manual install diagnostics, and clean release hygiene.
