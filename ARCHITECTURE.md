# InvoiceRouter Architecture

## Runtime flow

```text
Google Sheets or n8n input
→ Request Builder
→ Provider selection
→ Invoice Sender
→ Provider REST API
→ Normalized response
→ Google Sheets success/failure update
```

## Credential boundary

Provider secrets remain in the n8n credential store. Workflow data contains invoice fields and non-secret routing metadata only.

## Transport layer

`shared/http/InvoiceApi.ts` performs:

- credential normalization
- HTTPS enforcement
- authentication header/query construction
- URL joining and endpoint placeholder interpolation
- request body interpolation
- execution through n8n's HTTP helper
- safe response normalization

## Nodes

- Provider Loader: provider registry and profiles
- Provider Selector: input/manual/pool routing
- Request Builder: Google Sheets-to-universal invoice normalization
- Invoice Sender: create/send/custom real API execution
- Status Checker: real API status retrieval and normalization

## Release architecture

A `v*` Git tag triggers validation, TypeScript compilation, tests, npm packaging, workflow export, checksum generation, GitHub Release creation, and optional npm publishing.
