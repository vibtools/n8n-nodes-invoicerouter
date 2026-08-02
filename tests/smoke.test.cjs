const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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
async function runPipeline({ dryRun = false, httpStatus = 201, providers = providerRows, recipients = recipientRows, selectorParams = {}, requestParams = {}, senderParams = {}, managerParams = {} } = {}) {
  pipelineSequence += 1;
  const batchId = `batch-test-${pipelineSequence}`;
  const executionId = `exec-test-${pipelineSequence}`;
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const loaderContext = context([providers], {
    batchId, __executionId: executionId, sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
  });
  const loader = await loadProviders.call(loaderContext);

  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const emailContext = context([recipients], {
    batchId, __executionId: executionId, emailField: 'Email', nameField: 'Name', addressField: 'Address', nameGeneration: 'formatted', invalidPolicy: 'skip', preserveCustomColumns: true, preventReuse: true,
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
    conditionalRouting: false, routeProviderPath: 'recipient.customFields.Provider', routeActionPath: 'recipient.customFields.Action', routeEnvironmentPath: 'recipient.customFields.Environment',
    routingRulesJson: '[]', requireConditionalMatch: false, unmatchedRouteBehavior: 'block',
    lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5, ...selectorParams,
  });
  const allocations = await selectProvider.call(selectorContext);

  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const builderContext = context([allocations[0], template[0], emails[0]], {
    strictProviderWarnings: false, strictProviderValidation: false, sendGuardMode: 'audit', customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'requestId', idempotencyScope: 'workflow', allowHttp: false, ...requestParams,
  });
  const built = await buildRequest.call(builderContext);

  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([built[0]], {
    dryRun, includeResponseBody: true, requireSendGuard: false, liveModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false, __nodeName: 'Invoice Sender', ...senderParams,
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
    retryLimit: 3, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 900, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
    includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 500, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId', ...managerParams,
  });
  const managed = await manageStatus.call(managerContext);

  return { loader, emails, template, allocations, built, sent, checked, managed, senderContext, managerContext };
}

test('package registers exactly the frozen eight custom nodes', () => {
  assert.equal(pkg.name, 'n8n-nodes-invoicerouter');
  assert.equal(pkg.version, '1.6.0');
  assert.equal(pkg.n8n.nodes.length, 8);
  assert.equal(pkg.invoiceRouterFreeze.targetNodeCount, 8);
  assert.equal(pkg.invoiceRouterFreeze.currentNodeCount, 8);
  assert.equal(pkg.invoiceRouterFreeze.implementationStatus, 'COMPLETE');
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.n8n, 'credentials'), false);
});



test('package is compatible with n8n registry and UI discovery', () => {
  assert.ok(pkg.keywords.includes('n8n-community-node-package'));
  for (const keyword of ['invoicerouter', 'invoice-router', 'bulk-invoice', 'invoice-automation', 'n8n-invoice-router']) {
    assert.ok(pkg.keywords.includes(keyword), `${keyword} keyword is missing`);
  }
  assert.equal(Boolean(pkg.peerDependencies?.['n8n-workflow']), false);
  assert.equal(pkg.n8n.n8nNodesApiVersion, 1);
  assert.ok(pkg.files.includes('docs/freeze/v1.0/N8N_REGISTRY_UI_INSTALL_COMPATIBILITY.md'));
  assert.ok(pkg.files.includes('scripts/diagnose-n8n-package.mjs'));
});

test('all frozen custom nodes use searchable InvoiceRouter display names', () => {
  const expected = new Map([
    ['ProviderLoader', 'InvoiceRouter Provider Loader'],
    ['ProviderSelector', 'InvoiceRouter Provider Selector'],
    ['InvoiceTemplate', 'InvoiceRouter Invoice Template'],
    ['EmailList', 'InvoiceRouter Email List'],
    ['RequestBuilder', 'InvoiceRouter Request Builder'],
    ['InvoiceSender', 'InvoiceRouter Invoice Sender'],
    ['StatusChecker', 'InvoiceRouter Status Checker'],
    ['StatusManager', 'InvoiceRouter Status Manager'],
  ]);
  for (const relative of pkg.n8n.nodes) {
    const moduleExports = require(path.join(root, relative));
    const NodeClass = Object.values(moduleExports).find((value) => typeof value === 'function');
    const instance = new NodeClass();
    assert.equal(instance.description.displayName, expected.get(NodeClass.name));
    assert.ok(instance.description.defaults.name.startsWith('InvoiceRouter '));
  }
});

