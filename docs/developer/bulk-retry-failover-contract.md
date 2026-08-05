# Bulk Retry and Multi-Account Failover Contract

## Frozen architecture

The package still exports the original eight custom nodes. v2.1.0 adds state and workflow wiring without adding, removing, renaming, or reorganizing custom nodes.

## Stable identity

Each normalized recipient carries:

```text
Campaign_ID
Job_ID
Attempt_Count
```

The `campaignJob` idempotency mode resolves:

```text
provider:failover_group:campaign_id:job_id:action
```

The key excludes the current profile so a pre-side-effect failover can change credentials without creating a new logical job. Once a provider invoice exists, the lifecycle checkpoint locks the job to the original provider profile/database.

## Read-only account preflight

Provider Loader can authenticate an Odoo row and verify the requested active currency plus required model access before registering the account in the runtime pool. Preflight is read-only and emits `preflightResults` for provider-sheet writeback. Invalid database/authentication evidence can auto-disable an account; currency incompatibility excludes the account for the current configuration without falsely claiming quota exhaustion.

## Just-in-time allocation

The canonical Odoo workflow uses `Loop Over Recipient Jobs` with a batch size of one. Provider Selector runs immediately before Request Builder for the current job. Status Manager feedback is persisted before the next job is allocated.

## Failover state

```json
{
  "schemaVersion": "1.0",
  "failoverGroup": "odoo-production",
  "originalProfileId": "...",
  "currentProfileId": "...",
  "attemptedProfileIds": ["..."],
  "failoverCount": 1,
  "sideEffectStage": "none"
}
```

Provider Selector excludes attempted profile IDs. It does not cross failover groups.

## Error policy

- `TIMEOUT_ERROR`, `NETWORK_ERROR`, `SERVER_ERROR`, and retryable provider errors may retry before side effects.
- `RATE_LIMIT_ERROR` applies cooldown and may fail over after the configured retry budget.
- `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `QUOTA_EXHAUSTED_ERROR`, and invalid-database configuration errors skip same-account retry and may fail over before side effects.
- Currency/accounting configuration errors are non-retryable on the affected account and do not falsely claim quota exhaustion.
- Validation, conflict, not-found, and unverified-email outcomes require review unless a lifecycle checkpoint explicitly permits same-account resume.

## Durable writeback payloads

Status Manager emits additive payloads:

```text
management.recipientStatusWriteback
management.providerStatusWriteback
management.retryQueueWriteback
management.accountReportEvent
management.campaignReportEvent
management.failoverRequest
```

The workflow writes these payloads with Google Sheets `appendOrUpdate`. Each managed write node has three write-only attempts. Writeback branches never feed Invoice Sender. `accountReportEvent` is accumulated by `Campaign_ID + Profile_ID`, while `campaignReportEvent` is keyed by `Campaign_ID + Job_ID`.

## v2.1.1 Phase 02 durable campaign lease

The canonical Odoo workflow derives campaign state from `email_list`, `retry_queue`, `invoice_results`, and `campaign_report` before building work items. One execution may contain only one pending `Campaign_ID`.

Before the recipient loop, the workflow upserts an `ACTIVE` lease, rereads `campaign_report`, and verifies the exact `Run_ID`, `Revision`, and future `Lock_Expires_At`. Provider Selector is unreachable until that verification succeeds. Completion rereads and releases the same lease. Google Sheets is not transactional, so the operational contract still forbids concurrent runs for the same campaign.

## Legal-issuer failover gate

Before an Odoo profile enters the runtime pool, Provider Loader resolves its Odoo version and authenticated company. Every enabled member of a `Failover_Group` must share the same non-placeholder `Issuer_Key` and normalized company identity. Any mismatch blocks the entire group; cross-company invoice failover is forbidden.

## Phase 06 monotonic report contract

Every campaign/account report mutation is revisioned. Normal writes reread the target report and require an exact base-to-next transition. Pending repair payloads that are older than or equal to the current revision are treated as already applied/stale and do not overwrite; payloads that skip a revision fail closed. Account failover counters restart from the highest durable account revision after a new run or worker process.

Odoo profiles excluded by legal-issuer validation generate `PREFLIGHT` account-report rows with issuer/company evidence. These rows are diagnostic only and are not allocation candidates.
