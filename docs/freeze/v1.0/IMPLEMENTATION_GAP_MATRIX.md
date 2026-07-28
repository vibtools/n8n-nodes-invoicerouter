# Current Repository vs Final Freeze

The existing Version 1.1.0 repository is a useful base and must not be deleted. It is not yet the complete frozen Version 1 architecture.

| Area | Existing repository | Frozen target | Required action |
|---|---|---|---|
| Provider Loader | Built-in/custom JSON profiles | Google Sheets row normalization, duplicate validation, secret masking | Expand/refactor |
| Provider Selector | Input/manual/first-enabled selection | Shared pool, lock, queue, feedback, retry, cooldown, rate limit, health | Major expansion |
| Invoice Template | Missing | Full template/schema/tag engine | Add node |
| Email List | Missing | Google Sheets recipient normalization and dedupe | Add node |
| Request Builder | Basic invoice normalization | Merge provider + template + recipient; provider mapping | Major expansion |
| Invoice Sender | Generic credential-backed REST execution | Execute ready request only; raw response and latency | Refactor boundaries |
| Status Checker | Performs provider status request | Analyze Invoice Sender raw response | Refactor operation |
| Status Manager | Missing | Decisions, retry events, feedback, metrics, audit, result | Add node |
| Credentials | n8n credential type required | Google Sheet credentials for Version 1 | Make current credential path optional/remove from default flow |
| Workflow | Simplified Sheet to sender flow | Full 8-node workflow with feedback and worker model | Replace workflow JSON |
| Tests | Smoke/runtime tests | Contract, masking, dedupe, locking, mapping, response, policy tests | Expand tests |

## Repository decision

- Keep the current repository and Git history.
- Add freeze assets first.
- Implement on a dedicated Version 1 freeze branch.
- Do not delete working code until replacement tests pass.
