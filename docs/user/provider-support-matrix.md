# Provider Support Matrix

InvoiceRouter separates the master engine from provider proof status.

| Provider | Customer lookup/create | Invoice create | Post/finalize | Send invoice email | Support tier |
|---|---:|---:|---:|---:|---|
| Odoo | Yes | Yes | Yes | Yes, requires live email proof per deployment | Tier 1 candidate |
| Stripe | Recipe scaffold | Recipe scaffold | Recipe scaffold | Recipe scaffold | Tier 2 template-ready |
| Zoho Books | Recipe scaffold | Recipe scaffold | Recipe scaffold | Recipe scaffold | Tier 2 template-ready |
| QuickBooks | Recipe scaffold | Recipe scaffold | Recipe scaffold | Recipe scaffold | Tier 2 template-ready |
| Generic HTTP | Configurable | Configurable | Configurable | Configurable | Tier 2 fallback |

Do not claim a provider is production-proofed until its sandbox/live evidence has been captured for the target account and configuration.
