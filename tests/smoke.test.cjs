const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function context(inputs, parameters = {}, responses = []) {
  const calls = [];
  const staticData = {};
  return {
    calls,
    staticData,
    getInputData(index = 0) {
      return inputs[index] ?? [];
    },
    getNodeParameter(name, _itemIndex, fallback) {
      return Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : fallback;
    },
    continueOnFail() {
      return false;
    },
    getNode() {
      return { name: parameters.__nodeName ?? 'InvoiceRouter Test Node' };
    },
    getExecutionId() {
      return parameters.__executionId ?? 'exec-test-001';
    },
    getWorkflow() {
      return { id: 'workflow-test', name: 'InvoiceRouter Test' };
    },
    getWorkflowStaticData() {
      return staticData;
    },
    helpers: {
      async httpRequest(options) {
        calls.push(options);
        return responses[calls.length - 1] ?? { statusCode: 200, headers: {}, body: {} };
      },
    },
  };
}

function load(rel) {
  return require(path.join(root, 'dist', rel));
}

const providerRows = [
  {
    json: {
      Enabled: true,
      Provider: 'Custom',
      Account: 'Primary Account',
      Environment: 'Live',
      Action: 'Custom Request',
      Method: 'POST',
      'Base URL': 'https://api.example.test',
      Endpoint: '/invoices',
      'Auth Type': 'Bearer',
      'API Version': 'v1',
      'Content-Type': 'application/json',
      'Header Name': 'Authorization',
      'Header Value': 'Bearer {{API_KEY}}',
      'API Key': 'super-secret-token',
      'API Secret': 'super-secret-value',
      'Extra Value': 'tenant-001',
      Timeout: 30,
      Notes: 'Test provider row',
    },
  },
];

const recipientRows = [
  { json: { Email: 'john.doe@example.com', Name: '', Company: 'Example Ltd', Department: 'Finance' } },
  { json: { Email: 'john.doe@example.com', Name: 'Duplicate' } },
  { json: { Email: 'jane@example.com', Name: 'Jane Example' } },
];

let pipelineSequence = 0;
async function runPipeline({ dryRun = false, httpStatus = 201 } = {}) {
  pipelineSequence += 1;
  const batchId = `batch-test-${pipelineSequence}`;
  const executionId = `exec-test-${pipelineSequence}`;
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const loaderContext = context([providerRows], {
    batchId, __executionId: executionId, sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
  });
  const loader = await loadProviders.call(loaderContext);

  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const emailContext = context([recipientRows], {
    batchId, __executionId: executionId, emailField: 'Email', nameField: 'Name', nameGeneration: 'formatted', invalidPolicy: 'skip', preserveCustomColumns: true, preventReuse: true,
  });
  const emails = await loadEmails.call(emailContext);

  const { execute: createTemplate } = load('nodes/03_InvoiceTemplate/InvoiceTemplate.execute.js');
  const templateContext = context([[{ json: {} }]], {
    templateMode: 'manual', invoiceId: '#INV#', invoiceNumber: 'INV-#INV#', invoiceDate: '2026-07-28', dueDate: '2026-08-27', currency: 'USD',
    lineItemsJson: '[{"name":"Service","description":"Work for #NAME#","quantity":1,"unit_price":125}]', tax: 5, discount: 0, shipping: 0,
    paymentTerms: 'Net 30', notes: 'Reference #TRX#', customFieldsJson: '{}', strictValidation: true,
  });
  const template = await createTemplate.call(templateContext);

  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selectorContext = context([loader[0], emails[0]], {
    strategy: 'firstAvailable', processingMode: 'sequential', __executionId: executionId, providerFilter: 'custom', actionFilter: '', environmentFilter: 'live', queueWhenUnavailable: true,
    lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
  });
  const allocations = await selectProvider.call(selectorContext);

  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const builderContext = context([allocations[0], template[0], emails[0]], {
    strictProviderWarnings: false, customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', allowHttp: false,
  });
  const built = await buildRequest.call(builderContext);

  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([built[0]], {
    dryRun, includeResponseBody: true, stopOnTransportError: false, __nodeName: 'Invoice Sender',
  }, built[0].map((_item, index) => ({
    statusCode: httpStatus,
    headers: { 'content-type': 'application/json' },
    body: { id: `provider-invoice-${index + 1}`, status: httpStatus < 300 ? 'created' : 'failed' },
  })));
  const sent = await sendInvoice.call(senderContext);

  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checkerContext = context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' });
  const checked = await checkStatus.call(checkerContext);

  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managerContext = context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
  });
  const managed = await manageStatus.call(managerContext);

  return { loader, emails, template, allocations, built, sent, checked, managed, senderContext };
}

