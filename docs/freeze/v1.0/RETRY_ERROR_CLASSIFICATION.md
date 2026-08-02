# Retry and Error Classification

## Scope

Step 10 hardens provider error classification and retry scheduling without changing the frozen eight custom-node architecture.

The retry boundary remains:

```text
Invoice Sender -> Status Checker -> Status Manager
```

Invoice Sender performs transport. Status Checker normalizes provider results. Status Manager makes retry, feedback, alert, and writeback decisions.

## Normalized Classification

Status Checker now attaches these fields to `standardStatus`:

| Field | Purpose |
|---|---|
| `errorType` | Provider-neutral error code such as `RATE_LIMIT_ERROR`, `VALIDATION_ERROR`, or `SERVER_ERROR`. |
| `errorCategory` | Broader class such as `rate_limit`, `validation`, `authentication`, `provider_server`, or `transport`. |
| `errorSeverity` | Normalized severity: `none`, `medium`, `high`, or `critical`. |
| `alertSeverity` | Alert-facing severity for downstream notifications. |
| `errorClassification` | Full classification object with retryability, source, and reason. |
| `retryDecision` | Safe retry decision consumed by Status Manager. |
| `retryAfterSeconds` | Parsed provider retry delay from `Retry-After` or rate-limit reset headers. |
| `retryDelayHintSeconds` | Retry delay hint used when the classification is safe to retry. |

## Retry Rules

Status Manager retries only when all of these are true:

1. Execution is not neutral (`DRY_RUN`, `QUEUED`, `BLOCKED`, `SKIPPED`, or `DUPLICATE`).
2. Result is not `SUCCESS`.
3. `standardStatus.retryDecision.retryable === true`.
4. `standardStatus.retryDecision.safeToRetry !== false`.
5. Retry count is below `Retry Limit`.

Non-retryable validation, authentication, authorization, not-found, and unresolved conflict errors require human review or configuration changes before retry.

## Provider Retry-After Handling

Status Checker parses:

```text
Retry-After
X-RateLimit-Reset
X-Rate-Limit-Reset
RateLimit-Reset
Rate-Limit-Reset
```

Status Manager uses those hints when `Respect Provider Retry-After` is enabled. The final retry delay is capped by `Retry Max Delay (seconds)`.

## Writeback Fields

Status writeback rows include the hardened retry/error fields:

```text
error_category
error_severity
retry_delay_seconds
retry_decision_source
retry_decision_reason
retry_after_seconds
retry_delay_hint_seconds
```

These fields are operational/audit fields. They do not replace provider-side invoice records or financial ledgers.

## Production Rule

Do not force retries for validation or authentication errors. Fix the underlying provider configuration, credential, or invoice payload first. Retrying malformed requests can create noisy provider logs and may trigger provider-side abuse/rate-limit protections.