test('installed package diagnostic validates the built package root', () => {
  const output = execFileSync(process.execPath, [path.join(root, 'scripts/diagnose-n8n-package.mjs'), root], { encoding: 'utf8' });
  assert.match(output, /Diagnostic result: PASS/);
  assert.match(output, /n8n-nodes-invoicerouter@1\.6\.0/);
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


test('all frozen custom nodes expose packaged SVG runtime icons', () => {
  const expected = new Map([
    ['ProviderLoader', 'invoice-router-provider-loader.svg'],
    ['ProviderSelector', 'invoice-router-provider-selector.svg'],
    ['InvoiceTemplate', 'invoice-router-invoice-template.svg'],
    ['EmailList', 'invoice-router-email-list.svg'],
    ['RequestBuilder', 'invoice-router-request-builder.svg'],
    ['InvoiceSender', 'invoice-router-invoice-sender.svg'],
    ['StatusChecker', 'invoice-router-status-checker.svg'],
    ['StatusManager', 'invoice-router-status-manager.svg'],
  ]);
  assert.ok(pkg.files.includes('docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md'));
  assert.ok(fs.existsSync(path.join(root, 'docs/freeze/v1.0/NODE_ICON_CARD_WIRING.md')));

  for (const relative of pkg.n8n.nodes) {
    const full = path.join(root, relative);
    const moduleExports = require(full);
    const NodeClass = Object.values(moduleExports).find((value) => typeof value === 'function');
    const instance = new NodeClass();
    const expectedIcon = expected.get(NodeClass.name);
    assert.equal(instance.description.icon, `file:${expectedIcon}`);
    const iconPath = path.join(path.dirname(full), expectedIcon);
    assert.ok(fs.existsSync(iconPath), `${expectedIcon} is missing beside ${relative}`);
    const iconSource = fs.readFileSync(iconPath, 'utf8');
    assert.match(iconSource, /<svg[\s>]/);
    assert.match(iconSource, /data-design-source="asset-card-v1"/);
    assert.match(iconSource, /data-icon-style="vib-tools-node-card-polished"/);
    assert.match(iconSource, /linearGradient/);
    assert.doesNotMatch(iconSource, /<text[\s>]/);
    assert.doesNotMatch(iconSource, /font-family/);
  }
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


test('production workflow and validation package keep first import run dry-run safe', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v1-production.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(byName['Provider Selector'].parameters.environmentFilter, 'sandbox');
  assert.equal(byName['Provider Selector'].parameters.conditionalRouting, false);
  assert.equal(byName['Provider Selector'].parameters.providerFilter, 'Odoo');
  assert.equal(byName['Provider Selector'].parameters.actionFilter, 'Create Invoice');
  assert.equal(byName['Provider Selector'].parameters.requireConditionalMatch, false);
  assert.equal(byName['Request Builder'].parameters.sendGuardMode, 'strict');
  assert.equal(byName['Request Builder'].parameters.strictProviderValidation, true);
  assert.equal(byName['Invoice Sender'].parameters.dryRun, true);
  assert.equal(byName['Invoice Sender'].parameters.productionPresetMode, 'dryRunValidation');
  assert.equal(byName['Invoice Sender'].parameters.requireSendGuard, true);
  assert.equal(byName['Invoice Sender'].parameters.preventDuplicateSends, true);
  assert.equal(byName['Invoice Sender'].parameters.activationSafetyMode, 'dryRunValidation');
  assert.equal(byName['Invoice Sender'].parameters.expectedEnvironment, 'sandbox');
  assert.equal(byName['Invoice Sender'].parameters.sandboxModeConfirmation, '');
  assert.equal(byName['Invoice Sender'].parameters.liveModeConfirmation, '');
  assert.equal(byName['Status Manager'].parameters.includeExecutionLog, true);
  assert.equal(byName['Status Manager'].parameters.includeStatusWriteback, true);
  assert.equal(byName['Status Manager'].parameters.respectRetryAfterHeader, true);
  assert.equal(byName['Status Manager'].parameters.retryMaxDelaySeconds, 900);
  assert.equal(byName['Prepare Status Writeback Row'].type, 'n8n-nodes-base.code');
  assert.match(byName['Prepare Status Writeback Row'].parameters.jsCode, /management\.statusWriteback/);
  assert.equal(byName['Google Sheets - Status Writeback'].type, 'n8n-nodes-base.googleSheets');
  assert.equal(byName['Google Sheets - Status Writeback'].parameters.operation, 'appendOrUpdate');
  assert.deepEqual(byName['Google Sheets - Status Writeback'].parameters.columns.matchingColumns, ['writeback_key']);
  assert.ok(pkg.files.includes('examples/n8n_dry_run_validation'));
  assert.ok(pkg.files.includes('docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md'));
  assert.ok(pkg.files.includes('docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md'));
  assert.ok(pkg.files.includes('docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md'));
  for (const relative of [
    'docs/freeze/v1.0/N8N_DRY_RUN_VALIDATION.md',
    'docs/freeze/v1.0/STATUS_WRITEBACK_WIRING.md',
    'docs/freeze/v1.0/SANDBOX_LIVE_ACTIVATION.md',
    'examples/n8n_dry_run_validation/README.md',
    'examples/n8n_dry_run_validation/provider-accounts-dry-run.csv',
    'examples/n8n_dry_run_validation/email-list-dry-run.csv',
    'examples/n8n_dry_run_validation/status-writeback-columns.csv',
    'examples/n8n_dry_run_validation/expected-dry-run-outcomes.json',
  ]) {
    assert.ok(fs.existsSync(path.join(root, relative)), `${relative} is missing`);
  }
});

test('production workflow wires status writeback branch to Google Sheets append/update', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v1-production.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const statusTargets = workflow.connections['Status Manager'].main[0].map((connection) => connection.node);
  const writebackTargets = workflow.connections['Prepare Status Writeback Row'].main[0].map((connection) => connection.node);
  assert.ok(statusTargets.includes('Prepare Status Writeback Row'));
  assert.ok(statusTargets.includes('Prepare Retry Request'));
  assert.deepEqual(writebackTargets, ['Google Sheets - Status Writeback']);
  assert.equal(byName['Google Sheets - Status Writeback'].parameters.sheetName.value, 'invoice_results');
  assert.equal(byName['Google Sheets - Status Writeback'].parameters.documentId.value, 'REPLACE_INVOICEROUTER_SPREADSHEET_ID');
  assert.equal(byName['Google Sheets - Status Writeback'].parameters.columns.value.writeback_key, '={{ $json.writeback_key }}');
  assert.equal(byName['Google Sheets - Status Writeback'].parameters.columns.value.activation_mode, '={{ $json.activation_mode }}');
  const headers = fs.readFileSync(path.join(root, 'examples/n8n_dry_run_validation/status-writeback-columns.csv'), 'utf8').trim().split(',');
  assert.equal(headers[0], 'writeback_key');
  assert.ok(headers.includes('workflow_state'));
  assert.ok(headers.includes('idempotency_key'));
  assert.ok(headers.includes('activation_mode'));
  assert.ok(headers.includes('activation_approved'));
  assert.ok(headers.includes('activation_safety'));
  assert.ok(headers.includes('duplicate_prevention'));
  assert.ok(headers.includes('preset_self_check_mode'));
  assert.ok(headers.includes('preset_self_check_approved'));
});


test('production workflow wires automatic retry branch back to Invoice Sender', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v1-production.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const statusTargets = workflow.connections['Status Manager'].main[0].map((connection) => connection.node);
  assert.ok(statusTargets.includes('Prepare Retry Request'));
  assert.equal(byName['Prepare Retry Request'].type, 'n8n-nodes-base.code');
  assert.match(byName['Prepare Retry Request'].parameters.jsCode, /management\.retryScheduled/);
  assert.match(byName['Prepare Retry Request'].parameters.jsCode, /retryCount/);
  assert.equal(byName['Wait Before Retry'].type, 'n8n-nodes-base.wait');
  assert.deepEqual(workflow.connections['Prepare Retry Request'].main[0].map((connection) => connection.node), ['Wait Before Retry']);
  assert.deepEqual(workflow.connections['Wait Before Retry'].main[0].map((connection) => connection.node), ['Invoice Sender']);
  assert.ok(pkg.files.includes('docs/freeze/v1.0/PRODUCTION_PRESET_SELF_CHECK_AND_RETRY_WIRING.md'));
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

test('Email List simple bulk mode requires only email and keeps blank address empty', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const emailContext = context([[
    { json: { Email: 'alpha.customer@example.com' } },
    { json: { Email: 'beta@example.com', Name: 'Beta User', Address: '123 Test Street' } },
  ]], {
    batchId: 'simple-bulk', emailField: 'Email', nameField: 'Name', addressField: 'Address', nameGeneration: 'formatted', invalidPolicy: 'skip', preserveCustomColumns: false, preventReuse: true,
  });
  const result = await loadEmails.call(emailContext);
  assert.equal(result[0].length, 2);
  assert.equal(result[0][0].json.recipient.name, 'Alpha Customer');
  assert.equal(result[0][0].json.recipient.address, '');
  assert.equal(result[0][0].json.recipient.customFields && Object.keys(result[0][0].json.recipient.customFields).length, 0);
  assert.equal(result[0][1].json.recipient.name, 'Beta User');
  assert.equal(result[0][1].json.recipient.address, '123 Test Street');
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


test('Conditional routing uses per-recipient provider, action, and environment fields', async () => {
  const providers = [
    providerRows[0],
    { json: { ...providerRows[0].json, Account: 'Secondary Account', Action: 'VIP Invoice', Endpoint: '/vip-invoices', Notes: 'VIP test provider row' } },
  ];
  const recipients = [
    { json: { Email: 'vip@example.com', Name: 'VIP Customer', Provider: 'Custom', Action: 'VIP Invoice', Environment: 'Live' } },
  ];
  const result = await runPipeline({
    dryRun: true,
    providers,
    recipients,
    selectorParams: { conditionalRouting: true, providerFilter: '', actionFilter: '', environmentFilter: '', requireConditionalMatch: true },
    senderParams: { requireSendGuard: true },
  });
  const allocation = result.allocations[0][0].json.providerAllocation;
  assert.equal(allocation.accountId, 'secondary-account');
  assert.equal(allocation.routing.matched, true);
  assert.equal(allocation.routing.effectiveFilters.actionId, 'vip-invoice');
  assert.equal(result.built[0][0].json.readyRequest.sendGuard.approved, true);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'DRY_RUN');
});

test('Required conditional routing blocks unrouted recipients before Sender transport', async () => {
  const recipients = [{ json: { Email: 'unrouted@example.com', Name: 'Unrouted Customer' } }];
  const result = await runPipeline({
    dryRun: false,
    recipients,
    selectorParams: { conditionalRouting: true, providerFilter: '', actionFilter: '', environmentFilter: '', requireConditionalMatch: true },
    senderParams: { requireSendGuard: true, liveModeConfirmation: 'SEND_REAL_INVOICES' },
  });
  assert.equal(result.allocations[0][0].json.providerAllocation.status, 'BLOCKED');
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.equal(result.senderContext.calls.length, 0);
  assert.equal(result.checked[0][0].json.standardStatus.result, 'BLOCKED');
  assert.equal(result.managed[0][0].json.management.workflowState, 'BLOCKED');
});

test('Invoice Sender send guard blocks live sends without explicit confirmation', async () => {
  const result = await runPipeline({ dryRun: false, senderParams: { requireSendGuard: true } });
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.match(result.sent[0][0].json.rawExecution.error.message, /Live mode is blocked/);
  assert.equal(result.senderContext.calls.length, 0);
});



test('Provider-specific strict validation stops missing required custom fields', async () => {
  const providers = [{ json: { ...providerRows[0].json, Provider: 'Stripe', Account: 'Stripe Account', Action: 'Create Invoice' } }];
  await assert.rejects(
    () => runPipeline({
      dryRun: true,
      providers,
      selectorParams: { providerFilter: 'stripe', environmentFilter: 'live' },
      requestParams: { strictProviderValidation: true },
    }),
    /Stripe requires custom_fields\.customer_id/,
  );
});

test('Send guard blocks provider validation errors before live transport', async () => {
  const providers = [{ json: { ...providerRows[0].json, Provider: 'Stripe', Account: 'Stripe Account', Action: 'Create Invoice' } }];
  const result = await runPipeline({
    dryRun: false,
    providers,
    selectorParams: { providerFilter: 'stripe', environmentFilter: 'live' },
    requestParams: { sendGuardMode: 'audit' },
    senderParams: { requireSendGuard: true, liveModeConfirmation: 'SEND_REAL_INVOICES' },
  });
  assert.equal(result.built[0][0].json.requestBuild.providerValidationErrorCount, 1);
  assert.equal(result.built[0][0].json.readyRequest.sendGuard.approved, false);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.equal(result.senderContext.calls.length, 0);
});


test('Invoice Sender blocks duplicate live sends by idempotency key', async () => {
  const result = await runPipeline({
    dryRun: true,
    requestParams: { idempotencyKeyMode: 'providerInvoiceRecipient', idempotencyScope: 'workflow' },
  });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const first = result.built[0][0];
  const duplicate = JSON.parse(JSON.stringify(first));
  const senderContext = context([[first, duplicate]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, liveModeConfirmation: 'SEND_REAL_INVOICES',
    preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 201, headers: { 'content-type': 'application/json' }, body: { id: 'provider-invoice-deduped', status: 'created' } },
    { statusCode: 201, headers: { 'content-type': 'application/json' }, body: { id: 'provider-invoice-should-not-send', status: 'created' } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 1);
  assert.equal(sent[0][0].json.rawExecution.transportStatus, 'COMPLETED');
  assert.equal(sent[0][1].json.rawExecution.transportStatus, 'DUPLICATE');
  assert.equal(sent[0][1].json.rawExecution.duplicate.blocked, true);

  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][1].json.standardStatus.result, 'DUPLICATE');
  assert.equal(checked[0][1].json.standardStatus.invoiceStatus, 'DUPLICATE');

  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, cooldownSeconds: 30,
    disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
  }));
  assert.equal(managed[0][1].json.management.workflowState, 'DUPLICATE');
  assert.equal(managed[0][1].json.management.events.alert, null);
});


