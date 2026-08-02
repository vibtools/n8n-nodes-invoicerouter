# Production Preset Self-Check and Retry Wiring

Step 11E adds two final production-hardening controls before forensic audit.

## Production preset self-check

Invoice Sender now exposes **Production Preset Self-Check**. This run-time gate blocks execution when critical UI settings have been reset or changed away from the approved activation stage.

Supported modes:

| Mode | Required purpose |
|---|---|
| `off` | Compatibility mode; no preset fingerprint is enforced. |
| `dryRunValidation` | First import/run validation. Requires Dry Run, sandbox expectation, blank send confirmations, send guard, duplicate prevention, and bulk safety. |
| `sandboxRealSend` | Real sandbox HTTP send. Requires sandbox activation and sandbox confirmation phrases. |
| `liveRealSend` | Real live HTTP send. Requires live activation, live confirmation phrases, bulk safety, duplicate prevention, and failed-send abort threshold. |

The production workflow defaults to `dryRunValidation`.

## Automatic retry execution wiring

The production workflow now includes this retry branch:

```text
Status Manager
→ Prepare Retry Request
→ Wait Before Retry
→ Invoice Sender
```

`Prepare Retry Request` passes through only items where `management.retryScheduled === true`. It sets top-level retry metadata before the Wait node sends the item back into Invoice Sender.

The retry decision remains owned by Status Checker and Status Manager:

- retryable provider/network/rate-limit/server failures can re-enter Invoice Sender
- validation/auth/not-found/conflict errors do not retry automatically
- `Retry Limit`, `Retry Base Delay`, `Retry Max Delay`, and provider `Retry-After` are respected
- retry attempts keep the original ready request, idempotency metadata, send guard, activation safety, and bulk safety context

## Safety boundary

This retry branch is still guarded by Invoice Sender. A retry cannot bypass:

- Send Guard
- Production Preset Self-Check
- Activation Safety Mode
- environment checks
- duplicate prevention
- bulk safety limits
- unresolved-template-token blocking

## Production requirements before live activation

Before using `liveRealSend`:

1. Dry-run validation must pass.
2. Sandbox real send must pass with provider evidence.
3. Status writeback must be verified.
4. Retry branch must be tested with a controlled retryable sandbox failure.
5. Final forensic audit must pass.

## v2 lifecycle checkpoint safety

The retry branch now preserves `lifecycle_checkpoint`, `retry_resume_stage`, and `retry_resume`. Post/email retries reuse the existing provider invoice. The retry request must originate from Status Manager and pass Invoice Sender identity/checkpoint validation.

An email outcome of `UNVERIFIED` does not enter the automatic retry branch. Operators must inspect Odoo mail/PDF evidence and the recipient inbox before deciding on any manual action.

## Final publish sequence

After all approved deltas are applied:

1. Run the full verification suite.
2. Submit the complete project ZIP for forensic audit.
3. Correct and re-audit every finding.
4. Publish only after the full audit passes.
5. Update through n8n Community Nodes.
6. Run the one-recipient live canary before live bulk.
