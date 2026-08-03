# InvoiceRouter v2.1.0 Bulk Reliability

v2.1.0 preserves the frozen eight-node topology and adds the approved Odoo production-bulk reliability layer:

- one workflow and workbook for canary, pilot, and production bulk;
- real-time recipient status in `email_list`;
- fixed custom customer-name generation;
- one-item loop and just-in-time account allocation;
- stable campaign/job idempotency;
- side-effect-aware retry and lifecycle resume;
- pre-side-effect multi-account failover within `Failover_Group`;
- evidence-based account cooldown/auto-disable;
- durable retry queue and writeback-only recovery payloads;
- account and campaign event reports;
- updated Odoo workflow/template/workbook/documentation.

Per-account configured RPM, concurrency, daily quota, and manual send limits are explicitly outside this release. Existing global bulk safety controls remain.