test('Status Manager emits hardened execution log and status writeback payloads', async () => {
  const result = await runPipeline({
    dryRun: false,
    httpStatus: 201,
    requestParams: { idempotencyKeyMode: 'providerInvoiceRecipient', idempotencyScope: 'workflow' },
    managerParams: { writebackKeyMode: 'idempotencyKey', writebackTarget: 'invoice_results' },
  });
  const management = result.managed[0][0].json.management;
  assert.equal(management.executionLog.event, 'INVOICE_ROUTER_EXECUTION_RESULT');
  assert.equal(management.executionLog.result, 'SUCCESS');
  assert.equal(management.executionLog.recipientEmail, 'john.doe@example.com');
  assert.equal(management.statusWriteback.action, 'UPSERT');
  assert.equal(management.statusWriteback.target, 'invoice_results');
  assert.equal(management.statusWriteback.key, result.checked[0][0].json.standardStatus.idempotency.value);
  assert.equal(management.statusWriteback.values.workflowState, 'COMPLETED');
  assert.equal(management.events.database.writeback.key, management.statusWriteback.key);
});

test('Status Manager can persist capped execution logs in workflow static data', async () => {
  const result = await runPipeline({
    dryRun: false,
    httpStatus: 201,
    managerParams: { persistExecutionLog: true, executionLogRetention: 1 },
  });
  assert.equal(result.managerContext.staticData.invoiceRouterExecutionLog.length, 1);
  assert.equal(result.managerContext.staticData.invoiceRouterExecutionLog[0].event, 'INVOICE_ROUTER_EXECUTION_RESULT');
});