test('package registers exactly the frozen eight custom nodes', () => {
  assert.equal(pkg.name, 'n8n-nodes-invoicerouter');
  assert.equal(pkg.version, '1.2.0');
  assert.equal(pkg.n8n.nodes.length, 8);
  assert.equal(pkg.invoiceRouterFreeze.targetNodeCount, 8);
  assert.equal(pkg.invoiceRouterFreeze.currentNodeCount, 8);
  assert.equal(pkg.invoiceRouterFreeze.implementationStatus, 'COMPLETE');
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.n8n, 'credentials'), false);
});

test('all declared node artifacts and main declarations exist', () => {
  for (const relative of pkg.n8n.nodes) {
    const full = path.join(root, relative);
    assert.ok(fs.existsSync(full), `${relative} is missing`);
    assert.ok(Object.values(require(full)).some((value) => typeof value === 'function'));
  }
  assert.ok(fs.existsSync(path.join(root, pkg.main)));
  assert.ok(fs.existsSync(path.join(root, pkg.types)));
});

test('production workflow contains all eight custom node types and three Request Builder inputs', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v1-production.json'), 'utf8'));
  const custom = workflow.nodes.filter((node) => node.type.startsWith('n8n-nodes-invoicerouter.'));
  assert.equal(custom.length, 8);
  const incoming = [];
  for (const [source, connections] of Object.entries(workflow.connections)) {
    for (const output of connections.main ?? []) {
      for (const connection of output) if (connection.node === 'Request Builder') incoming.push([source, connection.index]);
    }
  }
  assert.deepEqual(incoming.sort((a, b) => a[1] - b[1]), [
    ['Provider Selector', 0], ['Invoice Template', 1], ['Email List', 2],
  ]);
});

test('Provider Loader masks Sheet credentials and creates the frozen providers[] structure', async () => {
  const result = await runPipeline({ dryRun: true });
  const output = result.loader[0][0].json;
  assert.equal(output.success, true);
  assert.equal(output.total, 1);
  assert.equal(Array.isArray(output.providers), true);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('super-secret-token'), false);
  assert.equal(serialized.includes('super-secret-value'), false);
});

test('Email List validates, deduplicates, generates names, and preserves custom columns', async () => {
  const result = await runPipeline({ dryRun: true });
  assert.equal(result.emails[0].length, 2);
  assert.equal(result.emails[0][0].json.recipient.name, 'John Doe');
  assert.equal(result.emails[0][0].json.recipient.customFields.Department, 'Finance');
  assert.equal(result.emails[0][0].json.skippedRecipients.length, 1);
});

test('Invoice Template calculates totals and Request Builder merges all three inputs', async () => {
  const result = await runPipeline({ dryRun: true });
  const template = result.template[0][0].json.invoiceTemplate;
  assert.equal(template.totals.subtotal, 125);
  assert.equal(template.totals.grandTotal, 130);
  const request = result.built[0][0].json.readyRequest;
  assert.equal(request.providerId, 'custom');
  assert.equal(request.recipient.email, 'john.doe@example.com');
  assert.match(request.invoice.invoiceNumber, /^INV-/);
  assert.equal(JSON.stringify(request).includes('super-secret-token'), false);
});

test('Invoice Sender injects secret only into HTTP request and redacts normal output', async () => {
  const result = await runPipeline({ dryRun: false, httpStatus: 201 });
  assert.equal(result.senderContext.calls.length, 2);
  assert.equal(result.senderContext.calls[0].headers.Authorization, 'Bearer super-secret-token');
  assert.equal(result.senderContext.calls[0].headers['Idempotency-Key'].length > 0, true);
  assert.equal(result.sent[0][0].json.rawExecution.httpStatus, 201);
  assert.equal(JSON.stringify(result.sent).includes('super-secret-token'), false);
});

