# Declarative Provider Recipes

Declarative provider recipes make provider templates easier to build. Instead of changing InvoiceRouter code for every compatible invoice API, a template can describe the provider lifecycle as JSON steps.

A compatible recipe can cover:

1. customer lookup or creation
2. invoice creation
3. invoice post/finalize
4. invoice email sending
5. response mapping into `invoice_results`

This does not mean every provider in the world works automatically. It means compatible REST/JSON invoice APIs can usually be integrated by creating a provider recipe, Google Sheets template, n8n workflow starter, and documentation.
