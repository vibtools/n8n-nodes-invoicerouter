# Lifecycle Retry Resume Contract

## Purpose

A retry must continue the failed lifecycle stage without creating another customer or invoice when a provider invoice already exists.

## Retry stages

| Failed stage | Retry behavior |
|---|---|
| Customer or invoice creation | Repeat the guarded create flow only when no provider invoice checkpoint exists. |
| `invoice.post` | Reuse the existing provider invoice and execute post-only resume. |
| `invoice.send_email` | Reuse the existing posted invoice and execute send-only resume. |
| Unverified email | Do not retry automatically; require manual evidence review. |

## Approved resume object

Status Manager may attach `readyRequest.lifecycleResume` only when its retry decision is safe and the required provider checkpoint is available. Invoice Sender accepts the resume only when:

- `approved` is `true`;
- `source` is `status-manager`;
- request and provider identities match;
- the stage is recognized;
- post/send resume includes an existing provider invoice ID.

The resume object is also exposed through:

```text
retry_resume_stage
retry_resume
lifecycle_checkpoint
```

## Duplicate-prevention boundary

The resume path does not disable the original idempotency model. It permits only the approved continuation of the same lifecycle request against the existing provider invoice. A manually fabricated or incomplete resume object must be rejected.

## Retry classification

Automatic resume remains limited by the existing retry policy, retry count, delay cap, provider retry hints, activation safety, send guard, environment validation, and bulk safety controls.

Validation, authentication, authorization, not-found, unresolved conflict, and `EMAIL_UNVERIFIED` outcomes require review rather than automatic retry.
