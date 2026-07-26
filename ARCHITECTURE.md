# InvoiceRouter Architecture

The canonical architecture is defined in `manifest/architecture.json` and expanded in
`manifest/ARCHITECTURE.md` and the freeze documents under `docs/`.

This audited build keeps the five-stage workflow:

1. Provider Loader
2. Provider Selector
3. Request Builder
4. Invoice Sender
5. Status Checker

The current TypeScript implementation is an MVP-safe scaffold. Provider-specific API transport and
credential implementations must be completed and integration-tested before production use.
