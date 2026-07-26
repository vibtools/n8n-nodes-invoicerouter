# InvoiceRouter Production Guide

## 1. Configure the InvoiceRouter API credential

Create an n8n credential named **InvoiceRouter API**.

Set:

- Base URL: provider API base URL
- Authentication: bearer, header API key, basic, query API key, or none
- Secret fields required by the chosen authentication method
- Default Headers JSON when the provider requires version or tenant headers
- Timeout

Keep **Allow HTTP** disabled in production.

## 2. Configure create and send operations

For a two-step provider flow:

```text
Create Endpoint: /invoices
Create Method: POST
Send Endpoint: /invoices/{invoiceId}/send
Send Method: POST
Invoice ID Response Path: data.id
Status Response Path: data.status
```

`{invoiceId}` is replaced using the create response. The create response must contain an invoice ID at the configured path.

For a provider that creates and sends in one call, use **Custom API Request** or **Create Invoice** with the provider's combined endpoint.

## 3. Configure the body

Use **Normalized Invoice** when the provider accepts the InvoiceRouter universal object. Most commercial providers require a provider-specific payload. In that case use **Raw JSON** and map n8n expressions into the JSON field.

The normalized object contains:

```json
{
  "requestId": "REQ-1001",
  "provider": "custom",
  "customerName": "Example Customer",
  "customerEmail": "customer@example.com",
  "amount": 100,
  "currency": "USD",
  "dueDate": "2026-08-15",
  "description": "Consulting service",
  "sendEmail": true,
  "lineItems": [],
  "metadata": {}
}
```

## 4. Idempotency

Use a unique Google Sheets `request_id`. InvoiceRouter sends that value using the configured idempotency header. Change the header name to the exact name required by the provider. Set the field blank only when the provider has no idempotency mechanism.

## 5. Dry run

Dry Run returns sanitized request plans containing method, URL, header names, query names, body, and timeout. Secret header values are not returned.

Disable Dry Run only after the request plan matches the provider's sandbox API documentation.

## 6. Error behavior

Without **Continue On Fail**, an API or mapping error fails the node execution.

With **Continue On Fail**, the item returns:

```json
{
  "invoiceResponse": {
    "success": false,
    "status": "failed",
    "message": "Provider error message"
  }
}
```

The supplied workflow writes this message to `last_error` and increments `retry_count`.

## 7. Provider limitations

A generic transport cannot guarantee turnkey behavior for every provider because providers differ in customer creation, invoice line creation, finalization, tax handling, sending, and status APIs.

Production readiness therefore requires sandbox verification of the configured provider endpoints and payload. InvoiceRouter deliberately throws errors rather than claiming success for undocumented provider behavior.
