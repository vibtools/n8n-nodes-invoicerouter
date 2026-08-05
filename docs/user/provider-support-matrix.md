# Provider Support Matrix

InvoiceRouter separates runtime implementation from deployment proof. A provider can have an implemented adapter or template without being production-proofed for every account.

| Provider | Customer lookup/create | Invoice create | Post/finalize | Invoice email | Current support tier |
|---|---:|---:|---:|---:|---|
| Odoo | Built-in | Built-in | Built-in | Built-in send wizard with provider evidence states | Tier 1 candidate; target deployment proof required |
| Stripe | Declarative recipe/template | Declarative recipe/template | Declarative recipe/template | Declarative mapping; explicit provider evidence required | Tier 2 template-ready |
| Zoho Books | Declarative recipe/template | Declarative recipe/template | Declarative recipe/template | Declarative mapping; explicit provider evidence required | Tier 2 template-ready |
| QuickBooks | Recipe scaffold | Recipe scaffold | Recipe scaffold | Recipe scaffold | Tier 2 template-ready |
| Generic HTTP | Configurable | Configurable | Configurable | Configurable; 2xx alone is not sent proof | Tier 2 fallback |

## Email status boundary

InvoiceRouter distinguishes:

- `QUEUED`: provider accepted or is processing the email;
- `SENT`: provider-side terminal sent evidence exists;
- `FAILED`: explicit provider failure evidence or a definitive pre-send/wizard failure exists;
- `UNVERIFIED`: the send operation completed or may have executed, but sufficient current-attempt provider evidence is unavailable.

`SENT` does not guarantee recipient inbox delivery. Inbox delivery must be verified during a controlled live canary.

## Production-proof rule

Do not mark a provider or deployment production-proofed until dry-run, sandbox/test, status writeback, retry-resume, one-recipient live canary, provider evidence, PDF evidence, and inbox evidence have been captured for the target account and configuration.

## Odoo identity and attachment boundary

The built-in Odoo adapter uses case-insensitive exact partner-email matching and blocks duplicate contacts. Recipient comparison supports RFC display-name addresses. PDF support is considered evidenced only when the actual `ir.attachment` is a PDF bound to the current invoice, current send attempt, and expected invoice report attachment.

## Odoo v2.1.1 Phase 04 boundary

Odoo 18 and Odoo 19 retain documented metadata profiles. Runtime compatibility is capability-driven and does not enforce a fixed major-version allowlist. A successful read-only capability check does not prove create/post/send authorization. Multi-account failover does not require `Issuer_Key`. Issuer and authenticated company differences are exposed as non-blocking diagnostics; runtime eligibility is determined by enabled state, capability preflight, managed account state, currency, and existing safety controls.
