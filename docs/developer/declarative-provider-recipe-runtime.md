# Declarative Provider Recipe Runtime

InvoiceRouter v2.0.0 includes a declarative provider recipe runtime for compatible REST/JSON invoice APIs.

The runtime lets provider templates define HTTP lifecycle steps without changing the core node package. A provider recipe may define:

- authentication headers and secret placeholders;
- customer lookup/create steps;
- invoice create steps;
- invoice post/finalize steps;
- invoice email-send steps;
- response mappings into the standard `invoice_results` status fields;
- lifecycle facts and checkpoints used for safe stage resume.

## Runtime contract

Set `Extra Config JSON` on a provider row with a `providerRecipe` object whose `runtime.type` is `declarative_http`. The Request Builder marks that provider profile with `transportStrategy = declarative_provider_recipe`, and Invoice Sender executes each applicable step sequentially.

Supported placeholders include:

```text
{{API_KEY}}
{{API_SECRET}}
{{recipient.email}}
{{recipient.name}}
{{invoice.invoiceNumber}}
{{invoice.totals.grandTotal}}
{{request.baseUrl}}
{{request.endpoint}}
{{facts.providerInvoiceId}}
{{steps.invoice.create.body.id}}
```

## Truthful email status mapping

A successful HTTP response is not automatically a sent email.

- Explicit mapped provider status such as `sent` can produce `SENT`.
- An accepted/processing response such as HTTP `202` without terminal sent evidence produces `QUEUED`.
- A completed request without recognized queued or sent evidence produces `UNVERIFIED`.
- A required failed email step produces `FAILED` and retains lifecycle facts/checkpoint data.

Recipe authors should map provider email state through `responseMap.emailSendStatus` or an equivalent fact. Do not rely on the HTTP status code alone.

## Safe resume

When a recipe has already created a provider invoice, Status Manager can schedule a later post or email step against that existing invoice. The approved resume object carries the checkpoint and resume stage. The runtime skips earlier steps only when the resume identity and provider invoice checkpoint are valid.

## Limits

The declarative runtime is intended for compatible HTTP/JSON providers. Providers that require non-standard OAuth handshakes, UI-only send wizards, webhooks, or SDK-only state machines may still require a dedicated adapter.

A provider template remains onboarding material until its response mappings, retry semantics, and live evidence have been proven for the target account.
