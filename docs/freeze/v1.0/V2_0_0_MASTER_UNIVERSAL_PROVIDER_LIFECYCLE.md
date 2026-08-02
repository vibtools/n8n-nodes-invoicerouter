# InvoiceRouter v2.0.0 Master Universal Provider Lifecycle

v2.0.0 is the master provider lifecycle release.

## User contract

- `provider` sheet stores provider account/API/secrets/config only.
- `email_list` stores recipients only: `Email`, `Name`, `Address`.
- Invoice Template node stores invoice details.
- The master workflow executes customer resolution, invoice create, post/finalize, email send, and status writeback according to the provider lifecycle mode.

## Lifecycle modes

- `draftOnly`
- `createOnly`
- `createAndPost`
- `createPostAndSendEmail`

## Public structure

- `config/` stores provider lifecycle schemas and public recipes.
- `template/` stores public provider starter packs.
- `docs/` stores public documentation and `docs/docs.minifest.ygit`.
- `project/` is private/local-only and is ignored by Git.

## Proven support

Odoo create and post were proven during v1.6.0 live testing. v2.0.0 adds the automated email-send lifecycle stage and a provider template architecture for future provider packs.

## Step 14C Release-Blocking Hardening

Step 14C completes the v2.0.0 release blockers before public publish:

- lifecycle status fields are written end-to-end into `invoice_results`
- provider template packs include a manifest and canonical result header
- public docs manifest has a default document and section indexes
- template validation is part of `npm run verify`
- release-source audit tooling is available before creating GitHub artifacts

Provider templates remain onboarding assets. A provider should be marked production-proofed only after provider documentation review and real sandbox/live evidence.



## Step 14D / v2.0.0 Declarative Provider Recipe Runtime

Added a declarative HTTP provider recipe runtime so compatible REST/JSON invoice providers can define customer, invoice, post/finalize, and email-send steps in provider recipe JSON instead of requiring core node code changes. This is intended for compatible providers; non-standard OAuth, webhook, UI-only, or SDK-only flows may still require a dedicated adapter.
