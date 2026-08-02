# Zoho Books Setup

## Required details

```text
Zoho OAuth access token
Zoho Books organization_id
Zoho API root endpoint for your data center
Invoice create/send scopes
```

## Recommended scopes

```text
ZohoBooks.contacts.CREATE
ZohoBooks.contacts.READ
ZohoBooks.invoices.CREATE
ZohoBooks.invoices.READ
```

## Provider sheet mapping

```text
Provider = Zoho Books
Environment = sandbox or live
Base URL = https://www.zohoapis.com
Endpoint = /books/v3/invoices
Auth Type = Zoho OAuth Token
API Key = access token
Extra Value = organization_id
```

## Token note

Zoho OAuth access tokens expire. This template expects a valid access token in the `API Key` column.
