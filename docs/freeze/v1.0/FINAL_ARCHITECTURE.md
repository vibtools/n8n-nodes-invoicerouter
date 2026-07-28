# Final Architecture

## Runtime layers

### 1. Trigger and source layer

- Manual Trigger starts a test/manual execution.
- Google Sheets supplies provider account/action rows, including credentials by explicit Version 1 product decision.
- Invoice Template supplies the invoice structure and dynamic values.
- Email List supplies normalized recipients.

### 2. Selection layer

`Provider Loader` validates and normalizes Google Sheets rows into provider action profiles.

`Provider Selector` maintains the shared runtime account pool and allocates one eligible account to a worker.

### 3. Execution layer

Each worker uses the same pipeline:

```text
Request Builder -> Invoice Sender -> Status Checker
```

`Request Builder` merges exactly:

```text
1 selected provider account
+ 1 invoice template
+ 1 recipient
= 1 ready-to-send request
```

### 4. Management layer

`Status Manager` receives the standard status and creates:

- final workflow result
- provider feedback
- retry/cooldown decision
- metrics and analytics events
- database/dashboard records
- alert and notification events
- audit records

### 5. Feedback loop

Status Manager feedback updates Provider Selector state for the next allocation. Feedback must update state; it must not create an uncontrolled infinite execution cycle.

## Parallelism

The diagram shows multiple worker lanes for clarity. They are repeated instances of the same three node types, not separate node definitions. Version 1 implementation may begin sequentially and add controlled concurrency after lock and duplicate tests pass.
