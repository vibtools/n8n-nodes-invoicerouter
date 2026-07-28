# Final Implementation Matrix

Package version `1.2.0` implements all eight Version 1.0 frozen custom node types.

| Area | Frozen target | Final implementation |
|---|---|---|
| Provider Loader | Sheet row normalization, duplicate validation, secret masking | Complete |
| Provider Selector | Pool, lock, queue state, feedback, retry/cooldown, rate limit, health | Complete for single-process runtime; sequential and parallel-lock modes included |
| Invoice Template | Full invoice schema/template/tag engine | Complete |
| Email List | Google Sheets recipient normalization and dedupe | Complete |
| Request Builder | Merge provider + template + recipient; provider mapping | Complete with three n8n inputs and 19 provider-name presets |
| Invoice Sender | Execute ready request only; raw response and latency | Complete |
| Status Checker | Analyze Invoice Sender raw response | Complete; no default second API request |
| Status Manager | Decisions, retry events, feedback, metrics, audit, result | Complete |
| Credentials | Google Sheet credentials for Version 1 | Complete through runtime vault and late injection |
| Workflow | Full 8-node workflow | Complete at `workflows/InvoiceRouter-v1-production.json` |
| README | Real setup and architecture | Complete with frozen diagram |
| Automated verification | Build, contract, and flow tests | Complete; provider sandbox onboarding remains account-specific |

## External onboarding boundary

Code completion does not replace provider sandbox verification. Providers can require account-specific customer IDs, tenant IDs, OAuth token rotation, multi-step invoice creation, or enabled product features. The provider registry emits warnings and accepts custom fields/body overrides for those requirements.
