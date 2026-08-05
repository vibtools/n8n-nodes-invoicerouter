# Odoo Capability, Version, and Legal-Issuer Contract

## Scope

This contract is the source of truth for Odoo capability discovery and safe account failover. It preserves the frozen eight-node architecture and public node APIs.

## Shared manifest

`shared/odoo/OdooCapabilityManifest.ts` defines every Odoo model field and method consumed by Provider Loader preflight and Invoice Sender. Tests import the same manifest. A sender field or method must not be added independently of this contract.

## Version policy

InvoiceRouter does not enforce a fixed Odoo major-version allowlist. `common.version` is recorded for diagnostics and the first numeric component is parsed even from Odoo Online values such as `saas~19.4+e`.

Odoo 18 and 19 retain documented version metadata for their optional send-wizard template/subject/body fields. Those optional fields are not required by preflight because InvoiceRouter does not read or write them. Unprofiled versions use the common capability profile.

A version is accepted when the required public JSON-RPC models, fields, and methods used by InvoiceRouter are available. A capability failure may still block an account, but it must report the missing capability rather than `ODOO_VERSION_UNSUPPORTED`.

## Preflight meaning

Preflight uses version, authentication, `fields_get`, selected `search_count` probes, authenticated-user company read, and company read. A successful result means the required model/field/read surface is available. It does **not** prove create, post, or email-send authorization.

The exact status is:

```text
CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN
```

Side-effect permission becomes acceptable only after a controlled live canary succeeds.

## Provider-row identity

Provider Loader preserves the Google Sheets virtual `row_number` in every preflight result. `Google Sheets - Preflight Provider Status` performs an `update` matched by `row_number`. It must never append a partial provider row when `Profile_ID` is initially blank.

## Legal issuer

`Issuer_Key` is optional. Provider Loader resolves `Company_ID` and `Company_Name` from the authenticated Odoo user and company record and compares available evidence within each `Failover_Group`. Missing or different values produce diagnostic `WARNING` metadata only. They do not remove profiles, alter the operator's `Enabled` value, block Provider Selector, or block Invoice Sender.

## Additive provider evidence

```text
Issuer_Key (optional)
Company_ID
Company_Name
Odoo_Server_Version
Odoo_Major_Version
Capability_Status
Issuer_Compatibility
Profile_ID
```

These are evidence/status fields. Account quantity is not constrained by the workflow; every enabled valid provider row is loaded.