test('Request Builder attaches provider request mapping and response policy metadata', async () => {
  const result = await runPipeline({ dryRun: true });
  const request = result.built[0][0].json.readyRequest;
  assert.equal(request.requestMapping.providerId, 'custom');
  assert.equal(request.requestMapping.responseKind, 'custom');
  assert.deepEqual(request.responsePolicy.successStatusCodes, [200, 201, 202]);
  assert.ok(Array.isArray(request.responsePaths.invoiceId));
  assert.equal(result.built[0][0].json.requestBuild.responseKind, 'custom');
});

test('Invoice Sender blocks live transport when provider request tokens remain unresolved', async () => {
  const result = await runPipeline({ dryRun: true });
  const item = JSON.parse(JSON.stringify(result.built[0][0]));
  item.json.readyRequest.url = 'https://api.example.test/{missingTenant}/invoices';
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([[item]], {
    dryRun: false,
    includeResponseBody: true,
    requireSendGuard: true,
    liveModeConfirmation: 'SEND_REAL_INVOICES',
    preventDuplicateSends: false,
    duplicateTtlHours: 720,
    reservationTtlMinutes: 15,
    stopOnTransportError: false,
  }, [{ statusCode: 201, headers: {}, body: { id: 'should-not-send', status: 'created' } }]);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 0);
  assert.equal(sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.match(sent[0][0].json.rawExecution.error.message, /unresolved template tokens/);
});

