# InvoiceRouter 1.5.0 Forensic Implementation Audit

## Audited input

- Uploaded full-project ZIP
- Version 1.0 freeze documents
- Frozen architecture PDF/PNG
- 18-column, 20-row provider workbook
- Notion parent and child specifications listed in `NOTION_SOURCE_MAP.md`

## Baseline findings

The uploaded repository was a clean five-node migration baseline, not the frozen final implementation.

- 5/8 custom nodes were registered.
- Invoice Template, Email List, and Status Manager were missing.
- Provider Loader accepted custom JSON rather than normalizing the frozen Google Sheets contract.
- Provider Selector only selected a provider ID and did not implement the runtime pool lifecycle.
- Request Builder had one input and could not perform the frozen three-source merge.
- Invoice Sender depended on a separate n8n credential type, conflicting with the accepted Sheet-credential decision.
- Status Checker performed a second provider API request instead of analyzing Invoice Sender output.
- Provider directories were mostly duplicate stubs and did not cover all 19 workbook provider names.
- The final eight-node importable workflow was intentionally absent.

## Corrective implementation

- Replaced the five-node package registration with eight frozen node entries.
- Removed the obsolete n8n credential type from the default package path.
- Added a process-local secret vault so Sheet secrets are referenced, not copied downstream.
- Added all missing nodes and rebuilt existing nodes around their frozen boundaries.
- Consolidated provider mapping into one registry covering every workbook provider name.
- Added sequential reuse for beginner operation and parallel locks for controlled worker mode.
- Added the canonical importable workflow with Request Builder input indexes 0, 1, and 2.
- Replaced the placeholder README with real architecture, setup, security, runtime, and test information.
- Replaced baseline smoke tests with full-pipeline tests.
- Added neutral queued/dry-run propagation, JSON-string response parsing, idempotent feedback replay, and late Extra Value interpolation.

## Security result

Provider Loader, Request Builder, Invoice Sender, Status Checker, and Status Manager outputs do not include the plain Sheet API key or API secret in the tested flow. Invoice Sender resolves the secret only immediately before the HTTP request.

The built-in Google Sheets node still sees the original row. This unavoidable Version 1 boundary is documented in `SECURITY_DECISION.md` and README.

## Production qualification

The package passed validation, formatting, lint, TypeScript typecheck, build, 39 automated tests, and package dry-run. It is production-oriented for a single-process n8n runtime and supports controlled sequential processing by default. Multi-process queue deployments require an external shared-state backend before accounts are allocated across processes.

Provider sandbox verification remains required because account-specific API prerequisites cannot be inferred from a generic Sheet row.
