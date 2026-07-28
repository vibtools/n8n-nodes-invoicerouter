# InvoiceRouter Architecture

The Version 1.0 responsibilities are frozen in [`VERSION_1_0_FREEZE.md`](VERSION_1_0_FREEZE.md) and [`docs/freeze/v1.0/`](docs/freeze/v1.0/).

![InvoiceRouter architecture](assets/architecture/invoice-router-architecture-v1.0.png)

## Runtime layers

1. **Source:** built-in Manual Trigger and Google Sheets nodes.
2. **Normalization:** Provider Loader and Email List.
3. **Selection:** Provider Selector and its runtime account pool.
4. **Invoice data:** Invoice Template.
5. **Merge:** Request Builder combines account, template, and recipient through three inputs.
6. **Execution:** Invoice Sender injects the runtime secret and executes one request.
7. **Analysis:** Status Checker converts the raw response to a standard status.
8. **Management:** Status Manager creates decisions/events and writes provider feedback.

## Feedback model

The workflow does not contain a physical cyclic connection. Status Manager updates the InvoiceRouter runtime pool and best-effort workflow static feedback. A later Provider Selector execution reads that state. This prevents an uncontrolled execution loop.

## State boundary

- Secret material is process-local and referenced by `credentialRef`.
- Provider health/locks/cooldowns are process-local for the active runtime.
- Status Manager stores a bounded feedback history in workflow static data when the n8n runtime exposes it.
- Multi-process shared pools require a future external-state freeze.

## Importable workflow

`workflows/InvoiceRouter-v1-production.json` is the canonical Version 1 workflow template.
