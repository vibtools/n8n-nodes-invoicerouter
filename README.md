# InvoiceRouter for n8n

InvoiceRouter is an n8n community-node package for converting Google Sheets rows or other n8n input items into normalized invoice requests and executing real credential-backed REST API calls.

## Included nodes

1. **Provider Loader** — loads built-in provider identifiers and optional endpoint profiles.
2. **Provider Selector** — selects a provider from an input field, manual choice, or provider pool.
3. **Request Builder** — converts Google Sheets columns into a normalized invoice object.
4. **Invoice Sender** — executes real create, create-and-send, send-existing, or custom REST API requests.
5. **Status Checker** — retrieves and normalizes invoice status through the provider API.

## Security model

Provider secrets are stored only in the **InvoiceRouter API** n8n credential. API keys must not be stored in Google Sheets, workflow JSON, provider JSON, or the Git repository.

The credential supports:

- Bearer token
- API key header
- Basic authentication
- API key query parameter
- No authentication
- Default non-secret headers
- HTTPS enforcement
- Configurable request timeout

HTTP is rejected by default except localhost. Enable **Allow HTTP** only for a trusted private development service.

## Real API operations

The Invoice Sender supports:

- Create invoice
- Create and send invoice as a two-step sequence
- Send an existing invoice
- Custom REST request
- Idempotency header using the invoice `requestId`
- Configurable endpoint, method, body, query parameters, headers, and response paths
- Dry-run request plans without network transmission
- Normalized success and failure output

The Status Checker supports real provider status requests and maps provider states to normalized states such as `draft`, `sent`, `viewed`, `paid`, `overdue`, `void`, and `failed`.

## Provider compatibility

InvoiceRouter provides a production-capable generic REST transport. Each invoice provider has its own endpoints, authentication rules, payload format, and response structure. Configure the node fields using the provider's official API documentation.

The provider folders in this repository preserve adapter boundaries for future provider-specific implementations. They do not claim that one generic payload is valid for every listed provider.

## Google Sheets workflow

Import:

```text
workflows/google-sheets-real-invoice-router.json
```

The template performs:

```text
Schedule or Manual Trigger
→ Get PENDING Google Sheets rows
→ Build normalized invoice
→ Create and send through provider API
→ IF success
→ Update the source row with success or failure
```

Required sheet columns:

```text
request_id
provider
customer_name
customer_email
amount
currency
due_date
description
line_items_json
metadata_json
send_email
status
invoice_id
invoice_url
pdf_url
sent_at
retry_count
last_error
```

Example `line_items_json`:

```json
[
  {
    "description": "Consulting service",
    "quantity": 1,
    "unitPrice": 100,
    "amount": 100
  }
]
```

## Build and validation

Use Node.js 24 in CI.

```bash
npm ci
npm run validate
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

Run the complete verification pipeline:

```bash
npm run verify
```

## GitHub Release

Create a tag matching `package.json`, for example:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The release workflow produces:

```text
n8n-nodes-invoicerouter-1.1.0.tgz
SHA256SUMS.txt
google-sheets-real-invoice-router.json
workflow setup README
```

If `NPM_TOKEN` exists, the workflow also publishes to npm. Without the token, the GitHub Release still succeeds and provides manual installation assets.

## Manual self-hosted installation

Download the `.tgz` file from GitHub Releases. On the n8n host, install it in the n8n nodes directory and restart n8n:

```bash
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/n8n-nodes-invoicerouter-1.1.0.tgz
```

Then import the workflow JSON in n8n and configure:

1. Google Sheets credentials and document/sheet selection.
2. InvoiceRouter API credential.
3. Real create/send endpoints.
4. Provider request payload.
5. Response paths for invoice ID, status, invoice URL, and PDF URL.
6. Dry-run verification against a sandbox provider account.

## Production checklist

- Use HTTPS.
- Use sandbox credentials before production credentials.
- Keep Dry Run enabled during mapping tests.
- Use unique `request_id` values.
- Confirm the provider supports idempotency and use its required header name.
- Enable `continueOnFail` when individual row failures should not stop the batch.
- Verify response paths against real sandbox responses.
- Restrict n8n credential access.
- Monitor failed executions and Google Sheet `last_error` values.

See [PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md) for configuration details.

## License

MIT