test('Status Checker uses fallback response paths and response policy retry hints', async () => {
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([[
    {
      json: {
        rawExecution: {
          schemaVersion: '1.0',
          success: false,
          transportStatus: 'COMPLETED',
          requestId: 'req-policy-1',
          providerId: 'custom',
          profileId: 'profile-policy',
          accountId: 'account-policy',
          actionId: 'custom-request',
          httpStatus: 409,
          responseHeaders: {},
          responseBody: { data: { id: 'fallback-invoice-1', status: 'pending' } },
          latencyMs: 10,
          responseSizeBytes: 64,
          responsePaths: { invoiceId: ['missing.id', 'data.id'], status: ['missing.status', 'data.status'] },
          responsePolicy: { successStatusCodes: [200, 201, 202], retryableStatusCodes: [409], nonRetryableStatusCodes: [400, 401, 403, 422] },
          startedAt: '2026-08-01T00:00:00.000Z',
          finishedAt: '2026-08-01T00:00:01.000Z',
        },
        readyRequest: { recipient: { email: 'policy@example.com' } },
      },
    },
  ]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const status = checked[0][0].json.standardStatus;
  assert.equal(status.providerInvoiceId, 'fallback-invoice-1');
  assert.equal(status.providerStatus, 'pending');
  assert.equal(status.retryableByPolicy, true);
  assert.equal(status.errorType, 'RETRYABLE_PROVIDER_ERROR');
});



test('Invoice Sender activation safety blocks sandbox real send without sandbox confirmation', async () => {
  const sandboxProviders = providerRows.map((row) => ({ json: { ...row.json, Environment: 'Sandbox' } }));
  const result = await runPipeline({
    dryRun: false,
    providers: sandboxProviders,
    selectorParams: { environmentFilter: 'sandbox' },
    requestParams: { sendGuardMode: 'strict' },
    senderParams: {
      requireSendGuard: true,
      activationSafetyMode: 'sandboxRealSend',
      expectedEnvironment: 'sandbox',
      sandboxModeConfirmation: '',
      liveModeConfirmation: '',
    },
  });
  assert.equal(result.senderContext.calls.length, 0);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.equal(result.sent[0][0].json.rawExecution.activationSafety.mode, 'sandboxRealSend');
  assert.equal(result.sent[0][0].json.rawExecution.activationSafety.approved, false);
  assert.match(result.sent[0][0].json.rawExecution.error.message, /SEND_SANDBOX_INVOICES/);
});

test('Invoice Sender activation safety allows confirmed sandbox real send without live confirmation', async () => {
  const sandboxProviders = providerRows.map((row) => ({ json: { ...row.json, Environment: 'Sandbox' } }));
  const result = await runPipeline({
    dryRun: false,
    httpStatus: 201,
    providers: sandboxProviders,
    selectorParams: { environmentFilter: 'sandbox' },
    requestParams: { sendGuardMode: 'strict' },
    senderParams: {
      requireSendGuard: true,
      activationSafetyMode: 'sandboxRealSend',
      expectedEnvironment: 'sandbox',
      sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES',
      liveModeConfirmation: '',
    },
  });
  assert.equal(result.senderContext.calls.length, 2);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'COMPLETED');
  assert.equal(result.sent[0][0].json.rawExecution.activationSafety.approved, true);
  assert.equal(result.checked[0][0].json.standardStatus.activationMode, 'sandboxRealSend');
  assert.equal(result.managed[0][0].json.management.statusWriteback.values.activationMode, 'sandboxRealSend');
  assert.equal(result.managed[0][0].json.management.statusWriteback.values.activationApproved, true);
});

test('Invoice Sender activation safety blocks live real send when request is sandbox routed', async () => {
  const sandboxProviders = providerRows.map((row) => ({ json: { ...row.json, Environment: 'Sandbox' } }));
  const result = await runPipeline({
    dryRun: false,
    providers: sandboxProviders,
    selectorParams: { environmentFilter: 'sandbox' },
    requestParams: { sendGuardMode: 'strict' },
    senderParams: {
      requireSendGuard: true,
      activationSafetyMode: 'liveRealSend',
      expectedEnvironment: 'live',
      liveModeConfirmation: 'SEND_REAL_INVOICES',
    },
  });
  assert.equal(result.senderContext.calls.length, 0);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.equal(result.sent[0][0].json.rawExecution.activationSafety.mode, 'liveRealSend');
  assert.equal(result.sent[0][0].json.rawExecution.activationSafety.approved, false);
});

test('Status Checker classifies rate limits and parses Retry-After headers', async () => {
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([[
    {
      json: {
        rawExecution: {
          schemaVersion: '1.0', success: false, transportStatus: 'COMPLETED', requestId: 'req-rate-limit-1',
          providerId: 'custom', profileId: 'profile-rate', accountId: 'account-rate', actionId: 'custom-request',
          httpStatus: 429, responseHeaders: { 'Retry-After': '120' }, responseBody: { error: { message: 'Too many requests' } },
          latencyMs: 10, responseSizeBytes: 64, responsePaths: { errorMessage: 'error.message' },
          responsePolicy: { successStatusCodes: [200, 201, 202], retryableStatusCodes: [429], nonRetryableStatusCodes: [400, 401, 403, 422] },
          startedAt: '2026-08-01T00:00:00.000Z', finishedAt: '2026-08-01T00:00:01.000Z',
        },
        readyRequest: { recipient: { email: 'rate@example.com' } },
      },
    },
  ]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const status = checked[0][0].json.standardStatus;
  assert.equal(status.errorType, 'RATE_LIMIT_ERROR');
  assert.equal(status.errorCategory, 'rate_limit');
  assert.equal(status.retryAfterSeconds, 120);
  assert.equal(status.retryDecision.retryable, true);
  assert.equal(status.retryDecision.safeToRetry, true);
});

test('Status Manager honors provider retry-after hints and caps retry delay', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([[
    {
      json: {
        standardStatus: {
          schemaVersion: '1.0', requestId: 'req-retry-after-1', providerId: 'custom', profileId: 'profile-retry',
          accountId: 'account-retry', actionId: 'custom-request', transportStatus: 'COMPLETED', result: 'FAILED',
          invoiceStatus: 'FAILED', httpStatus: 429, errorType: 'RATE_LIMIT_ERROR', errorCategory: 'rate_limit',
          errorSeverity: 'medium', alertSeverity: 'warning', errorMessage: 'Too many requests', retryAfterSeconds: 120,
          retryDelayHintSeconds: 120, retryDecision: { retryable: true, safeToRetry: true, source: 'http_or_message', reason: 'Provider rate limit was reached.', retryAfterSeconds: 120, retryDelayHintSeconds: 120 },
          retryableByPolicy: false, nonRetryableByPolicy: false, checkedAt: '2026-08-01T00:00:01.000Z',
          runtime: { scopeKey: 'scope-retry-after' },
        },
      },
    },
  ]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 90, respectRetryAfterHeader: true,
    cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
    includeExecutionLog: true, includeStatusWriteback: true, persistExecutionLog: false,
  }));
  const management = managed[0][0].json.management;
  assert.equal(management.retryScheduled, true);
  assert.equal(management.retryDelaySeconds, 90);
  assert.equal(management.retryQueueEntry.delaySeconds, 90);
  assert.equal(management.statusWriteback.values.retryDecisionSource, 'http_or_message');
  assert.equal(management.statusWriteback.values.retryAfterSeconds, 120);
});

test('Status Manager does not retry non-retryable validation errors', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([[
    {
      json: {
        standardStatus: {
          schemaVersion: '1.0', requestId: 'req-validation-1', providerId: 'custom', profileId: 'profile-validation',
          accountId: 'account-validation', actionId: 'custom-request', transportStatus: 'COMPLETED', result: 'FAILED',
          invoiceStatus: 'FAILED', httpStatus: 422, errorType: 'VALIDATION_ERROR', errorCategory: 'validation',
          errorSeverity: 'medium', alertSeverity: 'warning', errorMessage: 'Missing required customer_id',
          retryDecision: { retryable: false, safeToRetry: false, source: 'http_or_message', reason: 'Provider rejected request validation; fix request data before retrying.' },
          retryableByPolicy: false, nonRetryableByPolicy: true, checkedAt: '2026-08-01T00:00:01.000Z',
          runtime: { scopeKey: 'scope-validation' },
        },
      },
    },
  ]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 900, respectRetryAfterHeader: true,
    cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
    includeExecutionLog: true, includeStatusWriteback: true, persistExecutionLog: false,
  }));
  const management = managed[0][0].json.management;
  assert.equal(management.retryScheduled, false);
  assert.equal(management.workflowState, 'FAILED');
  assert.equal(management.providerFeedback.recommendation, 'REVIEW');
  assert.equal(management.events.alert.severity, 'WARNING');
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

test('Invoice Sender bulk safety blocks runs above the configured item cap', async () => {
  const result = await runPipeline({ dryRun: true });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false,
    includeResponseBody: true,
    requireSendGuard: false,
    activationSafetyMode: 'compatibility',
    liveModeConfirmation: '',
    enableBulkSafety: true,
    maxInvoicesPerExecution: 1,
    requireUniformEnvironment: true,
    delayBetweenSendsMs: 0,
    maxFailedSendsBeforeAbort: 5,
    stopOnCriticalBulkError: true,
  }, [{ statusCode: 201, headers: {}, body: { id: 'should-not-send' } }]);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 0);
  assert.equal(sent[0].length, result.built[0].length);
  assert.ok(sent[0].every((item) => item.json.rawExecution.transportStatus === 'BLOCKED'));
  assert.equal(sent[0][0].json.rawExecution.bulkSafety.decision, 'BLOCK_RUN');
  assert.match(sent[0][0].json.rawExecution.error.message, /Max Invoices Per Execution/);
});

