# Stripe Setup

## Required Stripe values

Use Stripe Dashboard:

```text
Developers → API keys
```

Use a test secret key first:

```text
sk_test_...
```

Use a live secret key only after test-mode proof:

```text
sk_live_...
```

## API flow used by this template

```text
POST /v1/customers
POST /v1/invoices
POST /v1/invoiceitems
POST /v1/invoices/{id}/finalize
POST /v1/invoices/{id}/send
```

## Important notes

- The template uses `collection_method=send_invoice`.
- The invoice item amount is sent in cents/minor units.
- Stripe sends invoice emails to the email address stored on the Stripe Customer.
- Repeated separate invoice runs may create separate Stripe Customer records for the same email. Keep `invoice_results` and Stripe dashboard as your audit trail.
- Do not put real Stripe secret keys into files committed to GitHub.