test('Status Checker standardizes success and Status Manager completes workflow', async () => {
  const result = await runPipeline({ dryRun: false, httpStatus: 201 });
  assert.equal(result.checked[0][0].json.standardStatus.result, 'SUCCESS');
  assert.equal(result.checked[0][0].json.standardStatus.invoiceStatus, 'CREATED');
  assert.equal(result.managed[0][0].json.management.workflowState, 'COMPLETED');
  assert.equal(result.managed[0][0].json.management.providerFeedback.recommendation, 'RELEASE');
});

test('Status Manager schedules retry for retryable provider failure', async () => {
  const result = await runPipeline({ dryRun: false, httpStatus: 503 });
  assert.equal(result.checked[0][0].json.standardStatus.errorType, 'SERVER_ERROR');
  assert.equal(result.managed[0][0].json.management.workflowState, 'PENDING_RETRY');
  assert.equal(result.managed[0][0].json.management.retryScheduled, true);
  assert.equal(result.managed[0][0].json.management.providerFeedback.recommendation, 'COOLDOWN');
});


test('Dry Run remains neutral and does not create a false failure alert', async () => {
  const result = await runPipeline({ dryRun: true });
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'DRY_RUN');
  assert.equal(result.checked[0][0].json.standardStatus.invoiceStatus, 'PENDING');
  assert.equal(result.managed[0][0].json.management.workflowState, 'PROCESSING');
  assert.equal(result.managed[0][0].json.management.providerFeedback.recommendation, 'NO_CHANGE');
  assert.equal(result.managed[0][0].json.management.events.alert, null);
});

test('Queued allocations pass through Sender, Checker, and Manager without a false transport failure', async () => {
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sender = await sendInvoice.call(context([[
    { json: { requestBuild: { status: 'QUEUED', message: 'No account', allocation: { workerId: 'worker-q', scopeKey: 'scope-q' } } } },
  ]], { dryRun: false, includeResponseBody: true, stopOnTransportError: false }));
  assert.equal(sender[0][0].json.rawExecution.transportStatus, 'QUEUED');

  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sender[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'UNKNOWN');
  assert.equal(checked[0][0].json.standardStatus.invoiceStatus, 'PENDING');

  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, cooldownSeconds: 30,
    disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
  }));
  assert.equal(managed[0][0].json.management.workflowState, 'PROCESSING');
  assert.equal(managed[0][0].json.management.events.alert, null);
});

test('Provider feedback is idempotent when persisted feedback is replayed', () => {
  const store = load('shared/runtime/RuntimeStore.js');
  const scopeKey = `feedback-scope-${Date.now()}`;
  const profile = { id: 'profile-1', enabled: true, providerId: 'custom', actionId: 'send', environment: 'live' };
  store.registerProviderProfiles(scopeKey, [profile], new Map());
  const feedback = {
    feedbackId: 'feedback-unique-1', profileId: 'profile-1', status: 'FAILED', result: 'FAILED',
    httpStatus: 503, latencyMs: 500, retryCount: 1, cooldownSeconds: 30, recommendation: 'COOLDOWN',
  };
  store.applyProviderFeedback(scopeKey, feedback);
  store.applyProviderFeedback(scopeKey, feedback);
  const snapshot = store.publicPoolSnapshot(scopeKey)[0];
  assert.equal(snapshot.retryCount, 1);
});

test('Invoice Sender parses JSON response strings for downstream status extraction', async () => {
  const result = await runPipeline({ dryRun: false, httpStatus: 201 });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false, includeResponseBody: true, stopOnTransportError: false,
  }, result.built[0].map((_item, index) => ({
    statusCode: 201, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: `json-string-${index + 1}`, status: 'created' }),
  })));
  const sent = await sendInvoice.call(senderContext);
  assert.equal(sent[0][0].json.rawExecution.responseBody.id, 'json-string-1');
});
