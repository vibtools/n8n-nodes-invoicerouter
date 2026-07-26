````md id="pn4728"
# InvoiceRouter Roadmap

Version: 0.1.0

Project Status: Planning

---

# Vision

Build the most flexible, modular, and provider-independent invoice automation framework for n8n.

The long-term goal is to allow users to connect multiple invoice providers, route requests intelligently, and automate invoice delivery without changing their workflows.

---

# Project Timeline

```
Planning

↓

Core Framework

↓

MVP

↓

Provider Expansion

↓

Database

↓

Management Panel

↓

Marketplace Release

↓

Enterprise Features
```

---

# Phase 0 — Planning

Status

✅ Current Phase

Objectives

- Finalize project architecture
- Design folder structure
- Define node responsibilities
- Create development rules
- Design provider workflow
- Define universal request format
- Define universal response format

Deliverables

- README
- Architecture
- Roadmap
- Manifest
- Project Structure

---

# Phase 1 — Core Framework

Priority

★★★★★

Objectives

Build the project foundation.

Tasks

- Create shared modules
- HTTP Client
- Logger
- Validator
- Retry Manager
- Response Parser
- Memory Cache
- Shared Types
- Shared Utilities

Expected Result

A reusable framework that every node can use.

---

# Phase 2 — MVP Nodes

Priority

★★★★★

Objectives

Develop the first working version.

Nodes

## 01 Provider Loader

Responsibilities

- Connect Google Sheets
- Read Provider Sheet
- Validate Providers
- Ignore Disabled Providers
- Build Provider Pool

Status

⬜ Pending

---

## 02 Provider Selector

Responsibilities

- Load Provider Pool
- Select Provider
- Apply Routing Algorithm

Status

⬜ Pending

---

## 03 Request Builder

Responsibilities

- Validate Input
- Normalize Data
- Build Universal Request

Status

⬜ Pending

---

## 04 Invoice Sender

Responsibilities

- Load Provider Adapter
- Execute HTTP Request
- Parse Response
- Retry Failed Requests

Status

⬜ Pending

---

## 05 Status Checker

Responsibilities

- Delivery Status
- Payment Status
- Final Response

Status

⬜ Pending

---

# Phase 3 — Initial Provider Support

Priority

★★★★★

Supported Providers

- Stripe
- Zoho Invoice
- Invoice Ninja
- ERPNext
- Custom REST API

Expected Result

Users can send invoices using multiple providers through a single workflow.

---

# Phase 4 — Routing Engine

Priority

★★★★☆

Objectives

Implement intelligent provider selection.

Algorithms

- Round Robin
- Random
- Priority
- Weight Based
- Least Used
- Manual

Future

- Smart Auto Routing
- Health-Based Routing
- Cost-Based Routing

---

# Phase 5 — Bulk Processing

Priority

★★★★★

Objectives

Support high-volume invoice sending.

Features

- Batch Processing
- Parallel Execution
- Retry Queue
- Failed Queue
- Success Queue
- Progress Tracking

Future

- Worker Pool
- Queue Manager

---

# Phase 6 — Database Migration

Priority

★★★★☆

Current

Google Sheets

Future

SQLite

Later

- PostgreSQL
- MySQL

Objectives

Replace Google Sheets without changing workflows.

---

# Phase 7 — Provider Manager

Priority

★★★★☆

Objectives

Create a centralized provider management system.

Features

- Add Provider
- Edit Provider
- Delete Provider
- Enable / Disable
- API Key Management
- Priority
- Rate Limits
- Routing Rules

Current

Google Sheets

Future

Web Panel

---

# Phase 8 — Authentication

Priority

★★★★☆

Support

- API Key
- Bearer Token
- Basic Auth
- OAuth2
- Custom Headers

Future

Credential Vault

---

# Phase 9 — Provider Expansion

Future Providers

- QuickBooks
- Xero
- Odoo
- FreshBooks
- Square
- Paddle
- Wave
- Chargebee

Community Providers

Planned

---

# Phase 10 — Web Management Panel

Priority

★★★☆☆

Modules

- Dashboard
- Providers
- Routing
- Logs
- Statistics
- Settings
- Health Monitor

Backend

FastAPI

Database

SQLite

---

# Phase 11 — Performance Optimization

Objectives

- Memory Cache
- Connection Pool
- Provider Cache
- Parallel Workers
- Faster HTTP
- Retry Optimization
- Queue Optimization

---

# Phase 12 — Monitoring

Features

- Logs
- Metrics
- Error Reports
- Provider Health
- API Statistics
- Success Rate
- Failure Rate

---

# Phase 13 — Testing

Tests

- Unit Tests
- Integration Tests
- Mock Providers
- Performance Tests
- Stress Tests
- Bulk Tests

Target

High reliability before every release.

---

# Phase 14 — Documentation

Documentation

- Installation Guide
- User Guide
- Developer Guide
- Provider Guide
- API Reference
- Examples
- Sample Workflows

---

# Phase 15 — Marketplace Release

Objectives

Publish as an n8n Community Node package.

Deliverables

- npm Package
- GitHub Repository
- Documentation
- Examples
- Release Notes

---

# Future Ideas

Possible Future Modules

- Quote Sender
- Estimate Sender
- Credit Note Sender
- Purchase Order Sender
- Receipt Sender
- Payment Status Sync
- Webhook Listener
- Analytics Dashboard

---

# Current MVP Scope

Included

- Google Sheets Provider Storage
- Google Sheets Customer Storage
- Provider Loader
- Provider Selector
- Request Builder
- Invoice Sender
- Status Checker
- Shared HTTP Client
- Provider Adapters

Not Included

- Database
- Web Panel
- OAuth Manager
- Redis
- Analytics
- User Management
- Distributed Workers

---

# Development Strategy

Rule 1

Complete one node before starting the next.

Rule 2

Never duplicate shared logic.

Rule 3

Keep provider adapters isolated.

Rule 4

Every provider must follow the same interface.

Rule 5

Every output must follow the common response schema.

Rule 6

Design for migration from day one.

---

# Success Criteria

The MVP will be considered complete when:

- Providers load successfully from Google Sheets.
- Provider selection works reliably.
- Universal requests are generated correctly.
- Multiple providers can send invoices through one workflow.
- Responses follow the common response schema.
- New providers can be added without changing existing workflow logic.
````
