# Provider Template Pack Contract

Every provider template pack must include:

- `provider.template.ygit`
- `provider.csv`
- `email_list.csv`
- `invoice_results.csv`
- `provider.lifecycle.json`
- `README.md`

The `invoice_results.csv` header must match `template/status-writeback-columns.csv` exactly.

## Public sample-data rule

Public template data must use reserved documentation addresses such as `customer@example.com`. Personal-looking addresses on consumer domains such as Gmail, Yahoo, Outlook, Hotmail, iCloud, or Proton Mail are not permitted in committed template or example text files.

## Workflow rule

Import workflows must:

- remain dry-run safe unless the filename explicitly identifies a guarded sandbox/live mode;
- preserve the frozen eight custom-node types;
- use valid n8n expressions for all status-writeback columns;
- include the guarded retry branch where the master template requires it;
- preserve lifecycle evidence, checkpoint, and retry-resume fields.

## Provider proof rule

Template packs are onboarding assets. A provider may be described as implemented or template-ready, but production-proofed status requires provider documentation review plus target-account sandbox/live evidence.

For email lifecycles, a 2xx provider response is not enough. The template must document how `QUEUED`, `SENT`, `FAILED`, and `UNVERIFIED` are derived and how inbox delivery is checked separately.