test('Invoice Sender bulk safety requires explicit sandbox bulk confirmation for multi-item real sends', async () => {
  const sandboxProviders = providerRows.map((row) => ({ json: { ...row.json, Environment: 'Sandbox' } }));
  const result = await runPipeline({
    dryRun: false,
    providers: sandboxProviders,
    selectorParams: { environmentFilter: 'sandbox' },
    requestParams: { sendGuardMode: 'strict' },
    senderParams: {
      requireSendGuard: true,
      activationSafetyMode: 'sandboxRealSend',
      expectedEnvironment: 'sandbox',
      sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES',
      enableBulkSafety: true,
      maxInvoicesPerExecution: 100,
      requireUniformEnvironment: true,
      delayBetweenSendsMs: 0,
      maxFailedSendsBeforeAbort: 5,
      stopOnCriticalBulkError: true,
      sandboxBulkConfirmation: '',
    },
  });
  assert.equal(result.senderContext.calls.length, 0);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.match(result.sent[0][0].json.rawExecution.error.message, /SEND_BULK_SANDBOX_INVOICES/);
  assert.equal(result.sent[0][0].json.rawExecution.bulkSafety.enabled, true);
});

test('Invoice Sender bulk safety aborts remaining items after failed-send threshold', async () => {
  const sandboxProviders = providerRows.map((row) => ({ json: { ...row.json, Environment: 'Sandbox' } }));
  const result = await runPipeline({
    dryRun: false,
    httpStatus: 500,
    providers: sandboxProviders,
    selectorParams: { environmentFilter: 'sandbox' },
    requestParams: { sendGuardMode: 'strict' },
    senderParams: {
      requireSendGuard: true,
      activationSafetyMode: 'sandboxRealSend',
      expectedEnvironment: 'sandbox',
      sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES',
      enableBulkSafety: true,
      maxInvoicesPerExecution: 100,
      requireUniformEnvironment: true,
      delayBetweenSendsMs: 0,
      maxFailedSendsBeforeAbort: 1,
      stopOnCriticalBulkError: false,
      sandboxBulkConfirmation: 'SEND_BULK_SANDBOX_INVOICES',
    },
  });
  assert.equal(result.senderContext.calls.length, 1);
  assert.equal(result.sent[0][0].json.rawExecution.transportStatus, 'COMPLETED');
  assert.equal(result.sent[0][1].json.rawExecution.transportStatus, 'BLOCKED');
  assert.match(result.sent[0][1].json.rawExecution.error.message, /stopped remaining items/);
  assert.equal(result.managed[0][0].json.management.bulkSummary.totalItems, 2);
  assert.equal(result.managed[0][0].json.management.bulkSummary.failed, 1);
  assert.equal(result.managed[0][0].json.management.bulkSummary.blocked, 1);
  assert.equal(result.managed[0][0].json.management.statusWriteback.values.bulkRunId, result.checked[0][0].json.standardStatus.bulkRunId);
});

