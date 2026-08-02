# Frozen Node Contracts

## 1. Provider Loader

**Input:** Google Sheets provider/action rows.  
**Output:** normalized provider profiles plus validation summary.

Required behavior:

- ignore disabled rows
- validate provider, account, action, method, endpoint/base URL rules, auth type, and timeout
- create a stable profile ID from provider + account + environment + action
- detect duplicate profiles
- substitute supported header placeholders only when execution requires them
- mask secret values in displayed output and logs
- never send an invoice

## 2. Provider Selector

**Input:** normalized profiles and Status Manager feedback.  
**Output:** one allocated provider action profile plus lock metadata.

Required engines:

- shared runtime account pool
- allocation strategy (Version 1 default: first available)
- lock ownership using workflow/execution/worker identity
- duplicate allocation protection
- release and timeout recovery
- queue and priority support
- retry and cooldown
- health score/provider scoring
- rate limiting and circuit breaker
- feedback state update
- optional per-item conditional routing by rules or preserved recipient custom fields
- guarded `BLOCKED` output when conditional routing is required but no route matches

## 3. Invoice Template

**Input:** default or user template values.  
**Output:** standard invoice template object.

Required behavior:

- fixed system fields
- repeatable line items
- totals and payment terms
- unlimited custom fields
- dynamic tags such as `#INV#`, `#TRX#`, and `#RANDOM#`
- validation and deterministic generated values per request
- no recipient or provider ownership

## 4. Email List

**Input:** Google Sheets recipient rows in Version 1.  
**Output:** standard recipient objects.

Required behavior:

- require a valid email
- remove duplicate emails within the active batch
- ignore empty/invalid rows
- generate a customer name from email username when missing
- preserve optional and custom columns
- mark/reserve recipient usage so the same list entry is not sent repeatedly in one batch
- no invoice creation or API execution

## 5. Request Builder

**Input:** allocated provider profile + invoice template + one recipient.  
**Output:** one validated ready-to-send request.

Required behavior:

- perform the only merge required by Version 1
- select the provider preset/template
- map internal fields to provider fields
- attach request-mapping and response-policy metadata for downstream transport/status handling
- construct URL, method, headers, body, query, content type, timeout, and structured idempotency metadata
- validate all required provider and invoice fields
- emit `providerValidation` errors/warnings for Request Builder and Send Guard decisions
- attach `sendGuard` metadata for downstream send approval
- build stable duplicate-prevention keys when configured
- preserve item pairing
- prevent secrets from appearing in normal output/log display
- never execute HTTP

## 6. Invoice Sender

**Input:** ready-to-send request.  
**Output:** standard raw execution result.

Required behavior:

- support GET, POST, PUT, PATCH, and DELETE where allowed by the provider action
- execute exactly the supplied request
- apply timeout and connection handling
- collect HTTP status, headers, body, latency, response size, and execution metadata
- redact secrets from errors/logs
- optionally require approved `sendGuard` metadata
- block real HTTP sends when Dry Run is off and the configured live-mode confirmation is missing
- block live HTTP sends when final URL/header/query/body interpolation leaves unresolved template tokens
- use response-policy success status codes when marking provider transport success
- optionally reserve and persist live-send idempotency keys before transport
- return `DUPLICATE` without calling the provider when an active idempotency key was already reserved or sent
- do not retry and do not make business decisions beyond transport guard enforcement

## 7. Status Checker

**Input:** Invoice Sender raw result.  
**Output:** standard status object.

Required behavior:

- analyze HTTP status
- select provider response adapter
- extract invoice ID, invoice number, status, URLs, transaction/reference IDs, and errors using fallback response paths
- carry response-policy retry/non-retry hints into standard status
- classify authentication, authorization, validation, rate-limit, network, provider, server, timeout, and unknown errors
- normalize provider-specific statuses
- treat Dry Run, queued, guarded blocked, and duplicate results as non-provider-transport executions
- do not send a second API request in the default Version 1 response-analysis operation
- do not retry or update business systems

## 8. Status Manager

**Input:** standard status object.  
**Output:** workflow result, management events, execution log, and status writeback payload.

Required behavior:

- policy evaluation and final decision
- retry queue entry and schedule (but not direct resend inside the same decision step)
- provider feedback and health/cooldown recommendations
- database/dashboard/metrics/analytics events
- normalized `executionLog` audit payload
- request/response mapping and policy visibility in execution-log/writeback payloads
- normalized `statusWriteback` UPSERT payload for downstream writeback nodes
- alert, notification, and audit events
- final states: COMPLETED, PENDING_RETRY, FAILED, CANCELLED, PROCESSING, BLOCKED, DUPLICATE
