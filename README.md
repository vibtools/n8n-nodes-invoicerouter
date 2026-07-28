# InvoiceRouter for n8n

InvoiceRouter is being implemented against the **Version 1.0 Final Freeze**.

## Authoritative specification

Read these files in order:

1. [`VERSION_1_0_FREEZE.md`](VERSION_1_0_FREEZE.md)
2. [`docs/freeze/v1.0/README.md`](docs/freeze/v1.0/README.md)
3. [`docs/freeze/v1.0/FINAL_ARCHITECTURE.md`](docs/freeze/v1.0/FINAL_ARCHITECTURE.md)
4. [`docs/freeze/v1.0/NODE_CONTRACTS.md`](docs/freeze/v1.0/NODE_CONTRACTS.md)
5. [`docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md`](docs/freeze/v1.0/PROVIDER_SHEET_CONTRACT.md)
6. [`docs/freeze/v1.0/SECURITY_DECISION.md`](docs/freeze/v1.0/SECURITY_DECISION.md)

Older project drafts, generated manifests, experimental workflows, and duplicated documentation have been removed. Nothing outside the freeze documents can redefine Version 1.0 responsibilities.

## Frozen target

Version 1.0 contains eight InvoiceRouter custom node types:

1. Provider Loader
2. Provider Selector
3. Invoice Template
4. Email List
5. Request Builder
6. Invoice Sender
7. Status Checker
8. Status Manager

Manual Trigger and Google Sheets are built-in n8n nodes.

## Implementation status

The existing five-node runtime is retained only as a tested migration baseline while the frozen eight-node architecture is implemented. It is not a separate specification and must be refactored according to the freeze.

## Repository structure

```text
.github/workflows/      CI and release only
assets/                 Frozen architecture and node-card assets
credentials/            Temporary baseline credential implementation
nodes/                  Runtime node source
providers/              Provider template/adaptor source
shared/                 Shared runtime contracts and utilities
scripts/                Cross-platform validation/build helpers
tests/                  Automated tests
docs/freeze/v1.0/       Version 1.0 source of truth
examples/google_sheets/ Frozen provider workbook
manifest/               Freeze manifest only
```

## Validation

Use Node.js 24:

```bash
npm ci
npm run verify
```

## Development rule

All implementation changes must be made on the `feature/v1-final-implementation` branch and must follow the frozen node boundaries. The final workflow JSON is intentionally absent until all eight node contracts are implemented and tested.

## License

MIT