test('Invoice Sender production preset self-check blocks unsafe dry-run preset changes', async () => {
  const result = await runPipeline({ dryRun: true });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false,
    productionPresetMode: 'dryRunValidation',
    includeResponseBody: true,
    requireSendGuard: true,
    preventDuplicateSends: true,
    enableBulkSafety: true,
    requireUniformEnvironment: true,
    stopOnTransportError: false,
    stopOnCriticalBulkError: true,
    maxInvoicesPerExecution: 100,
    maxFailedSendsBeforeAbort: 5,
    activationSafetyMode: 'dryRunValidation',
    expectedEnvironment: 'sandbox',
    sandboxModeConfirmation: '',
    liveModeConfirmation: '',
    sandboxBulkConfirmation: '',
    liveBulkConfirmation: '',
  }, [{ statusCode: 201, headers: {}, body: { id: 'should-not-send' } }]);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 0);
  assert.equal(sent[0][0].json.rawExecution.transportStatus, 'BLOCKED');
  assert.equal(sent[0][0].json.rawExecution.presetSelfCheck.approved, false);
  assert.match(sent[0][0].json.rawExecution.error.message, /Production preset self-check failed/);
});

test('Status Manager retry output can be prepared for automatic retry execution', async () => {
  const result = await runPipeline({ dryRun: false, httpStatus: 503 });
  const item = result.managed[0][0];
  assert.equal(item.json.management.retryScheduled, true);
  const management = item.json.management;
  const retryItem = {
    json: {
      ...item.json,
      retryCount: Number(management.retryCount || 0),
      retryDelaySeconds: Math.max(1, Number(management.retryDelaySeconds || management.retryQueueEntry.delaySeconds || 1)),
      retryQueueEntry: management.retryQueueEntry,
      retryLoop: {
        enabled: true,
        source: 'Status Manager',
        nextRetryCount: Number(management.retryCount || 0),
        delaySeconds: Math.max(1, Number(management.retryDelaySeconds || management.retryQueueEntry.delaySeconds || 1)),
      },
    },
  };
  assert.equal(retryItem.json.retryCount, 1);
  assert.equal(retryItem.json.retryLoop.enabled, true);
  assert.ok(retryItem.json.readyRequest);
});


