# Declarative Provider Recipe Runtime

InvoiceRouter v2.0.0 includes a declarative provider recipe runtime for compatible REST/JSON invoice APIs.

The runtime lets provider templates define HTTP lifecycle steps without changing the core node package. A provider recipe may define:

- authentication headers and secret placeholders
- customer lookup/create steps
- invoice create steps
- invoice post/finalize steps
- invoice email-send steps
- response mappings into the standard `invoice_results` status fields

## Runtime contract

Set `Extra Config JSON` on a provider row with a `providerRecipe` object whose `runtime.type` is `declarative_http`. The Request Builder marks that provider profile with `transportStrategy = declarative_provider_recipe`, and Invoice Sender executes each step sequentially.

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

## Limits

The declarative runtime is intended for compatible HTTP/JSON providers. Providers that require non-standard OAuth handshakes, UI-only send wizards, webhooks, or SDK-only state machines may still require a dedicated adapter.
