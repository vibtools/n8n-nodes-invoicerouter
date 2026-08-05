# Odoo Capability, Version, and Legal-Issuer Contract

## Scope

This contract is the Phase 04 source of truth for Odoo capability discovery and safe account failover. It does not change the frozen eight-node architecture, provider APIs, or workflow topology.

## Shared manifest

`shared/odoo/OdooCapabilityManifest.ts` defines every Odoo model field and method consumed by Provider Loader preflight and Invoice Sender. Tests import the same manifest. A sender field or method must not be added independently of this contract.

## Supported versions

InvoiceRouter v2.1.1 supports Odoo major versions 18 and 19 for this adapter. `common.version` is resolved before authentication. Unknown or unparsable versions fail closed with `ODOO_VERSION_UNSUPPORTED`; no authentication, customer, invoice, post, or send operation follows.

Version-specific send-wizard surfaces:

| Major | Template/subject/body fields |
|---|---|
| 18 | `mail_template_id`, `mail_subject`, `mail_body` |
| 19 | `template_id`, `subject`, `body`, plus inherited `model` and `res_ids` |

Both profiles require the common invoice-send fields and `action_send_and_print` method declared by the manifest.

## Preflight meaning

Preflight uses public/read-only calls: version, authentication, `fields_get`, selected `search_count` probes, authenticated-user company read, and company read. A successful result means the declared model/field/read surface is available. It does **not** prove create, post, or email-send authorization.

The exact status is:

```text
CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN
```

Side-effect permission becomes acceptable only after the controlled canary succeeds.

## Legal issuer

Every enabled Odoo row must provide a stable, non-placeholder `Issuer_Key`. Provider Loader resolves `Company_ID` and `Company_Name` from the authenticated Odoo user and company record. Within one `Failover_Group`:

- every enabled account must have an issuer key;
- normalized issuer keys must match;
- normalized preflight-resolved company names must match;
- configured `Company_ID`/`Company_Name`, when provided, must match the preflight result.

Any mismatch blocks the entire failover group before Provider Selector. The source rows are not permanently disabled; the operator must correct configuration or company access and rerun preflight.

## Additive provider evidence

```text
Issuer_Key
Company_ID
Company_Name
Odoo_Server_Version
Odoo_Major_Version
Capability_Status
Issuer_Compatibility
```

These columns are evidence/status fields and do not replace existing Account identity. `Profile_ID` writeback identity remains Phase 05 scope.

## Extension rule

Supporting another Odoo major requires an explicit profile, official field/method evidence, fixtures, sender/preflight synchronization tests, documentation, and approval. Unknown-version permissive fallback is forbidden.