test('v1.6 simple workflow keeps recipient rows provider-free', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v1.6-simple-bulk-email.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(workflow.meta.invoiceRouterRelease, '1.6.0');
  assert.equal(byName['Provider Selector'].parameters.conditionalRouting, false);
  assert.equal(byName['Provider Selector'].parameters.providerFilter, 'Odoo');
  assert.equal(byName['Email List'].parameters.emailField, 'Email');
  assert.equal(byName['Email List'].parameters.nameField, 'Name');
  assert.equal(byName['Email List'].parameters.addressField, 'Address');
  assert.equal(byName['Email List'].parameters.preserveCustomColumns, false);
  const providerCsv = fs.readFileSync(path.join(root, 'examples/n8n_simple_bulk_email/provider-simple-odoo.csv'), 'utf8');
  const emailCsv = fs.readFileSync(path.join(root, 'examples/n8n_simple_bulk_email/email-list-simple.csv'), 'utf8');
  assert.match(providerCsv.split(/\r?\n/)[0], /Username,Password,Database/);
  assert.equal(emailCsv.split(/\r?\n/)[0], 'Email,Name,Address');
});

test('Provider Loader accepts Odoo account credentials from provider sheet only', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const loaderContext = context([[
    { json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"odooPostInvoice":false}', Timeout: 60 } },
  ]], { batchId: 'odoo-provider', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true });
  const result = await loadProviders.call(loaderContext);
  const provider = result[0][0].json.providers[0];
  assert.equal(provider.providerId, 'odoo');
  assert.equal(provider.authType, 'odoo-json-rpc');
  assert.equal(provider.connection.extraConfig.odooPostInvoice, false);
  assert.equal(JSON.stringify(result).includes('odoo-secret'), false);
});

test('Odoo request build no longer requires partner_id in email_list', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"odooPostInvoice":false}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com' } }];
  const result = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' }, requestParams: { strictProviderValidation: true } });
  const request = result.built[0][0].json.readyRequest;
  assert.equal(request.providerId, 'odoo');
  assert.equal(request.recipient.name, 'New Customer');
  assert.equal(request.requestMapping.transportStrategy, 'odoo_auto_customer_invoice');
  assert.equal(result.built[0][0].json.requestBuild.providerValidationErrorCount, 0);
});

test('Invoice Sender executes Odoo auto customer then invoice sequence', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"odooPostInvoice":false}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com', Address: '42 Test Lane' } }];
  const responses = [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: 501 } },
  ];
  const result = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES', liveModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, responses);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 4);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 201);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.id, 501);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_id, 88);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_created, true);
  assert.equal(JSON.stringify(sent).includes('odoo-secret'), false);
});
