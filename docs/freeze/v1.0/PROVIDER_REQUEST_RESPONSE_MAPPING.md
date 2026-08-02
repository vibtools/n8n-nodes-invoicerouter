# Provider Request and Response Mapping

Step 08 hardens the provider adapter boundary without changing the frozen eight-node architecture.

## Scope

This document describes metadata emitted by `Request Builder`, enforced by `Invoice Sender`, and consumed by `Status Checker` / `Status Manager`.

No new node is introduced. No external writeback or provider call is added by this step.

## Request mapping metadata

`Request Builder` now attaches:

```text
readyRequest.requestMapping
```

The object includes:

| Field | Purpose |
|---|---|
| `providerId` | Normalized provider ID. |
| `actionId` | Selected action ID from Provider Selector. |
| `canonicalAction` | Internal adapter action label, for example `create_invoice`. |
| `method` | Provider preset method hint. The provider Sheet method still remains the runtime source of truth. |
| `contentType` | Provider preset content type hint. |
| `idempotencyHeader` | Provider preset idempotency header hint. |
| `responseKind` | Response adapter family used by downstream parsing. |
| `source` | Whether the mapping came from a built-in preset or custom provider profile. |

## Response policy metadata

`Request Builder` also attaches:

```text
readyRequest.responsePolicy
```

The object includes:

| Field | Purpose |
|---|---|
| `successStatusCodes` | HTTP statuses treated as successful provider transport. Defaults to `200`, `201`, and `202`. |
| `retryableStatusCodes` | HTTP statuses treated as retryable hints when provider transport fails. |
| `nonRetryableStatusCodes` | HTTP statuses treated as non-retryable provider/client errors. |
| `errorMessagePaths` | Candidate paths for provider error text extraction. |
| `parseJsonStrings` | Declares that JSON string bodies should be parsed before status extraction. |

`Invoice Sender` uses `successStatusCodes` when setting `rawExecution.success`.

`Status Checker` carries the policy into `standardStatus` and emits:

```text
standardStatus.retryableByPolicy
standardStatus.nonRetryableByPolicy
```

`Status Manager` considers `retryableByPolicy` when scheduling retries and suppresses policy retries when `nonRetryableByPolicy` is true.

## Response path hardening

`responsePaths` now supports fallback path arrays. For example:

```json
{
  "invoiceId": ["id", "invoice.id", "data.id"],
  "status": ["status", "invoice.status", "data.status"]
}
```

`Status Checker` uses the first non-empty match. This protects against common provider response envelope differences without requiring a second API call.

## Live transport token guard

`Invoice Sender` now checks the fully interpolated live request before HTTP transport. If URL, headers, query, or body still contain unresolved tokens such as:

```text
{realmId}
{{ACCESS_TOKEN}}
```

then the item returns:

```text
transportStatus = BLOCKED
```

and no provider HTTP call is made.

Dry Run remains non-transport and reports unresolved tokens in `rawExecution.requestPreview.unresolvedTokens` for review.

## Production rule

Before disabling Dry Run, confirm that each provider profile has:

- final Base URL and Endpoint
- required tenant/realm/organization variables in n8n credential material or provider profile values
- expected Method and Content-Type
- provider-specific custom fields required by strict validation
- verified response path extraction from a sandbox response

