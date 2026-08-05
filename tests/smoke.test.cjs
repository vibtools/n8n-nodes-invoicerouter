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
        const response = responses[calls.length - 1];
        if (response instanceof Error) throw response;
        if (typeof response === 'function') return response(options, calls.length);
        return response ?? { statusCode: 200, headers: {}, body: {} };
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
    lineItemsJson: '[{"name":"Service","description":"Work for #NAME#","quantity":1,"unit_price":125}]', tax: providers.some((entry) => String(entry?.json?.Provider || '').toLowerCase() === 'odoo') ? 0 : 5, discount: 0, shipping: 0,
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


function odooRpcCall(options) {
  const body = options?.body ?? {};
  const params = body.params ?? {};
  const args = Array.isArray(params.args) ? params.args : [];
  return {
    service: args[1] ?? '',
    rpcMethod: args[2] ?? '',
    database: args[0] ?? '',
    uid: args[1] ?? 0,
    model: args[3] ?? '',
    method: args[4] ?? '',
    args: args[5] ?? [],
    kwargs: args[6] ?? {},
  };
}

function odooDraftResponses() {
  return [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    { statusCode: 200, headers: {}, body: { result: 501 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', ref: 'INV-TEST', partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: false }] } },
  ];
}

function odooEmailResponses({
  notificationStatus = 'sent',
  mailState = '',
  wizardMethods = ['email'],
  wizardPartnerIds = [88],
  wizardSendResponse = { statusCode: 200, headers: {}, body: { result: { type: 'ir.actions.act_window_close' } } },
  verificationErrors = false,
  baselineError = false,
  beforeMessageIds = [10, 9],
  afterMessageIds = [11],
  messagePartnerIds = [88],
  messageAttachmentIds = [900],
  notificationPartnerId = 88,
  emailTo = 'new.customer@example.com',
  recipientIds = [88],
  failureReason = '',
  invoicePdfReportId = [900, 'INV_2026_00001.pdf'],
  attachmentRecords = [{ id: 900, name: 'INV_2026_00001.pdf', mimetype: 'application/pdf', res_model: 'account.move', res_id: 501, type: 'binary' }],
} = {}) {
  const errorBody = { error: { code: 403, message: 'Access denied while reading mail evidence.' } };
  const messageResponse = verificationErrors
    ? { statusCode: 200, headers: {}, body: errorBody }
    : { statusCode: 200, headers: {}, body: { result: afterMessageIds.map((id) => ({ id, message_type: 'email_outgoing', subject: 'Invoice INV/2026/00001', partner_ids: messagePartnerIds, attachment_ids: messageAttachmentIds })) } };
  const notificationResponse = verificationErrors
    ? { statusCode: 200, headers: {}, body: errorBody }
    : { statusCode: 200, headers: {}, body: { result: notificationStatus ? [{ id: 101, notification_type: 'email', notification_status: notificationStatus, failure_type: failureReason ? 'mail_smtp' : false, failure_reason: failureReason, res_partner_id: [notificationPartnerId, 'New Customer'], mail_message_id: [11, 'Invoice'], mail_mail_id: mailState ? [201, 'Invoice'] : false }] : [] } };
  const mailResponse = verificationErrors
    ? { statusCode: 200, headers: {}, body: errorBody }
    : { statusCode: 200, headers: {}, body: { result: mailState ? [{ id: 201, state: mailState, failure_type: failureReason ? 'mail_smtp' : false, failure_reason: failureReason, email_to: emailTo, recipient_ids: recipientIds, mail_message_id: [11, 'Invoice'] }] : [] } };
  return [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    { statusCode: 200, headers: {}, body: { result: 501 } },
    { statusCode: 200, headers: {}, body: { result: true } },
    baselineError ? { statusCode: 200, headers: {}, body: errorBody } : { statusCode: 200, headers: {}, body: { result: beforeMessageIds } },
    { statusCode: 200, headers: {}, body: { result: 700 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 700, move_id: [501, 'INV/2026/00001'], sending_methods: wizardMethods, sending_method_checkboxes: { email: { checked: wizardMethods.includes('email'), label: 'Email' } }, mail_partner_ids: wizardPartnerIds, alerts: {} }] } },
    ...(wizardMethods.includes('email') && wizardPartnerIds.length > 0 ? [wizardSendResponse] : []),
    messageResponse,
    notificationResponse,
    mailResponse,
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', ref: 'INV-TEST', partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: invoicePdfReportId }] } },
    { statusCode: 200, headers: {}, body: { result: attachmentRecords } },
  ];
}

function odooEmailResumeResponses({ notificationStatus = 'sent', mailState = '', failureReason = '' } = {}) {
  return [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', partner_id: [88, 'New Customer'], invoice_pdf_report_id: [900, 'INV_2026_00001.pdf'] }] } },
    { statusCode: 200, headers: {}, body: { result: [10, 9] } },
    { statusCode: 200, headers: {}, body: { result: 701 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 701, move_id: [501, 'INV/2026/00001'], sending_methods: ['email'], sending_method_checkboxes: { email: { checked: true, label: 'Email' } }, mail_partner_ids: [88], alerts: {} }] } },
    { statusCode: 200, headers: {}, body: { result: { type: 'ir.actions.act_window_close' } } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 12, message_type: 'email_outgoing', subject: 'Invoice INV/2026/00001', partner_ids: [88], attachment_ids: [900] }] } },
    { statusCode: 200, headers: {}, body: { result: notificationStatus ? [{ id: 102, notification_type: 'email', notification_status: notificationStatus, failure_type: failureReason ? 'mail_smtp' : false, failure_reason: failureReason, res_partner_id: [88, 'New Customer'], mail_message_id: [12, 'Invoice'], mail_mail_id: mailState ? [202, 'Invoice'] : false }] : [] } },
    { statusCode: 200, headers: {}, body: { result: mailState ? [{ id: 202, state: mailState, failure_type: failureReason ? 'mail_smtp' : false, failure_reason: failureReason, email_to: 'new.customer@example.com', recipient_ids: [88], mail_message_id: [12, 'Invoice'] }] : [] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', ref: 'INV-TEST', partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: [900, 'INV_2026_00001.pdf'] }] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 900, name: 'INV_2026_00001.pdf', mimetype: 'application/pdf', res_model: 'account.move', res_id: 501, type: 'binary' }] } },
  ];
}

function odooPreflightResponses(majorVersion = 19, companyId = 1, companyName = 'Example Company') {
  const { odooCapabilityProfileByMajor } = load('shared/odoo/OdooCapabilityManifest.js');
  const profile = odooCapabilityProfileByMajor(majorVersion);
  assert.ok(profile);
  return [
    { result: { server_version: `${majorVersion}.0` } },
    { result: 7 },
    { result: [{ id: 2, name: 'USD', active: true }] },
    ...Object.values(profile.requiredFields).map((fields) => ({
      result: Object.fromEntries(fields.map((field) => [field, { type: 'char', readonly: false }])),
    })),
    ...profile.readProbeModels.map(() => ({ result: 0 })),
    { result: [{ id: 7, company_id: [companyId, companyName], company_ids: [companyId] }] },
    { result: [{ id: companyId, name: companyName, currency_id: [2, 'USD'] }] },
  ];
}



test('package registers exactly the frozen eight custom nodes', () => {
  assert.equal(pkg.name, 'n8n-nodes-invoicerouter');
  assert.equal(pkg.version, '2.1.1');
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
  assert.match(output, /n8n-nodes-invoicerouter@2\.1\.1/);
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
  assert.equal(result.managed[0][0].json.management.workflowState, 'PENDING');
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
  assert.equal(managed[0][0].json.management.workflowState, 'QUEUED');
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
  assert.ok(management.retryRequest);
  assert.equal(management.retryResume, null);
});


test('v2.0 master workflow keeps recipient rows provider-free', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows/InvoiceRouter-v2-master-universal.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(workflow.meta.invoiceRouterRelease, '2.1.1');
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
    { json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } },
  ]], { batchId: 'odoo-provider', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true });
  const result = await loadProviders.call(loaderContext);
  const provider = result[0][0].json.providers[0];
  assert.equal(provider.providerId, 'odoo');
  assert.equal(provider.authType, 'odoo-json-rpc');
  assert.equal(provider.connection.extraConfig.odooPostInvoice, false);
  assert.equal(provider.lifecycle.mode, 'draftOnly');
  assert.equal(JSON.stringify(result).includes('odoo-secret'), false);
});

test('Odoo request build no longer requires partner_id in email_list', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com' } }];
  const result = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' }, requestParams: { strictProviderValidation: true } });
  const request = result.built[0][0].json.readyRequest;
  assert.equal(request.providerId, 'odoo');
  assert.equal(request.recipient.name, 'New Customer');
  assert.equal(request.requestMapping.transportStrategy, 'odoo_auto_customer_invoice');
  assert.equal(request.requestMapping.lifecycleMode, 'draftOnly');
  assert.equal(result.built[0][0].json.requestBuild.providerValidationErrorCount, 0);
});

test('Invoice Sender executes Odoo auto customer then invoice sequence', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com', Address: '42 Test Lane' } }];
  const result = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES', liveModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, odooDraftResponses());
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 6);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 201);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.id, 501);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.name, 'INV/2026/00001');
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_id, 88);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_created, true);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'NOT_REQUESTED');
  const createCall = senderContext.calls.map(odooRpcCall).find((call) => call.model === 'account.move' && call.method === 'create');
  assert.ok(createCall);
  assert.equal(createCall.args[0].currency_id, 2);
  assert.match(createCall.args[0].ref, /^INV-/);
  assert.match(createCall.args[0].narration, /Reference/);
  assert.equal(JSON.stringify(sent).includes('odoo-secret'), false);
});

test('v2.0 VibProject structure and public template contract is present', () => {
  assert.ok(fs.existsSync(path.join(root, 'PROJECT_STRUCTURE.md')));
  assert.ok(fs.existsSync(path.join(root, 'vibproject.ygit')));
  assert.ok(fs.existsSync(path.join(root, 'docs/docs.minifest.ygit')));
  assert.ok(fs.existsSync(path.join(root, 'template/providers/odoo/provider.lifecycle.json')));
  assert.ok(fs.existsSync(path.join(root, 'config/providers/odoo.lifecycle.json')));
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^project\/$/m);
  assert.ok(pkg.files.includes('template'));
  assert.ok(pkg.files.includes('config'));
  assert.ok(pkg.files.includes('docs/docs.minifest.ygit'));
});

test('Provider Lifecycle metadata maps Odoo send-email mode', () => {
  const lifecycle = load('providers/ProviderLifecycle.js');
  const meta = lifecycle.lifecycleMetadata('odoo', { invoiceLifecycle: 'createPostAndSendEmail' });
  assert.equal(meta.mode, 'createPostAndSendEmail');
  assert.deepEqual(meta.steps, ['customer.resolve', 'customer.create_if_missing', 'invoice.create', 'invoice.post', 'invoice.send_email']);
  assert.equal(meta.capability.supportsInvoiceEmailSend, true);
});

test('Invoice Sender executes the Odoo send wizard and verifies sent mail evidence', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com', Address: '42 Test Lane' } }];
  const result = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([result.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', sandboxModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, odooEmailResponses());
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'action_send_and_print'), false);
  assert.ok(calls.some((call) => call.model === 'account.move.send.wizard' && call.method === 'create'));
  assert.ok(calls.some((call) => call.model === 'account.move.send.wizard' && call.method === 'action_send_and_print'));
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 201);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.name, 'INV/2026/00001');
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.pdf_attachment_id, 900);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.postStatus, 'POSTED');
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'SENT');
  assert.deepEqual(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailEvidence.notificationStatuses, ['sent']);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailEvidence.pdfEvidence.status, 'VALID');
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailEvidence.pdfEvidence.expectedReportBound, true);
  assert.deepEqual(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailEvidence.pdfEvidence.validPdfAttachmentIds, [900]);
  assert.equal(sent[0][0].json.rawExecution.responseBody.odoo.email_sent, true);
  assert.equal(JSON.stringify(sent).includes('odoo-secret'), false);
});

test('Invoice Sender reports Odoo queued email without claiming sent', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true,"odooEmailForceSend":false}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: 'ready', mailState: 'outgoing' }));
  const sent = await sendInvoice.call(senderContext);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 202);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'QUEUED');
  assert.equal(sent[0][0].json.rawExecution.responseBody.odoo.email_sent, false);
  assert.equal(sent[0][0].json.rawExecution.responseBody.odoo.email_queued, true);
});

test('Invoice Sender reports Odoo mail exception as failed', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: 'exception', mailState: 'exception', failureReason: 'SMTP connection failed.' }));
  const sent = await sendInvoice.call(senderContext);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 207);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'FAILED');
  assert.match(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailErrorMessage, /SMTP connection failed/);
});

test('Invoice Sender reports Odoo email as unverified when evidence cannot be read', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ verificationErrors: true }));
  const sent = await sendInvoice.call(senderContext);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 202);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'UNVERIFIED');
  assert.match(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailErrorMessage, /Access denied/);
});

test('Invoice Sender treats Odoo pending email notification as queued, not sent', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: 'pending' })));
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'QUEUED');
  assert.equal(sent[0][0].json.rawExecution.responseBody.odoo.email_sent, false);
});

test('Invoice Sender rejects stale historical Odoo sent evidence when no new mail message exists', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ afterMessageIds: [10], notificationStatus: 'sent', mailState: 'sent' })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'UNVERIFIED');
  assert.equal(lifecycle.emailEvidence.attemptEvidenceBound, false);
  assert.equal(lifecycle.emailEvidence.newMessageCount, 0);
  assert.match(lifecycle.emailErrorMessage, /Historical or other-recipient evidence was not accepted/);
});

test('Invoice Sender rejects Odoo sent evidence when the pre-send evidence baseline is unreadable', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ baselineError: true, notificationStatus: 'sent', mailState: 'sent' })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'UNVERIFIED');
  assert.equal(lifecycle.emailEvidence.baselineReadable, false);
  assert.equal(lifecycle.emailEvidence.attemptEvidenceBound, false);
  assert.match(lifecycle.emailErrorMessage, /Access denied/);
});

test('Invoice Sender blocks Odoo wizard execution when no email recipient is resolved', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ wizardPartnerIds: [], notificationStatus: '', mailState: '' }));
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'account.move.send.wizard' && call.method === 'action_send_and_print'), false);
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 207);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'FAILED');
  assert.match(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailErrorMessage, /did not resolve an email recipient/);
});


test('Status Checker treats queued Odoo email as partial and bulk sent remains zero', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true,"odooEmailForceSend":false}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: 'ready', mailState: 'outgoing' })));
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'PARTIAL_SUCCESS');
  assert.equal(checked[0][0].json.standardStatus.emailSendStatus, 'QUEUED');
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], { retryLimit: 3, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 900, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true }));
  const summary = managed[0][0].json.management.bulkSummary;
  assert.equal(managed[0][0].json.management.workflowState, 'PARTIAL');
  assert.equal(managed[0][0].json.management.retryScheduled, false);
  assert.equal(summary.sent, 0);
  assert.equal(summary.emailSent, 0);
  assert.equal(summary.emailQueued, 1);
  assert.equal(summary.partial, 1);
});

test('Odoo email failure creates send-only retry and resumes the existing invoice', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const firstSender = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: 'exception', mailState: 'exception', failureReason: 'SMTP connection temporarily unavailable' }));
  const firstSent = await sendInvoice.call(firstSender);
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([firstSent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'FAILED');
  assert.equal(checked[0][0].json.standardStatus.retryResumeStage, 'invoice.send_email');
  assert.equal(checked[0][0].json.standardStatus.errorType, 'EMAIL_SEND_ERROR');
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], { retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 1, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true }));
  const management = managed[0][0].json.management;
  assert.equal(management.retryScheduled, true);
  assert.equal(management.retryResume.stage, 'invoice.send_email');
  assert.equal(management.retryResume.providerInvoiceId, '501');
  assert.equal(management.retryRequest.lifecycleResume.approved, true);

  const resumeSender = context([[{ json: { ...managed[0][0].json, readyRequest: management.retryRequest, retryCount: management.retryCount } }]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, odooEmailResumeResponses());
  const resumed = await sendInvoice.call(resumeSender);
  const calls = resumeSender.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'res.partner' && ['search_read', 'create'].includes(call.method)), false);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'create'), false);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'action_post'), false);
  assert.equal(calls.some((call) => call.model === 'account.move.send.wizard' && call.method === 'action_send_and_print'), true);
  assert.equal(resumed[0][0].json.rawExecution.responseBody.result.id, 501);
  assert.equal(resumed[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'SENT');
  assert.equal(resumed[0][0].json.rawExecution.duplicatePrevention.resumeBypass, true);
});

test('Odoo post failure creates post-only retry and reuses the existing invoice', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createAndPost","odooPostInvoice":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'post.retry@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const firstSender = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    { statusCode: 200, headers: {}, body: { result: 501 } },
    { statusCode: 200, headers: {}, body: { error: { code: 100, message: 'Database is temporarily locked; try again.' } } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', ref: 'INV-TEST', partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: false }] } },
  ]);
  const firstSent = await sendInvoice.call(firstSender);
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([firstSent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'FAILED');
  assert.equal(checked[0][0].json.standardStatus.retryResumeStage, 'invoice.post');
  assert.equal(checked[0][0].json.standardStatus.errorType, 'INVOICE_POST_ERROR');
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], { retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 1, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true }));
  const management = managed[0][0].json.management;
  assert.equal(management.retryScheduled, true);
  assert.equal(management.retryResume.stage, 'invoice.post');
  assert.equal(management.retryResume.providerInvoiceId, '501');

  const resumeSender = context([[{ json: { ...managed[0][0].json, readyRequest: management.retryRequest, retryCount: management.retryCount } }]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', partner_id: [88, 'New Customer'], invoice_pdf_report_id: false }] } },
    { statusCode: 200, headers: {}, body: { result: true } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', ref: 'INV-TEST', partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: false }] } },
  ]);
  const resumed = await sendInvoice.call(resumeSender);
  const calls = resumeSender.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'res.partner' && ['search_read', 'create'].includes(call.method)), false);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'create'), false);
  assert.equal(calls.filter((call) => call.model === 'account.move' && call.method === 'action_post').length, 1);
  assert.equal(resumed[0][0].json.rawExecution.responseBody.result.id, 501);
  assert.equal(resumed[0][0].json.rawExecution.responseBody.result.lifecycle.postStatus, 'POSTED');
  assert.equal(resumed[0][0].json.rawExecution.duplicatePrevention.resumeBypass, true);
});

test('Unverified email is partial and never automatically retried', async () => {
  const item = {
    json: {
      readyRequest: { requestId: 'req-unverified', providerId: 'odoo' },
      rawExecution: {
        success: true, transportStatus: 'COMPLETED', requestId: 'req-unverified', providerId: 'odoo', httpStatus: 202,
        responseBody: { result: { id: 501, lifecycle: { invoiceStatus: 'CREATED', postStatus: 'POSTED', emailSendRequested: true, emailSendStatus: 'UNVERIFIED', emailErrorMessage: 'Evidence unavailable', lifecycleOutcome: 'PARTIAL', checkpoint: { providerInvoiceId: '501' } } } },
        responseHeaders: {}, responsePolicy: { successStatusCodes: [200, 201, 202] },
      },
    },
  };
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([[item]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'PARTIAL_SUCCESS');
  assert.equal(checked[0][0].json.standardStatus.errorType, 'EMAIL_UNVERIFIED');
  assert.equal(checked[0][0].json.standardStatus.retryDecision.safeToRetry, false);
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], { retryLimit: 3, retryBaseDelaySeconds: 1, cooldownSeconds: 1, alertOnFailure: true, includeEvents: true }));
  assert.equal(managed[0][0].json.management.workflowState, 'PARTIAL');
  assert.equal(managed[0][0].json.management.retryScheduled, false);
  assert.equal(managed[0][0].json.management.providerFeedback.recommendation, 'REVIEW');
});

test('v2 lifecycle fields are mapped end-to-end into status writeback columns', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const recipients = [{ json: { Email: 'new.customer@example.com', Address: '42 Test Lane' } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients, selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' }, requestParams: { strictProviderValidation: true } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', sandboxModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, odooEmailResponses());
  const sent = await sendInvoice.call(senderContext);
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], { retryLimit: 0, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 900, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true, includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 500, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId' }));
  const values = managed[0][0].json.management.statusWriteback.values;
  assert.equal(values.providerCustomerId, '88');
  assert.equal(values.customerStatus, 'CREATED');
  assert.equal(values.postStatus, 'POSTED');
  assert.equal(values.emailSendRequested, true);
  assert.equal(values.emailSendStatus, 'SENT');
  assert.equal(values.emailSendMethod, 'account.move.send.wizard.action_send_and_print');
  assert.equal(values.invoiceNumber, 'INV/2026/00001');
  assert.equal(values.lifecycleMode, 'createPostAndSendEmail');
  assert.match(values.lifecycleSteps, /invoice.send_email/);
  assert.equal(values.providerRecipeId, 'odoo');
  assert.equal(values.lifecycleOutcome, 'COMPLETED');
  assert.equal(values.lifecycleFailedStep, '');
  assert.equal(values.lifecycleCheckpoint.providerInvoiceId, '501');
  assert.ok(values.emailEvidence.messageIds.includes(11));
});

test('v2 workflows map lifecycle writeback fields to Google Sheets schema', () => {
  for (const file of ['InvoiceRouter-v1-production.json', 'InvoiceRouter-v1.6-simple-bulk-email.json', 'InvoiceRouter-v2-master-universal.json']) {
    const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows', file), 'utf8'));
    const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
    const code = byName['Prepare Status Writeback Row'].parameters.jsCode;
    const columns = byName['Google Sheets - Status Writeback'].parameters.columns;
    for (const field of ['provider_customer_id', 'customer_status', 'post_status', 'email_send_requested', 'email_send_status', 'email_send_method', 'email_error_message', 'email_evidence', 'lifecycle_outcome', 'lifecycle_failed_step', 'lifecycle_checkpoint', 'retry_resume_stage', 'retry_resume', 'lifecycle_mode', 'lifecycle_steps', 'provider_recipe_id']) {
      assert.match(code, new RegExp(`${field}:`));
      assert.equal(columns.value[field], `={{ $json.${field} }}`);
      assert.ok(columns.schema.some((entry) => entry.id === field), `${file} missing schema for ${field}`);
    }
    assert.match(byName['Prepare Retry Request'].parameters.jsCode, /management\.retryRequest/);
  }
});

test('false email request state remains false through status writeback and workflow row preparation', async () => {
  const result = await runPipeline({ dryRun: false, recipients: [{ json: { Email: 'create.only@example.com' } }] });
  const status = result.checked[0][0].json.standardStatus;
  const values = result.managed[0][0].json.management.statusWriteback.values;
  assert.equal(status.emailSendRequested, false);
  assert.equal(values.emailSendRequested, false);

  for (const file of ['InvoiceRouter-v1-production.json', 'InvoiceRouter-v1.6-simple-bulk-email.json', 'InvoiceRouter-v2-master-universal.json']) {
    const workflow = JSON.parse(fs.readFileSync(path.join(root, 'workflows', file), 'utf8'));
    const code = workflow.nodes.find((node) => node.name === 'Prepare Status Writeback Row').parameters.jsCode;
    assert.doesNotMatch(code, /String\(Boolean\(value\)\)/);
    const prepare = new Function('items', code);
    const [row] = prepare([{ json: { management: { statusWriteback: { values: { emailSendRequested: 'false', retryScheduled: false } } } } }]);
    assert.equal(row.json.email_send_requested, 'false');
    assert.equal(row.json.retry_scheduled, 'false');
  }
});

test('provider template packs expose canonical manifest and result headers', () => {
  const canonical = fs.readFileSync(path.join(root, 'template/status-writeback-columns.csv'), 'utf8').trim();
  for (const provider of ['odoo', 'stripe', 'zoho-books', 'quickbooks', 'generic-http']) {
    const base = path.join(root, 'template/providers', provider);
    const manifest = JSON.parse(fs.readFileSync(path.join(base, 'provider.template.ygit'), 'utf8'));
    assert.equal(manifest.providerId, provider);
    assert.equal(manifest.templateVersion, provider === 'odoo' ? '2.1.1' : '2.0.0');
    assert.equal(fs.readFileSync(path.join(base, 'invoice_results.csv'), 'utf8').trim(), canonical);
    assert.ok(fs.existsSync(path.join(base, manifest.files.lifecycleRecipe)));
  }
});

test('docs manifest has a default document and public section indexes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/docs.minifest.ygit'), 'utf8'));
  assert.ok(fs.existsSync(path.join(root, 'docs', manifest.documentation.defaultDocument)));
  for (const section of manifest.structure.sections) {
    assert.ok(fs.existsSync(path.join(root, 'docs', section.path, 'index.md')), `missing docs/${section.path}index.md`);
  }
});


test('Declarative provider recipe metadata marks executable recipe profiles', async () => {
  const recipe = {
    runtime: { type: 'declarative_http' },
    recipeId: 'custom-declarative-test',
    steps: [
      { id: 'invoice.create', lifecycleStep: 'invoice.create', request: { method: 'POST', url: '{{request.baseUrl}}/invoices', body: { email: '{{recipient.email}}' } }, responseMap: { providerInvoiceId: 'id' } },
    ],
  };
  const providers = [{ json: { Enabled: true, Provider: 'Custom', Account: 'Declarative', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://api.example.test', Endpoint: '/ignored', 'Auth Type': 'Bearer', 'API Key': 'token-value', 'Content-Type': 'application/json', 'Extra Config JSON': JSON.stringify({ invoiceLifecycle: 'createOnly', providerRecipe: recipe }), Timeout: 30 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'declarative@example.com', Name: 'Declarative User' } }], selectorParams: { providerFilter: 'custom', environmentFilter: 'live' } });
  const request = prepared.built[0][0].json.readyRequest;
  assert.equal(request.requestMapping.transportStrategy, 'declarative_provider_recipe');
  assert.equal(request.requestMapping.recipeExecutable, true);
  assert.equal(request.requestMapping.lifecycle.recipeReadiness.executable, true);
});

test('Invoice Sender executes a declarative HTTP provider recipe', async () => {
  const recipe = {
    runtime: { type: 'declarative_http' },
    recipeId: 'custom-declarative-send-test',
    steps: [
      { id: 'invoice.create', lifecycleStep: 'invoice.create', request: { method: 'POST', url: '{{request.baseUrl}}/invoices', headers: { Authorization: 'Bearer {{API_KEY}}' }, body: { email: '{{recipient.email}}', amount: '{{invoice.totals.grandTotal}}' } }, responseMap: { providerInvoiceId: 'id', invoiceStatus: 'status' } },
      { id: 'invoice.send_email', lifecycleStep: 'invoice.send_email', onlyWhenLifecycleIncludes: 'invoice.send_email', request: { method: 'POST', url: '{{request.baseUrl}}/invoices/{{facts.providerInvoiceId}}/send', headers: { Authorization: 'Bearer {{API_KEY}}' }, body: { recipient: '{{recipient.email}}' } }, responseMap: { emailSendStatus: 'status' } },
    ],
  };
  const providers = [{ json: { Enabled: true, Provider: 'Custom', Account: 'Declarative', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://api.example.test', Endpoint: '/ignored', 'Auth Type': 'Bearer', 'API Key': 'token-value', 'Content-Type': 'application/json', 'Extra Config JSON': JSON.stringify({ invoiceLifecycle: 'createPostAndSendEmail', providerRecipe: recipe }), Timeout: 30 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'send@example.com', Name: 'Send User' } }], selectorParams: { providerFilter: 'custom', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', sandboxModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 201, headers: {}, body: { id: 'inv_decl_001', status: 'created' } },
    { statusCode: 202, headers: {}, body: { status: 'sent' } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  assert.equal(senderContext.calls.length, 2);
  assert.equal(senderContext.calls[0].url, 'https://api.example.test/invoices');
  assert.equal(senderContext.calls[1].url, 'https://api.example.test/invoices/inv_decl_001/send');
  assert.equal(sent[0][0].json.rawExecution.httpStatus, 202);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.id, 'inv_decl_001');
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'SENT');
  assert.equal(JSON.stringify(sent).includes('token-value'), false);
});


test('Declarative HTTP 202 without explicit sent evidence remains queued', async () => {
  const recipe = {
    runtime: { type: 'declarative_http' }, recipeId: 'custom-declarative-queued-test',
    steps: [
      { id: 'invoice.create', lifecycleStep: 'invoice.create', request: { method: 'POST', url: '{{request.baseUrl}}/invoices' }, responseMap: { providerInvoiceId: 'id' } },
      { id: 'invoice.send_email', lifecycleStep: 'invoice.send_email', onlyWhenLifecycleIncludes: 'invoice.send_email', request: { method: 'POST', url: '{{request.baseUrl}}/invoices/{{facts.providerInvoiceId}}/send' } },
    ],
  };
  const providers = [{ json: { Enabled: true, Provider: 'Custom', Account: 'Declarative', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://api.example.test', Endpoint: '/ignored', 'Auth Type': 'Bearer', 'API Key': 'token-value', 'Content-Type': 'application/json', 'Extra Config JSON': JSON.stringify({ invoiceLifecycle: 'createPostAndSendEmail', providerRecipe: recipe }), Timeout: 30 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'queue@example.com' } }], selectorParams: { providerFilter: 'custom', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, [
    { statusCode: 201, headers: {}, body: { id: 'inv_queue_001' } },
    { statusCode: 202, headers: {}, body: { accepted: true } },
  ]));
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'QUEUED');
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.result, 'PARTIAL_SUCCESS');
  assert.equal(checked[0][0].json.standardStatus.retryDecision.retryable, false);
});

test('generic HTTP declarative example recipe validates as executable template support', () => {
  const recipe = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/generic-http/generic-http.declarative-example.json'), 'utf8'));
  assert.equal(recipe.runtime.type, 'declarative_http');
  assert.ok(recipe.steps.some((step) => step.id === 'invoice.send_email'));
  assert.ok(recipe.steps[0].responseMap.providerInvoiceId);
});

test('Delta 03 documentation defines truthful Odoo email evidence and safe retry resume', () => {
  const evidence = fs.readFileSync(path.join(root, 'docs/developer/odoo-email-evidence-contract.md'), 'utf8');
  const retry = fs.readFileSync(path.join(root, 'docs/developer/lifecycle-retry-resume.md'), 'utf8');
  for (const text of ['account.move.send.wizard', '`QUEUED`', '`SENT`', '`FAILED`', '`UNVERIFIED`']) assert.match(evidence, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidence, /not proof that the message reached the recipient inbox/i);
  assert.match(retry, /invoice\.post/);
  assert.match(retry, /invoice\.send_email/);
  assert.match(retry, /EMAIL_UNVERIFIED/);
});

test('public templates use reserved sample email addresses', () => {
  const consumer = /[A-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|protonmail|proton)\.[A-Z]{2,}/gi;
  const extensions = new Set(['.csv', '.json', '.md', '.txt', '.yml', '.yaml']);
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  };
  walk(path.join(root, 'template'));
  walk(path.join(root, 'examples'));
  for (const file of files) assert.equal(consumer.test(fs.readFileSync(file, 'utf8')), false, `${path.relative(root, file)} contains consumer-webmail sample data`);
  assert.match(fs.readFileSync(path.join(root, 'template/providers/odoo/email_list.csv'), 'utf8'), /customer@example\.com/);
});

test('all packaged workflow JSON files avoid malformed n8n expressions', () => {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json') && /workflow|N8N_IMPORT/i.test(full)) files.push(full);
    }
  };
  walk(path.join(root, 'workflows'));
  walk(path.join(root, 'template/providers'));
  assert.ok(files.length >= 20);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotThrow(() => JSON.parse(source), path.relative(root, file));
    assert.doesNotMatch(source, /=\{(?!\{)\s*\$/, `${path.relative(root, file)} has malformed expression syntax`);
  }
});

test('Odoo lifecycle template documents evidence states and additive writeback fields', () => {
  const lifecycle = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/provider.lifecycle.json'), 'utf8'));
  assert.equal(lifecycle.runtime.emailSendModel, 'account.move.send.wizard');
  assert.equal(lifecycle.runtime.emailSendMethod, 'action_send_and_print');
  for (const status of ['QUEUED', 'SENT', 'FAILED', 'UNVERIFIED']) assert.ok(lifecycle.emailStatusContract[status]);
  for (const field of ['email_evidence', 'lifecycle_outcome', 'lifecycle_failed_step', 'lifecycle_checkpoint', 'retry_resume_stage', 'retry_resume']) assert.ok(lifecycle.writebackFields.includes(field));
  assert.equal(JSON.stringify(lifecycle), JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/provider.recipe.json'), 'utf8'))));
});

test('release workflow bundles v2 master, Odoo modes, synchronized docs, and release-source audit', () => {
  const release = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  for (const fragment of [
    'workflows/InvoiceRouter-v2-master-universal.json',
    'workflows/InvoiceRouter-v1-production.json',
    'workflows/InvoiceRouter-v1.6-simple-bulk-email.json',
    'template/providers/odoo/.',
    'template/status-writeback-columns.csv',
    'docs/developer',
    'docs/troubleshooting',
    'node scripts/audit-release-source.mjs release/bundle',
    'BUNDLE_CONTENTS.txt',
  ]) assert.match(release, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release documentation enforces forensic audit before publish and community update before live canary', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const checklist = fs.readFileSync(path.join(root, 'template/providers/odoo/LIVE_TEST_CHECKLIST.md'), 'utf8');
  assert.match(readme, /Audit the complete final project ZIP/i);
  assert.match(readme, /Update the package through n8n Community Nodes/i);
  assert.match(checklist, /complete project ZIP has passed final forensic audit/i);
  assert.match(checklist, /n8n Community Nodes shows the approved InvoiceRouter update/i);
  assert.match(checklist, /one controlled recipient only/i);
});

test('v2.1.1 final release metadata and npm package contents stay synchronized', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const vibProject = JSON.parse(fs.readFileSync(path.join(root, 'vibproject.ygit'), 'utf8'));
  const docsManifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/docs.minifest.ygit'), 'utf8'));
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const releaseWorkflow = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');

  assert.equal(pkg.version, '2.1.1');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(vibProject.project.version, pkg.version);
  assert.equal(vibProject.release.latestVersion, pkg.version);
  assert.equal(docsManifest.versions.current, pkg.version);
  assert.equal(docsManifest.versions.latest, pkg.version);
  assert.ok(docsManifest.versions.available.includes(pkg.version));
  assert.match(readme, /Package version:\*\* `2\.1\.1`/);
  assert.match(changelog, /## 2\.1\.1 - 2026-08-03/);
  assert.ok(pkg.files.includes('docs/troubleshooting'));
  assert.match(releaseWorkflow, /Validate tag version/);
  assert.match(releaseWorkflow, /npm publish --access public --provenance/);

  for (const provider of ['odoo', 'stripe', 'zoho-books']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, `template/providers/${provider}/provider.template.ygit`), 'utf8'));
    assert.equal(manifest.invoiceRouterVersion, pkg.version);
  }
});

test('v2.1 Email List custom fixed name and stable job identity are additive', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const rows = [{ json: { Email: 'fixed.name@example.com', status: '', Name: 'Ignored Name', Campaign_ID: 'campaign-001' } }];
  const params = {
    batchId: 'odoo-production-pool', emailField: 'Email', nameField: 'Name', addressField: 'Address', statusField: 'status',
    jobIdField: 'Job_ID', campaignIdField: 'Campaign_ID', defaultCampaignId: 'default-campaign',
    nameGeneration: 'customFixed', fixedCustomerName: 'Valued Customer', invalidPolicy: 'error', preserveCustomColumns: false, preventReuse: false,
  };
  const first = await loadEmails.call(context([rows], params));
  const second = await loadEmails.call(context([rows], params));
  assert.equal(first[0][0].json.recipient.name, 'Valued Customer');
  assert.equal(first[0][0].json.job.status, 'PENDING');
  assert.equal(first[0][0].json.job.campaignId, 'campaign-001');
  assert.match(first[0][0].json.job.jobId, /^JOB-/);
  assert.equal(first[0][0].json.job.jobId, second[0][0].json.job.jobId);
});

test('v2.1 Email List blocks blank fixed customer name', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  await assert.rejects(() => loadEmails.call(context([[{ json: { Email: 'customer@example.com' } }]], {
    batchId: 'fixed-name-error', nameGeneration: 'customFixed', fixedCustomerName: '', preventReuse: false,
  })), /Fixed Customer Name is required/);
});

test('v2.1 Provider Loader reads failover group and managed account status', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Primary Odoo', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://example.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'secret', Database: 'example', Failover_Group: 'company-a', Issuer_Key: 'example-company', status: 'READY', Total_Sent: 12,
  } }];
  const loaded = await loadProviders.call(context([rows], { batchId: 'provider-status', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true, enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport' }, odooPreflightResponses(19, 1, 'Example Company')));
  const profile = loaded[0][0].json.providers[0];
  assert.equal(profile.failoverGroup, 'company-a');
  assert.equal(profile.managedStatus, 'READY');
  assert.equal(profile.totalSent, 12);
});

test('v2.1 Provider Selector excludes attempted account during failover', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const providerInput = ['Account A', 'Account B'].map((account) => ({ json: {
    Enabled: true, Provider: 'Custom', Account: account, Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://api.example.test', Endpoint: '/invoices', 'Auth Type': 'Bearer', 'API Key': 'secret-token',
    Failover_Group: 'company-a', status: 'READY',
  } }));
  const loaderContext = context([providerInput], { batchId: 'selector-failover', __executionId: 'exec-selector', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true });
  const loaded = await loadProviders.call(loaderContext);
  const attempted = loaded[0][0].json.providers[0].id;
  const work = [{ json: { recipient: { email: 'customer@example.com' }, runtime: loaded[0][0].json.runtime, failoverState: { failoverGroup: 'company-a', attemptedProfileIds: [attempted] }, job: { jobId: 'JOB-1' } } }];
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selected = await selectProvider.call(context([loaded[0], work], {
    strategy: 'firstAvailable', processingMode: 'sequential', providerFilter: 'custom', actionFilter: 'create-invoice', environmentFilter: 'live',
    queueWhenUnavailable: true, conditionalRouting: false, routingRulesJson: '[]', requireConditionalMatch: false, unmatchedRouteBehavior: 'block',
    lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5, __executionId: 'exec-selector',
  }));
  assert.notEqual(selected[0][0].json.providerAllocation.id, attempted);
  assert.equal(selected[0][0].json.providerAllocation.accountName, 'Account B');
});

test('v2.1 campaignJob idempotency remains stable across pre-side-effect account failover', async () => {
  const makeProvider = (account) => [{ json: {
    Enabled: true, Provider: 'Custom', Account: account, Environment: 'Live', Action: 'Custom Request', Method: 'POST',
    'Base URL': 'https://api.example.test', Endpoint: '/invoices', 'Auth Type': 'Bearer', 'API Key': 'secret-token',
    'Header Name': 'Authorization', 'Header Value': 'Bearer {{API_KEY}}', Failover_Group: 'company-a',
  } }];
  const recipients = [{ json: { Email: 'stable@example.com', Campaign_ID: 'campaign-stable' } }];
  const first = await runPipeline({ providers: makeProvider('Account A'), recipients, requestParams: { idempotencyKeyMode: 'campaignJob' } });
  const second = await runPipeline({ providers: makeProvider('Account B'), recipients, requestParams: { idempotencyKeyMode: 'campaignJob' } });
  assert.equal(first.built[0][0].json.readyRequest.idempotency.value, second.built[0][0].json.readyRequest.idempotency.value);
  assert.notEqual(first.built[0][0].json.readyRequest.profileId, second.built[0][0].json.readyRequest.profileId);
});

test('v2.1 Status Checker classifies invalid Odoo database as non-retryable configuration', async () => {
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const item = { json: {
    readyRequest: { requestId: 'REQ-DB', providerId: 'odoo', profileId: 'odoo-a', accountId: 'a', recipient: { email: 'customer@example.com' } },
    rawExecution: { requestId: 'REQ-DB', providerId: 'odoo', profileId: 'odoo-a', accountId: 'a', transportStatus: 'ERROR', httpStatus: 0,
      error: { message: 'FATAL: database "missing" does not exist' }, responseBody: null, responseHeaders: {}, latencyMs: 10, responseSizeBytes: 0 },
  } };
  const checked = await checkStatus.call(context([[item]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const status = checked[0][0].json.standardStatus;
  assert.equal(status.errorType, 'CONFIGURATION_ERROR');
  assert.equal(status.retryDecision.retryable, false);
  assert.equal(status.canFailover, false);
});

test('v2.1 Status Manager emits hard-account failover and provider disable writebacks before side effects', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const item = { json: {
    job: { jobId: 'JOB-AUTH', campaignId: 'campaign-a', attemptCount: 0 },
    recipient: { email: 'customer@example.com' }, invoiceTemplate: { invoiceId: '#INV#' },
    readyRequest: { failoverGroup: 'company-a', job: { jobId: 'JOB-AUTH', campaignId: 'campaign-a' } },
    standardStatus: { requestId: 'REQ-AUTH', providerId: 'odoo', profileId: 'odoo-account-a', accountId: 'account-a', accountName: 'Account A',
      recipientEmail: 'customer@example.com', result: 'ERROR', transportStatus: 'ERROR', invoiceStatus: 'FAILED', errorType: 'AUTHENTICATION_ERROR',
      errorCategory: 'authentication', errorMessage: 'Invalid credentials', httpStatus: 401, sideEffectStage: 'none', providerInvoiceId: '',
      retryDecision: { retryable: false, safeToRetry: false, source: 'test', reason: 'auth failed', sideEffectStage: 'none' }, runtime: { scopeKey: 'workflow-test:account-failover' } },
  } };
  const managed = await manageStatus.call(context([[item]], { retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true,
    cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true, includeExecutionLog: true,
    persistExecutionLog: false, executionLogRetention: 50, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId' }));
  const management = managed[0][0].json.management;
  assert.equal(management.failoverScheduled, true);
  assert.equal(management.retryScheduled, false);
  assert.equal(management.providerStatusWriteback.values.Enabled, false);
  assert.equal(management.providerStatusWriteback.values.status, 'AUTH_FAILED');
  assert.equal(management.recipientStatusWriteback.values.status, 'FAILOVER');
  assert.equal(management.retryQueueWriteback.values.Queue_Status, 'FAILOVER_READY');
  assert.ok(management.failoverRequest);
});

test('v2.1 canonical Odoo production workflow uses one-item loop and managed Sheet writebacks', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(workflow.meta.invoiceRouterRelease, '2.1.1');
  assert.equal(workflow.name, 'InvoiceRouter Odoo Production Bulk v2.1.1');
  assert.equal(byName['Loop Over Recipient Jobs'].parameters.batchSize, 1);
  assert.equal(byName['Provider Loader'].parameters.batchId, 'odoo-production-pool');
  assert.equal(byName['Request Builder'].parameters.idempotencyKeyMode, 'campaignJob');
  assert.equal(byName['Status Manager'].parameters.retryLimit, 3);
  for (const name of ['Google Sheets - Recipient Status', 'Google Sheets - Provider Status', 'Google Sheets - Retry Queue', 'Google Sheets - Account Report', 'Google Sheets - Campaign Report']) assert.ok(byName[name]);
  assert.deepEqual(workflow.connections['Finalize Current Job'].main[0].map((entry) => entry.node), ['Loop Over Recipient Jobs']);
  assert.deepEqual(workflow.connections['Wait Before Failover'].main[0].map((entry) => entry.node), ['Google Sheets - Failover Provider Accounts']);
});

test('v2.1 Odoo workbook CSV contract includes recipient, provider, queue, and report schemas', () => {
  const emailHeader = fs.readFileSync(path.join(root, 'template/providers/odoo/email_list.csv'), 'utf8').split(/\r?\n/)[0];
  const providerHeader = fs.readFileSync(path.join(root, 'template/providers/odoo/provider.csv'), 'utf8').split(/\r?\n/)[0];
  assert.equal(emailHeader.split(',').slice(0, 4).join(','), 'Email,status,Name,Address');
  for (const field of ['Job_ID', 'Campaign_ID', 'Attempt_Count', 'Last_Account', 'Last_Error']) assert.match(emailHeader, new RegExp(field));
  for (const field of ['Failover_Group', 'Issuer_Key', 'Company_ID', 'Company_Name', 'Odoo_Server_Version', 'Odoo_Major_Version', 'Capability_Status', 'Issuer_Compatibility', 'status', 'Auto_Disabled', 'Cooldown_Until', 'Total_Sent']) assert.match(providerHeader, new RegExp(field));
  for (const file of ['retry_queue.csv', 'account_report.csv', 'campaign_report.csv']) assert.ok(fs.existsSync(path.join(root, 'template/providers/odoo', file)));
});

test('v2.1.1 Odoo read-only preflight authenticates, checks currency and externally callable capabilities, and keeps secrets redacted', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Preflight Good', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://good.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'very-secret-password', Database: 'good', Failover_Group: 'company-a', Issuer_Key: 'example-company', status: 'READY',
  } }];
  const responses = odooPreflightResponses(19, 1, 'Example Company');
  const ctx = context([rows], {
    batchId: 'preflight-good', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, responses);
  const loaded = await loadProviders.call(ctx);
  assert.equal(ctx.calls.length, 18);
  const rpcCalls = ctx.calls.map(odooRpcCall);
  assert.equal(rpcCalls.some((call) => call.method === 'check_access_rights'), false);
  assert.equal(rpcCalls.filter((call) => call.method === 'fields_get').length, 11);
  assert.equal(rpcCalls.filter((call) => call.method === 'search_count').length, 2);
  assert.equal(loaded[0][0].json.total, 1);
  assert.equal(loaded[0][0].json.preflightResults[0].status, 'READY');
  assert.equal(loaded[0][0].json.preflightResults[0].passed, true);
  assert.equal(loaded[0][0].json.preflightResults[0].Odoo_Major_Version, 19);
  assert.equal(loaded[0][0].json.preflightResults[0].Company_Name, 'Example Company');
  assert.equal(loaded[0][0].json.preflightResults[0].Issuer_Compatibility, 'VERIFIED');
  assert.doesNotMatch(JSON.stringify(loaded), /very-secret-password/);
});

test('v2.1 Odoo preflight excludes currency-incompatible account without permanently disabling it', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Missing USD', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://currency.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'secret', Database: 'currency', Failover_Group: 'company-a', status: 'READY',
  } }];
  const loaded = await loadProviders.call(context([rows], {
    batchId: 'preflight-currency', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, [{ result: { server_version: '19.0' } }, { result: 7 }, { result: [] }]));
  assert.equal(loaded[0][0].json.total, 0);
  assert.equal(loaded[0][0].json.preflightResults[0].status, 'CURRENCY_INCOMPATIBLE');
  assert.equal(loaded[0][0].json.preflightResults[0].Enabled, true);
  assert.equal(loaded[0][0].json.preflightResults[0].Auto_Disabled, false);
});

test('v2.1 Odoo preflight marks invalid database as evidence-based auto-disable', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Invalid DB', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://invalid.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'secret', Database: 'missing', Failover_Group: 'company-a', status: 'READY',
  } }];
  const loaded = await loadProviders.call(context([rows], {
    batchId: 'preflight-db', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, [{ result: { server_version: '19.0' } }, { error: { message: 'Odoo Server Error', data: { message: 'database "missing" does not exist' } } }]));
  const result = loaded[0][0].json.preflightResults[0];
  assert.equal(loaded[0][0].json.total, 0);
  assert.equal(result.status, 'DATABASE_INVALID');
  assert.equal(result.Enabled, false);
  assert.equal(result.Auto_Disabled, true);
});

test('v2.1 Email List skips terminal recipient rows and preserves durable retry state', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const rows = [
    { json: { Email: 'sent@example.com', status: 'SENT', Job_ID: 'JOB-SENT', Campaign_ID: 'campaign-durable' } },
    { json: { Email: 'retry@example.com', status: 'RETRYING', Job_ID: 'JOB-RETRY', Campaign_ID: 'campaign-durable', Attempt_Count: 2,
      invoiceRouterState: { retryCount: 2, failoverState: { requiredProfileId: 'profile-a' }, lifecycleResume: { source: 'status-manager', stage: 'invoice.send_email' } } } },
  ];
  const loaded = await loadEmails.call(context([rows], {
    batchId: 'durable-email-state', statusField: 'status', jobIdField: 'Job_ID', campaignIdField: 'Campaign_ID',
    nameGeneration: 'formatted', invalidPolicy: 'error', preserveCustomColumns: true, preventReuse: false,
  }));
  assert.equal(loaded[0].length, 1);
  assert.equal(loaded[0][0].json.job.jobId, 'JOB-RETRY');
  assert.equal(loaded[0][0].json.retryCount, 2);
  assert.equal(loaded[0][0].json.failoverState.requiredProfileId, 'profile-a');
  assert.equal(loaded[0][0].json.lifecycleResume.stage, 'invoice.send_email');
  assert.ok(loaded[0][0].json.skippedRecipients.some((row) => row.email === 'sent@example.com'));
});

test('v2.1 Provider Selector required profile keeps post/send resume on the original account', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = ['Account A', 'Account B'].map((account) => ({ json: {
    Enabled: true, Provider: 'Custom', Account: account, Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://api.example.test', Endpoint: '/invoices', 'Auth Type': 'Bearer', 'API Key': 'secret-token',
    Failover_Group: 'company-a', status: 'READY',
  } }));
  const loaded = await loadProviders.call(context([rows], {
    batchId: 'required-profile', __executionId: 'required-profile-exec', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
  }));
  const required = loaded[0][0].json.providers[0].id;
  const work = [{ json: {
    recipient: { email: 'resume@example.com' }, runtime: loaded[0][0].json.runtime,
    failoverState: { failoverGroup: 'company-a', attemptedProfileIds: [required], requiredProfileId: required },
    lifecycleResume: { source: 'status-manager', stage: 'invoice.send_email', providerInvoiceId: '501' },
    job: { jobId: 'JOB-RESUME' },
  } }];
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selected = await selectProvider.call(context([loaded[0], work], {
    strategy: 'firstAvailable', processingMode: 'sequential', providerFilter: 'custom', actionFilter: 'create-invoice', environmentFilter: 'live',
    queueWhenUnavailable: true, conditionalRouting: false, routingRulesJson: '[]', requireConditionalMatch: false,
    unmatchedRouteBehavior: 'block', lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
    __executionId: 'required-profile-exec',
  }));
  assert.equal(selected[0][0].json.providerAllocation.id, required);
  assert.equal(selected[0][0].json.providerAllocation.accountName, 'Account A');
});

test('v2.1 retry exhaustion schedules a fresh-account failover only before provider side effects', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const item = { json: {
    retryCount: 3,
    job: { jobId: 'JOB-EXHAUST', campaignId: 'campaign-exhaust', attemptCount: 3 },
    recipient: { email: 'exhaust@example.com' },
    readyRequest: { failoverGroup: 'company-a', job: { jobId: 'JOB-EXHAUST', campaignId: 'campaign-exhaust' } },
    failoverState: { failoverGroup: 'company-a', originalProfileId: 'profile-a', currentProfileId: 'profile-a', attemptedProfileIds: ['profile-a'], failoverCount: 0 },
    standardStatus: {
      requestId: 'REQ-EXHAUST', providerId: 'odoo', profileId: 'profile-a', accountId: 'account-a', accountName: 'Account A',
      recipientEmail: 'exhaust@example.com', result: 'ERROR', transportStatus: 'ERROR', invoiceStatus: 'FAILED', errorType: 'NETWORK_ERROR',
      errorCategory: 'transport', errorMessage: 'Connection reset before provider response', httpStatus: 0, sideEffectStage: 'none', providerInvoiceId: '',
      retryDecision: { retryable: true, safeToRetry: true, source: 'transport', reason: 'pre-side-effect connection reset', sideEffectStage: 'none' },
      runtime: { scopeKey: 'workflow-test:retry-exhaustion' },
    },
  } };
  const managed = await manageStatus.call(context([[item]], {
    retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 30,
    disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true, includeExecutionLog: true, persistExecutionLog: false,
    executionLogRetention: 50, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId',
  }));
  const management = managed[0][0].json.management;
  assert.equal(management.retryScheduled, false);
  assert.equal(management.failoverScheduled, true);
  assert.equal(management.failoverRequest.retryCount, 0);
  assert.equal(management.failoverRequest.failoverState.requiredProfileId, '');
  assert.deepEqual(management.failoverRequest.failoverState.attemptedProfileIds, ['profile-a']);
});

test('v2.1 account report aggregates by campaign and profile', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const makeItem = (requestId, email) => ({ json: {
    job: { jobId: `JOB-${requestId}`, campaignId: 'campaign-aggregate', attemptCount: 0, accountReportSeed: {} },
    recipient: { email }, readyRequest: { failoverGroup: 'company-a' },
    standardStatus: {
      requestId, providerId: 'odoo', profileId: 'profile-aggregate', accountId: 'account-a', accountName: 'Account A',
      recipientEmail: email, result: 'SUCCESS', transportStatus: 'COMPLETED', invoiceStatus: 'SENT', providerInvoiceId: `INV-${requestId}`,
      emailSendRequested: true, emailSendStatus: 'SENT', errorType: '', errorCategory: '', errorMessage: '', httpStatus: 200,
      sideEffectStage: 'email.sent', retryDecision: { retryable: false, safeToRetry: false, source: 'success' },
      runtime: { scopeKey: 'workflow-test:aggregate-scope' },
    },
  } });
  const params = { retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 30,
    disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true, includeExecutionLog: true, persistExecutionLog: false,
    executionLogRetention: 50, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId' };
  const first = await manageStatus.call(context([[makeItem('ONE', 'one@example.com')]], params));
  const second = await manageStatus.call(context([[makeItem('TWO', 'two@example.com')]], params));
  assert.equal(first[0][0].json.management.accountReportEvent.Allocated, 1);
  assert.equal(second[0][0].json.management.accountReportEvent.Allocated, 2);
  assert.equal(second[0][0].json.management.accountReportEvent.Email_Sent, 2);
  assert.equal(second[0][0].json.management.accountReportEvent.Succeeded, 2);
});

test('v2.1 canonical Odoo workflow includes preflight, durable readback, provider attachment, processing state, and writeback-only retries', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(byName['Provider Loader'].parameters.enableOdooPreflight, true);
  assert.equal(byName['Provider Loader'].parameters.preflightCurrency, '');
  for (const name of ['Google Sheets - Retry Queue Input','Google Sheets - Account Report Input','Build Durable Work Items','Attach Provider Library','Prepare Processing Status','Google Sheets - Recipient Processing']) assert.ok(byName[name], name);
  for (const name of ['Google Sheets - Status Writeback','Google Sheets - Recipient Status','Google Sheets - Provider Status','Google Sheets - Retry Queue','Google Sheets - Account Report','Google Sheets - Campaign Report','Google Sheets - Recipient Processing','Google Sheets - Preflight Provider Status']) {
    assert.equal(byName[name].retryOnFail, true, `${name} retryOnFail`);
    assert.equal(byName[name].maxTries, 3, `${name} maxTries`);
    assert.equal(byName[name].waitBetweenTries, 2000, `${name} waitBetweenTries`);
  }
  const source = JSON.stringify(workflow);
  assert.doesNotMatch(source, /Per-account Max RPM|Per-account Daily Limit|Max_Concurrent/i);
});

test('v2.1 Apps Script repairs the complete managed workbook without destructive replacement', () => {
  const script = fs.readFileSync(path.join(root, 'template/providers/odoo/google-sheets/auto-fix-invoice-results-headers.gs'), 'utf8');
  assert.match(script, /function fixInvoiceRouterV210Workbook\(/);
  for (const tab of ['provider','email_list','invoice_results','retry_queue','account_report','campaign_report']) assert.ok(script.includes(`\"${tab}\":`), tab);
  assert.match(script, /setValues\(\[missing\]\)/);
  assert.doesNotMatch(script, /deleteSheet|clearContents|clear\(/);
});

test('v2.1 Odoo templates do not advertise unsupported per-message email body override', () => {
  const extensions = new Set(['.csv','.json','.md','.ygit','.gs']);
  const directory = path.join(root, 'template/providers/odoo');
  const files = fs.readdirSync(directory).filter((name) => extensions.has(path.extname(name).toLowerCase()));
  for (const file of files) assert.doesNotMatch(fs.readFileSync(path.join(directory, file), 'utf8'), /odooEmailBody/);
});

function realN8nInputContext(inputs, parameters = {}, responses = []) {
  const ctx = context(inputs, parameters, responses);
  ctx.getInputData = function getInputData(index = 0) {
    if (!Object.prototype.hasOwnProperty.call(inputs, index) || inputs[index] === undefined) {
      throw new Error('Could not get input with given index');
    }
    return inputs[index];
  };
  return ctx;
}

async function embeddedOdooBuildItem({ profileId = 'odoo-account-a-live-create-invoice', accountId = 'account-a', accountName = 'Account A', failoverGroup = 'company-a', campaignId = 'campaign-v211', jobId = 'JOB-V211' } = {}) {
  const { execute: createTemplate } = load('nodes/03_InvoiceTemplate/InvoiceTemplate.execute.js');
  const template = await createTemplate.call(context([[{ json: {} }]], {
    templateMode: 'manual', invoiceId: '#INV#', invoiceNumber: 'INV-#INV#', invoiceDate: '2026-08-03', dueDate: '2026-09-02', currency: 'USD',
    lineItemsJson: '[{"name":"Service","description":"Work for #NAME#","quantity":1,"unit_price":100,"discount":0}]', tax: 0, discount: 0, shipping: 0,
    paymentTerms: 'Net 30', notes: 'Reference #TRX#', customFieldsJson: '{}', strictValidation: true,
  }));
  return {
    json: {
      recipient: { email: 'v211@example.com', name: 'V211 Customer', address: '' },
      job: { jobId, campaignId, status: 'PENDING', attemptCount: 0, campaignSafety: { enabled: false, totalItems: 1, maxItems: 1, maxFailures: 1, delayBetweenSendsMs: 0, stopOnCriticalError: true } },
      invoiceTemplate: template[0][0].json.invoiceTemplate,
      providerAllocation: {
        status: 'ALLOCATED', providerId: 'odoo', providerName: 'Odoo', id: profileId, profileId,
        accountId, accountName, actionId: 'create-invoice', actionName: 'Create Invoice', environment: 'live',
        method: 'POST', baseUrl: 'https://example.odoo.com', endpoint: '/jsonrpc', authType: 'odoo-json-rpc',
        credentialRef: `workflow-test:${profileId}`, failoverGroup, scopeKey: 'workflow-test:embedded-v211', timeoutMs: 60000,
        routing: { enabled: false }, preflightCapabilities: { supported: true, majorVersion: 19, profileId: 'odoo-19-invoice-send' },
        issuerKey: 'example-company', companyId: 1, companyName: 'Example Company', issuerCompatibility: { status: 'VERIFIED', compatible: true },
        runtime: { lock: { workerId: jobId } },
      },
      failoverState: { failoverGroup, originalProfileId: profileId, currentProfileId: profileId, attemptedProfileIds: [profileId], requiredProfileId: profileId, queueStatus: 'PENDING', sideEffectStage: 'none' },
      retryCount: 0,
      runtime: { scopeKey: 'workflow-test:embedded-v211', executionId: 'exec-v211' },
    },
  };
}

test('v2.1.1 Request Builder supports the canonical single embedded input under real n8n missing-index behavior', async () => {
  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const embedded = await embeddedOdooBuildItem();
  const built = await buildRequest.call(realN8nInputContext([[embedded]], {
    strictProviderWarnings: false, strictProviderValidation: true, sendGuardMode: 'strict', customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}',
    idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'campaignJob', idempotencyScope: 'workflow', allowHttp: false,
  }));
  assert.equal(built[0].length, 1);
  assert.equal(built[0][0].json.requestBuild.success, true);
  assert.equal(built[0][0].json.readyRequest.job.jobId, 'JOB-V211');
  assert.equal(built[0][0].json.readyRequest.recipient.email, 'v211@example.com');
  assert.equal(built[0][0].json.readyRequest.odooCompatibility.majorVersion, 19);
  assert.equal(built[0][0].json.readyRequest.issuerCompatibility.status, 'VERIFIED');
});

test('v2.1.1 optional-input guard rethrows unrelated input failures', () => {
  const { safeInputData } = load('shared/utils/Input.js');
  const ctx = { getInputData() { throw new Error('Workflow database is unavailable'); } };
  assert.throws(() => safeInputData(ctx, 2), /Workflow database is unavailable/);
});

test('v2.1.1 Provider Selector supports one embedded work input under real n8n missing-index behavior', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const loader = await loadProviders.call(context([providerRows], {
    batchId: 'v211-selector-embedded', __executionId: 'v211-selector-embedded', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
  }));
  const work = { json: {
    providerLibrary: loader[0][0].json,
    recipient: { email: 'selector-v211@example.com', name: 'Selector V211' },
    invoiceTemplate: { currency: 'USD' },
    job: { jobId: 'JOB-SELECTOR-V211', campaignId: 'campaign-selector-v211', campaignSafety: { enabled: false, totalItems: 1, maxItems: 1, maxFailures: 1, delayBetweenSendsMs: 0, stopOnCriticalError: true } },
    runtime: loader[0][0].json.runtime,
  } };
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selected = await selectProvider.call(realN8nInputContext([[work]], {
    strategy: 'firstAvailable', processingMode: 'sequential', providerFilter: 'custom', actionFilter: '', environmentFilter: 'live', queueWhenUnavailable: true,
    conditionalRouting: false, routeProviderPath: 'recipient.customFields.Provider', routeActionPath: 'recipient.customFields.Action', routeEnvironmentPath: 'recipient.customFields.Environment',
    routingRulesJson: '[]', requireConditionalMatch: false, unmatchedRouteBehavior: 'block', lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
    __executionId: 'v211-selector-embedded',
  }));
  assert.equal(selected[0][0].json.providerAllocation.status, 'ALLOCATED');
  assert.equal(selected[0][0].json.providerAllocation.accountName, 'Primary Account');
});

test('v2.1.1 Campaign Store enforces a campaign-wide item cap across one-item allocation', async () => {
  const { admitCampaignJob } = load('shared/runtime/CampaignStore.js');
  const ctx = context([[]], { __executionId: 'campaign-cap-v211' });
  const result = await admitCampaignJob(ctx, {
    scopeKey: 'workflow-test:campaign-cap-v211', campaignId: 'campaign-cap-v211', jobId: 'JOB-1',
    config: { enabled: true, totalItems: 6, maxItems: 5, maxFailures: 2, delayBetweenSendsMs: 0, stopOnCriticalError: true },
  });
  assert.equal(result.approved, false);
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /exceeding Max Invoices Per Execution 5/);
});

test('v2.1.1 Campaign Store pauses after the configured terminal failure threshold', async () => {
  const { admitCampaignJob, recordCampaignOutcome } = load('shared/runtime/CampaignStore.js');
  const ctx = context([[]], { __executionId: 'campaign-failure-v211' });
  const config = { enabled: true, totalItems: 3, maxItems: 3, maxFailures: 2, delayBetweenSendsMs: 0, stopOnCriticalError: true };
  for (const jobId of ['JOB-A', 'JOB-B']) {
    const admitted = await admitCampaignJob(ctx, { scopeKey: 'workflow-test:campaign-failure-v211', campaignId: 'campaign-failure-v211', jobId, config });
    assert.equal(admitted.approved, true);
    recordCampaignOutcome(ctx, { scopeKey: 'workflow-test:campaign-failure-v211', campaignId: 'campaign-failure-v211', jobId, config, recipientStatus: 'FAILED', terminal: true, critical: false, errorMessage: 'test failure' });
  }
  const third = await admitCampaignJob(ctx, { scopeKey: 'workflow-test:campaign-failure-v211', campaignId: 'campaign-failure-v211', jobId: 'JOB-C', config });
  assert.equal(third.approved, false);
  assert.equal(third.status, 'QUEUED');
  assert.match(third.reason, /configured threshold 2/);
});

test('v2.1.1 Campaign Store applies inter-send delay across sequential one-item admissions', async () => {
  const { admitCampaignJob } = load('shared/runtime/CampaignStore.js');
  const ctx = context([[]], { __executionId: 'campaign-delay-v211' });
  const config = { enabled: true, totalItems: 2, maxItems: 2, maxFailures: 2, delayBetweenSendsMs: 30, stopOnCriticalError: true };
  await admitCampaignJob(ctx, { scopeKey: 'workflow-test:campaign-delay-v211', campaignId: 'campaign-delay-v211', jobId: 'JOB-1', config });
  const started = Date.now();
  const second = await admitCampaignJob(ctx, { scopeKey: 'workflow-test:campaign-delay-v211', campaignId: 'campaign-delay-v211', jobId: 'JOB-2', config });
  assert.ok(Date.now() - started >= 20, `delay was ${Date.now() - started}ms`);
  assert.ok(Number(second.waitMs) >= 20);
});

test('v2.1.1 no-account transport remains QUEUED with a durable PENDING retry queue entry', async () => {
  const embedded = await embeddedOdooBuildItem();
  embedded.json.providerAllocation = { status: 'QUEUED', workerId: 'JOB-V211', scopeKey: 'workflow-test:no-account-v211', reason: 'No eligible provider account is currently available.', campaignSafety: { approved: true } };
  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const built = await buildRequest.call(realN8nInputContext([[embedded]], {
    strictProviderWarnings: false, strictProviderValidation: true, sendGuardMode: 'strict', customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'campaignJob', idempotencyScope: 'workflow', allowHttp: false,
  }));
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([built[0]], { dryRun: false, productionPresetMode: 'off', enableBulkSafety: false, includeResponseBody: true, requireSendGuard: true, preventDuplicateSends: true, stopOnTransportError: false }));
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true,
    alertOnFailure: true, includeEvents: true, includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 20, includeStatusWriteback: true,
    writebackTarget: 'invoice_results', writebackKeyMode: 'requestId',
  }));
  const management = managed[0][0].json.management;
  assert.equal(management.workflowResult.recipientStatus, 'QUEUED');
  assert.equal(management.retryQueueWriteback.values.Queue_Status, 'PENDING');
  assert.equal(management.retryScheduled, false);
  assert.equal(management.failoverScheduled, false);
});

test('v2.1.1 campaignJob dynamic references and idempotency stay stable across provider failover', async () => {
  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const params = { strictProviderWarnings: false, strictProviderValidation: true, sendGuardMode: 'strict', customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'campaignJob', idempotencyScope: 'workflow', allowHttp: false };
  const first = await embeddedOdooBuildItem({ profileId: 'odoo-a-live-create-invoice', accountId: 'a', accountName: 'A' });
  const second = await embeddedOdooBuildItem({ profileId: 'odoo-b-live-create-invoice', accountId: 'b', accountName: 'B' });
  const builtA = await buildRequest.call(realN8nInputContext([[first]], params));
  const builtB = await buildRequest.call(realN8nInputContext([[second]], params));
  assert.equal(builtA[0][0].json.readyRequest.invoice.invoiceNumber, builtB[0][0].json.readyRequest.invoice.invoiceNumber);
  assert.equal(builtA[0][0].json.readyRequest.invoice.transactionId, builtB[0][0].json.readyRequest.invoice.transactionId);
  assert.equal(builtA[0][0].json.readyRequest.idempotency.value, builtB[0][0].json.readyRequest.idempotency.value);
});

test('v2.1.1 Odoo request builder blocks unsupported nonzero global totals before sending', async () => {
  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const embedded = await embeddedOdooBuildItem();
  embedded.json.invoiceTemplate.totals.tax = 10;
  await assert.rejects(() => buildRequest.call(realN8nInputContext([[embedded]], {
    strictProviderWarnings: false, strictProviderValidation: true, sendGuardMode: 'strict', customBodyJson: '{}', extraHeadersJson: '{}', extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'campaignJob', idempotencyScope: 'workflow', allowHttp: false,
  })), /Odoo built-in mapping does not apply tax totals/);
});

test('v2.1.1 ambiguous side-effect transport is MANUAL_REVIEW and never automatically retried', async () => {
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const raw = { json: {
    job: { jobId: 'JOB-AMB', campaignId: 'campaign-amb', campaignSafety: { enabled: true, totalItems: 1, maxItems: 1, maxFailures: 1, delayBetweenSendsMs: 0, stopOnCriticalError: true } },
    recipient: { email: 'ambiguous@example.com' },
    readyRequest: { requestId: 'REQ-AMB', providerId: 'odoo', profileId: 'odoo-a', accountId: 'a', accountName: 'A', actionId: 'create-invoice', job: { jobId: 'JOB-AMB', campaignId: 'campaign-amb' }, failoverGroup: 'company-a', runtime: { scopeKey: 'workflow-test:ambiguous' } },
    rawExecution: { success: false, transportStatus: 'TIMEOUT', requestId: 'REQ-AMB', providerId: 'odoo', profileId: 'odoo-a', accountId: 'a', actionId: 'create-invoice', httpStatus: 0, responseBody: null, responseHeaders: {}, error: { message: 'timeout during account.move.create', errorType: 'NETWORK_ERROR', model: 'account.move', method: 'create', lifecycleStage: 'invoice.create', ambiguousSideEffect: true, definitiveNoSideEffect: false }, runtime: { scopeKey: 'workflow-test:ambiguous' } },
  } };
  const checked = await checkStatus.call(context([[[raw][0]]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  assert.equal(checked[0][0].json.standardStatus.errorType, 'AMBIGUOUS_PROVIDER_RESULT');
  assert.equal(checked[0][0].json.standardStatus.retryableByPolicy, false);
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true,
    includeEvents: true, includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 20, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId',
  }));
  const management = managed[0][0].json.management;
  assert.equal(management.workflowResult.recipientStatus, 'MANUAL_REVIEW');
  assert.equal(management.retryScheduled, false);
  assert.equal(management.failoverScheduled, false);
  assert.equal(management.retryQueueWriteback.values.Queue_Status, 'MANUAL_REVIEW');
});

test('v2.1.1 account report does not count a same-account retry as a new allocation', async () => {
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const item = { json: {
    retryAttempt: true, retryCount: 1,
    job: { jobId: 'JOB-RETRY-COUNT', campaignId: 'campaign-retry-count', attemptCount: 1, accountReportSeed: { 'profile-retry': { Allocated: 1, Attempted: 1, Retried: 0 } }, campaignSafety: { enabled: false, totalItems: 1, maxItems: 1, maxFailures: 1, delayBetweenSendsMs: 0, stopOnCriticalError: true } },
    readyRequest: { failoverGroup: 'company-a' }, failoverState: { failoverGroup: 'company-a', currentProfileId: 'profile-retry', originalProfileId: 'profile-retry', attemptedProfileIds: ['profile-retry'] },
    standardStatus: { requestId: 'REQ-RETRY-COUNT', providerId: 'odoo', profileId: 'profile-retry', accountId: 'account-a', accountName: 'Account A', recipientEmail: 'retry-count@example.com', result: 'SUCCESS', transportStatus: 'COMPLETED', invoiceStatus: 'SENT', providerInvoiceId: '501', emailSendRequested: true, emailSendStatus: 'SENT', postStatus: 'POSTED', errorType: '', errorCategory: '', errorMessage: '', httpStatus: 200, sideEffectStage: 'email.sent', retryDecision: { retryable: false, safeToRetry: false, source: 'success' }, runtime: { scopeKey: 'workflow-test:retry-count' } },
  } };
  const managed = await manageStatus.call(context([[item]], { retryLimit: 3, retryBaseDelaySeconds: 1, retryMaxDelaySeconds: 10, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true, includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 20, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId' }));
  const report = managed[0][0].json.management.accountReportEvent;
  assert.equal(report.Allocated, 1);
  assert.equal(report.Attempted, 2);
  assert.equal(report.Retried, 1);
});

test('v2.1.1 campaign report is one aggregate row keyed by Campaign_ID and includes pause reason', async () => {
  const source = fs.readFileSync(path.join(root, 'nodes/08_StatusManager/StatusManager.execute.ts'), 'utf8');
  assert.match(source, /Report_Key:\s*toStringValue\(job\.campaignId/);
  assert.match(source, /Pause_Reason:\s*campaignAggregate\.pauseReason/);
  const header = fs.readFileSync(path.join(root, 'template/providers/odoo/campaign_report.csv'), 'utf8').split(/\r?\n/)[0];
  assert.ok(header.split(',').includes('Pause_Reason'));
});

test('v2.1.1 canonical and URL-import Odoo workflows are byte-identical, closed, and expression-safe', () => {
  const compatibilityPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json');
  const canonicalPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json');
  const compatibility = fs.readFileSync(compatibilityPath, 'utf8');
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  assert.equal(compatibility, canonical);
  const workflow = JSON.parse(canonical);
  assert.equal(workflow.meta.invoiceRouterRelease, '2.1.1');
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length);
  const known = new Set(names);
  const expressions = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === 'object') return Object.values(value).forEach(walk);
    if (typeof value === 'string' && value.startsWith('=')) expressions.push(value);
  };
  walk(workflow);
  for (const [sourceName, groups] of Object.entries(workflow.connections)) {
    assert.ok(known.has(sourceName), `unknown source ${sourceName}`);
    for (const output of groups.main ?? []) for (const connection of output) assert.ok(known.has(connection.node), `unknown target ${connection.node}`);
  }
  for (const expression of expressions) {
    if (expression.startsWith('={{')) assert.ok(expression.trimEnd().endsWith('}}'), expression);
    assert.equal(expression.startsWith('={') && !expression.startsWith('={{'), false, expression);
  }
});

test('v2.1.1 canonical workflow orders identity, retry checkpoint, processing, allocation checkpoint, provider call, and terminal writeback', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const next = (name, output = 0) => (workflow.connections[name]?.main?.[output] ?? []).map((entry) => entry.node);
  assert.deepEqual(next('Prepare Job Identity Row'), ['Google Sheets - Persist Job Identity']);
  assert.deepEqual(next('Google Sheets - Persist Job Identity'), ['Restore Job Identity Context']);
  assert.ok(next('Restore Job Identity Context').includes('Prepare Initial Retry Queue Row'));
  assert.deepEqual(next('Google Sheets - Initialize Retry Queue'), ['Restore Initial Retry Queue Context']);
  assert.deepEqual(next('Loop Over Recipient Jobs', 1), ['Prepare Processing Status']);
  assert.deepEqual(next('Google Sheets - Recipient Processing'), ['Restore Processing Context']);
  assert.deepEqual(next('Restore Processing Context'), ['Provider Selector']);
  assert.deepEqual(next('Provider Selector'), ['Prepare Allocation Checkpoint']);
  assert.deepEqual(next('Google Sheets - Allocation Checkpoint'), ['Restore Allocation Checkpoint Context']);
  assert.deepEqual(next('Restore Allocation Checkpoint Context'), ['Request Builder']);
  assert.deepEqual(next('Request Builder'), ['Google Sheets - Provider Lease Verify']);
  assert.deepEqual(next('Google Sheets - Provider Lease Verify'), ['Verify Provider Lease Before Side Effect']);
  assert.deepEqual(next('Verify Provider Lease Before Side Effect'), ['Prepare Provider Operation Envelope']);
  assert.deepEqual(next('Restore Provider Operation Context'), ['Invoice Sender']);
  assert.deepEqual(next('Status Manager'), ['Prepare Pending Writeback Bundle']);
  assert.deepEqual(next('Google Sheets - Writeback Queue Pending'), ['Restore Pending Writeback Context']);
  assert.deepEqual(next('Google Sheets - Status Writeback'), ['Restore Status Writeback Context']);
  assert.deepEqual(next('Google Sheets - Recipient Status'), ['Restore Recipient Status Context']);
  assert.deepEqual(next('Google Sheets - Retry Queue'), ['Restore Retry Queue Context']);
  assert.deepEqual(next('Google Sheets - Campaign Report'), ['Restore Campaign Report Context']);
  assert.deepEqual(next('Google Sheets - Writeback Queue Complete'), ['Restore Completed Writeback Context']);
});

test('v2.1.1 canonical workflow starts writeback-only repair before any provider operation', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const next = (name, output = 0) => (workflow.connections[name]?.main?.[output] ?? []).map((entry) => entry.node);
  assert.deepEqual(next('Manual Trigger'), ['Google Sheets - Writeback Queue Input']);
  assert.deepEqual(next('Google Sheets - Writeback Queue Input'), ['Build Writeback Repair Items']);
  assert.deepEqual(next('Loop Over Writeback Repairs', 0), ['Google Sheets - Provider Accounts']);
  assert.deepEqual(next('Repair Noop'), ['Loop Over Writeback Repairs']);
  const repairNodes = workflow.nodes.filter((node) => /^Repair |Writeback Repair/.test(node.name));
  assert.ok(repairNodes.every((node) => !/Provider Selector|Request Builder|Invoice Sender/.test(node.name)));
});

test('v2.1.1 all mandatory managed Sheet writes are ordered hard gates with three write retries', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const mandatory = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets' && ['appendOrUpdate'].includes(node.parameters?.operation));
  assert.ok(mandatory.length >= 18);
  for (const node of mandatory) {
    assert.equal(node.retryOnFail, true, node.name);
    assert.equal(node.maxTries, 3, node.name);
    assert.equal(node.waitBetweenTries, 2000, node.name);
    assert.notEqual(node.continueOnFail, true, node.name);
  }
});

test('v2.1.1 workbook/template contract includes durable writeback repair and updated Apps Script alias', () => {
  for (const file of ['writeback_queue.csv', 'retry_queue.csv', 'account_report.csv', 'campaign_report.csv']) assert.ok(fs.existsSync(path.join(root, 'template/providers/odoo', file)), file);
  const writebackHeader = fs.readFileSync(path.join(root, 'template/providers/odoo/writeback_queue.csv'), 'utf8').split(/\r?\n/)[0];
  for (const field of ['Repair_ID', 'Payload_JSON', 'Queue_Status', 'Last_Error']) assert.ok(writebackHeader.split(',').includes(field), field);
  const script = fs.readFileSync(path.join(root, 'template/providers/odoo/google-sheets/auto-fix-invoice-results-headers.gs'), 'utf8');
  assert.match(script, /function fixInvoiceRouterV211Workbook\(/);
  assert.match(script, /function fixInvoiceRouterV210Workbook\(/);
  assert.match(script, /"writeback_queue":/);
  assert.doesNotMatch(script, /deleteSheet|clearContents|clear\(/);
});

test('v2.1.1 Odoo sender includes proactive stable-reference recovery and blocks untrusted posted-invoice resend', () => {
  const source = fs.readFileSync(path.join(root, 'nodes/06_InvoiceSender/InvoiceSender.execute.ts'), 'utf8');
  assert.match(source, /invoice-recovery-lookup/);
  assert.match(source, /\['ref', '=', requestedInvoiceNumber\]/);
  assert.match(source, /multiple invoices with stable reference/);
  assert.match(source, /Automatic resend was blocked/);
  assert.match(source, /recipientEvidenceBound/);
  assert.match(source, /MANUAL_REVIEW/);
});

test('v2.1.1 package includes the corrective freeze document and versioned raw-URL workflow template', () => {
  assert.ok(pkg.files.includes('docs/freeze/v1.0/V2_1_1_PRODUCTION_CORRECTIVE_PATCH.md'));
  const relative = 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json';
  assert.ok(fs.existsSync(path.join(root, relative)));
  const readme = fs.readFileSync(path.join(root, 'template/providers/odoo/README.md'), 'utf8');
  assert.match(readme, /raw\.githubusercontent\.com\/vibtools\/n8n-nodes-invoicerouter\/v2\.1\.1\/template\/providers\/odoo\/n8n-import-workflow-production-v2\.1\.1\.json/);
});

test('v2.1.1 Odoo invoice-create transport ambiguity reconciles one stable-reference invoice without a duplicate create', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const prepared = await runPipeline({
    dryRun: true,
    providers,
    recipients: [{ json: { Email: 'reconcile.customer@example.com' } }],
    selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' },
    requestParams: { strictProviderValidation: true, idempotencyKeyMode: 'campaignJob' },
  });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true,
    activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES',
    liveModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    new Error('socket hang up after invoice create'),
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', ref: prepared.built[0][0].json.readyRequest.invoice.invoiceNumber, partner_id: [88, 'New Customer'] }] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', ref: prepared.built[0][0].json.readyRequest.invoice.invoiceNumber, partner_id: [88, 'New Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: false }] } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.filter((call) => call.model === 'account.move' && call.method === 'create').length, 1);
  const reconcile = calls.find((call) => call.model === 'account.move' && call.method === 'search_read' && String(senderContext.calls[calls.indexOf(call)]?.body?.id || '').includes('invoice-reconcile'));
  assert.ok(reconcile);
  assert.equal(reconcile.kwargs.limit, 2);
  assert.equal(sent[0][0].json.rawExecution.success, true);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.id, 501);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.checkpoint.invoiceReused, true);
});

test('v2.1.1 Odoo invoice-create reconciliation blocks multiple stable-reference matches as ambiguous manual review', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const prepared = await runPipeline({
    dryRun: true,
    providers,
    recipients: [{ json: { Email: 'ambiguous.customer@example.com' } }],
    selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'sandbox' },
    requestParams: { strictProviderValidation: true, idempotencyKeyMode: 'campaignJob' },
  });
  const stableRef = prepared.built[0][0].json.readyRequest.invoice.invoiceNumber;
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true,
    activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES',
    liveModeConfirmation: '', preventDuplicateSends: true, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [] } },
    { statusCode: 200, headers: {}, body: { result: 88 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    new Error('socket hang up after invoice create'),
    { statusCode: 200, headers: {}, body: { result: [
      { id: 501, name: 'INV/2026/00001', state: 'draft', ref: stableRef, partner_id: [88, 'New Customer'] },
      { id: 502, name: 'INV/2026/00002', state: 'draft', ref: stableRef, partner_id: [88, 'New Customer'] },
    ] } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  const raw = sent[0][0].json.rawExecution;
  assert.equal(raw.success, false);
  assert.equal(raw.error.errorType, 'AMBIGUOUS_PROVIDER_RESULT');
  assert.equal(raw.error.ambiguousSideEffect, true);
  assert.match(raw.error.message, /multiple invoices with stable reference/i);
});

test('v2.1.1 Odoo recovery finds an existing posted stable-reference invoice and blocks automatic duplicate email send', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({
    dryRun: true,
    providers,
    recipients: [{ json: { Email: 'posted.recovery@example.com' } }],
    selectorParams: { providerFilter: 'odoo', actionFilter: 'create-invoice', environmentFilter: 'live' },
    requestParams: { strictProviderValidation: true, idempotencyKeyMode: 'campaignJob' },
  });
  const stableRef = prepared.built[0][0].json.readyRequest.invoice.invoiceNumber;
  const item = structuredClone(prepared.built[0][0]);
  item.json.readyRequest.failoverState = { queueStatus: 'RETRY_WAIT', failoverGroup: 'company-a', attemptedProfileIds: [item.json.readyRequest.profileId] };
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([[item]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true,
    activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES',
    sandboxModeConfirmation: '', preventDuplicateSends: false, duplicateTtlHours: 720, reservationTtlMinutes: 15, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 88, name: 'Posted Customer', email: 'posted.recovery@example.com' }] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', ref: stableRef, partner_id: [88, 'Posted Customer'], invoice_pdf_report_id: [900, 'Invoice PDF'] }] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'posted', ref: stableRef, partner_id: [88, 'Posted Customer'], currency_id: [2, 'USD'], invoice_pdf_report_id: [900, 'Invoice PDF'] }] } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'create'), false);
  assert.equal(calls.some((call) => call.model === 'account.move.send.wizard'), false);
  const body = sent[0][0].json.rawExecution.responseBody;
  assert.equal(body.result.id, 501);
  assert.equal(body.result.lifecycle.emailSendStatus, 'UNVERIFIED');
  assert.equal(body.result.lifecycle.emailEvidence.automaticResendBlocked, true);
  assert.equal(body.result.lifecycle.emailEvidence.recipientEvidenceBound, false);
});

test('v2.1.1 Phase 03 wizard transport timeout with current-attempt SENT evidence remains SENT', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ wizardSendResponse: new Error('socket timeout after Odoo send') })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'SENT');
  assert.equal(lifecycle.emailEvidence.wizardCompleted, false);
  assert.equal(lifecycle.emailEvidence.ambiguousWizardTransport, true);
  assert.equal(lifecycle.emailEvidence.wizardErrorDetails.errorType, 'NETWORK_ERROR');
});

test('v2.1.1 Phase 03 wizard transport timeout with current-attempt QUEUED evidence remains QUEUED', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ wizardSendResponse: new Error('socket timeout after Odoo send'), notificationStatus: 'ready', mailState: 'outgoing' })));
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'QUEUED');
});

test('v2.1.1 Phase 03 wizard transport timeout with explicit current-attempt failure evidence remains FAILED', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ wizardSendResponse: new Error('socket timeout after Odoo send'), notificationStatus: 'exception', mailState: 'exception', failureReason: 'SMTP rejected recipient.' })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'FAILED');
  assert.match(lifecycle.emailErrorMessage, /SMTP rejected recipient/);
});

test('v2.1.1 Phase 03 ambiguous wizard transport without terminal evidence becomes UNVERIFIED', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ wizardSendResponse: new Error('socket timeout after Odoo send'), afterMessageIds: [10], notificationStatus: '', mailState: '' })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'UNVERIFIED');
  assert.equal(lifecycle.emailEvidence.ambiguousWizardTransport, true);
  assert.equal(lifecycle.emailEvidence.wizardErrorDetails.model, 'account.move.send.wizard');
  assert.equal(lifecycle.emailEvidence.wizardErrorDetails.method, 'action_send_and_print');
  assert.match(lifecycle.emailErrorMessage, /No attempt-bound terminal Odoo mail evidence/);
});

test('v2.1.1 Phase 03 duplicate Odoo contacts fail closed before customer or invoice creation', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'duplicate@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'sandbox' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 88, name: 'Duplicate A', email: 'duplicate@example.com' }, { id: 89, name: 'Duplicate B', email: 'DUPLICATE@example.com' }] } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'res.partner' && call.method === 'create'), false);
  assert.equal(calls.some((call) => call.model === 'account.move' && call.method === 'create'), false);
  assert.equal(calls[1].args[0][0][1], '=ilike');
  assert.equal(calls[1].kwargs.limit, 2);
  assert.equal(sent[0][0].json.rawExecution.error.errorType, 'AMBIGUOUS_PROVIDER_RESULT');
  assert.equal(sent[0][0].json.rawExecution.error.ambiguousSideEffect, false);
});

test('v2.1.1 Phase 03 case-insensitive exact partner lookup reuses one existing contact', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Sandbox', Environment: 'sandbox', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"draftOnly","odooPostInvoice":false}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'mixed.case@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'sandbox' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'sandboxRealSend', expectedEnvironment: 'sandbox', sandboxModeConfirmation: 'SEND_SANDBOX_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, [
    { statusCode: 200, headers: {}, body: { result: 7 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 88, name: 'Mixed Case', email: 'Mixed.Case@Example.COM' }] } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 2, name: 'USD', active: true }] } },
    { statusCode: 200, headers: {}, body: { result: 501 } },
    { statusCode: 200, headers: {}, body: { result: [{ id: 501, name: 'INV/2026/00001', state: 'draft', ref: 'INV-TEST', partner_id: [88, 'Mixed Case'], currency_id: [2, 'USD'], invoice_pdf_report_id: false }] } },
  ]);
  const sent = await sendInvoice.call(senderContext);
  const calls = senderContext.calls.map(odooRpcCall);
  assert.equal(calls.some((call) => call.model === 'res.partner' && call.method === 'create'), false);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_id, 88);
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.partner_created, false);
});

test('v2.1.1 Phase 03 RFC display-name recipient evidence matches the intended email', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ notificationStatus: '', mailState: 'sent', recipientIds: [], emailTo: 'New Customer <new.customer@example.com>' })));
  const evidence = sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailEvidence;
  assert.equal(sent[0][0].json.rawExecution.responseBody.result.lifecycle.emailSendStatus, 'SENT');
  assert.equal(evidence.intendedNotificationCount, 0);
  assert.equal(evidence.intendedMailCount, 1);
  assert.equal(evidence.recipientEvidenceBound, true);
});

test('v2.1.1 Phase 03 invalid PDF attachment identity is reported without fabricating valid PDF evidence', async () => {
  const providers = [{ json: { Enabled: true, Provider: 'Odoo', Account: 'Odoo Live', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://odoo.example.test', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'odoo-user@example.com', Password: 'odoo-secret', Database: 'odoo-db', 'Content-Type': 'application/json', 'Extra Config JSON': '{"invoiceLifecycle":"createPostAndSendEmail","odooSendInvoiceEmail":true}', Timeout: 60 } }];
  const prepared = await runPipeline({ dryRun: true, providers, recipients: [{ json: { Email: 'new.customer@example.com' } }], selectorParams: { providerFilter: 'odoo', environmentFilter: 'live' } });
  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const sent = await sendInvoice.call(context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, odooEmailResponses({ attachmentRecords: [{ id: 900, name: 'invoice.txt', mimetype: 'text/plain', res_model: 'mail.message', res_id: 11, type: 'binary' }] })));
  const lifecycle = sent[0][0].json.rawExecution.responseBody.result.lifecycle;
  assert.equal(lifecycle.emailSendStatus, 'SENT');
  assert.equal(lifecycle.emailEvidence.pdfEvidence.status, 'INVALID_ATTACHMENT');
  assert.equal(lifecycle.emailEvidence.pdfEvidence.expectedReportBound, false);
  assert.deepEqual(lifecycle.emailEvidence.pdfEvidence.validPdfAttachmentIds, []);
});



test('v2.1.1 Phase 04 shared capability manifest distinguishes Odoo 18 and Odoo 19 wizard fields', () => {
  const { odooCapabilityProfileByMajor } = load('shared/odoo/OdooCapabilityManifest.js');
  const v18 = odooCapabilityProfileByMajor(18);
  const v19 = odooCapabilityProfileByMajor(19);
  assert.ok(v18.requiredFields['account.move.send.wizard'].includes('mail_subject'));
  assert.ok(!v18.requiredFields['account.move.send.wizard'].includes('subject'));
  assert.ok(v19.requiredFields['account.move.send.wizard'].includes('subject'));
  assert.ok(v19.requiredFields['account.move.send.wizard'].includes('template_id'));
  assert.equal(v18.senderMethods.wizardSend, 'action_send_and_print');
  assert.equal(v19.senderMethods.wizardSend, 'action_send_and_print');
});

test('v2.1.1 Phase 04 Odoo 18 preflight validates the version profile and issuer identity', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Odoo 18', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://v18.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'secret', Database: 'v18', Failover_Group: 'issuer-a', Issuer_Key: 'issuer-a', status: 'READY',
  } }];
  const loaded = await loadProviders.call(context([rows], {
    batchId: 'phase04-v18', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, odooPreflightResponses(18, 3, 'Issuer A Ltd')));
  assert.equal(loaded[0][0].json.total, 1);
  assert.equal(loaded[0][0].json.providers[0].odooMajorVersion, 18);
  assert.equal(loaded[0][0].json.providers[0].issuerCompatibility.status, 'VERIFIED');
  assert.equal(loaded[0][0].json.preflightResults[0].Capability_Status, 'CAPABILITY_VALIDATED_SIDE_EFFECT_PERMISSION_UNPROVEN');
});

test('v2.1.1 Phase 04 unknown Odoo major version fails closed before authentication', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [{ json: {
    Enabled: true, Provider: 'Odoo', Account: 'Odoo 20', Environment: 'live', Action: 'Create Invoice', Method: 'POST',
    'Base URL': 'https://v20.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'api@example.com',
    Password: 'secret', Database: 'v20', Failover_Group: 'issuer-a', Issuer_Key: 'issuer-a', status: 'READY',
  } }];
  const ctx = context([rows], {
    batchId: 'phase04-v20', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, [{ result: { server_version: '20.0' } }]);
  const loaded = await loadProviders.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(loaded[0][0].json.total, 0);
  assert.equal(loaded[0][0].json.preflightResults[0].status, 'ODOO_VERSION_UNSUPPORTED');
});

test('v2.1.1 Phase 04 issuer mismatch blocks the entire Odoo failover group', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const rows = [
    { json: { Enabled: true, Provider: 'Odoo', Account: 'Issuer A One', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://a1.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'a@example.com', Password: 'secret', Database: 'a1', Failover_Group: 'issuer-a', Issuer_Key: 'issuer-a', status: 'READY' } },
    { json: { Enabled: true, Provider: 'Odoo', Account: 'Issuer A Two', Environment: 'live', Action: 'Create Invoice', Method: 'POST', 'Base URL': 'https://a2.odoo.com', Endpoint: '/jsonrpc', 'Auth Type': 'Odoo JSON-RPC', Username: 'b@example.com', Password: 'secret', Database: 'a2', Failover_Group: 'issuer-a', Issuer_Key: 'issuer-a', status: 'READY' } },
  ];
  const responses = [...odooPreflightResponses(19, 1, 'Issuer A Ltd'), ...odooPreflightResponses(19, 2, 'Different Issuer Ltd')];
  const loaded = await loadProviders.call(context([rows], {
    batchId: 'phase04-issuer-mismatch', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: 'USD', preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, responses));
  assert.equal(loaded[0][0].json.total, 0);
  assert.equal(loaded[0][0].json.preflightResults.every((row) => row.status === 'ISSUER_MISMATCH'), true);
  assert.equal(loaded[0][0].json.preflightResults.every((row) => row.Enabled === true && row.Auto_Disabled === false), true);
});

test('v2.1.1 Phase 04 canonical workflow writes capability and issuer evidence to provider sheet', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const values = byName['Google Sheets - Preflight Provider Status'].parameters.columns.value;
  for (const field of ['Issuer_Key','Company_ID','Company_Name','Odoo_Server_Version','Odoo_Major_Version','Capability_Status','Issuer_Compatibility']) assert.ok(values[field]);
  assert.deepEqual(
    fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json')),
    fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json')),
  );
});

test('v2.1.1 Phase 01 Provider Loader preserves rehydration context and rebuilds the required-account vault entry', async () => {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const { getSecretMaterial } = load('shared/runtime/RuntimeStore.js');
  const batchId = `phase01-rehydrate-${Date.now()}`;
  const marker = {
    schemaVersion: '1.0',
    mode: 'retry',
    sourceNode: 'Wait Before Retry',
    context: {
      recipient: { email: 'rehydrate@example.com', name: 'Runtime Rehydrate' },
      invoiceTemplate: { invoiceId: '#INV#', currency: 'USD' },
      job: { jobId: 'JOB-REHYDRATE-01', campaignId: 'campaign-rehydrate', campaignSafety: { enabled: false } },
      failoverState: { failoverGroup: '', attemptedProfileIds: [], requiredProfileId: '', queueStatus: 'RETRY_WAIT', sideEffectStage: 'none' },
    },
  };
  const rows = providerRows.map((item) => ({ json: { ...item.json, __invoiceRouterRehydration: marker } }));
  const loader = await loadProviders.call(context([rows], {
    batchId, __executionId: 'exec-phase01-rehydrate', sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
  }));
  const library = loader[0][0].json;
  const profileId = library.providers[0].id;
  const scopeKey = `workflow-test:${batchId}`;
  const credentialRef = `${scopeKey}::${profileId}`;
  assert.equal(library.rehydration.mode, 'retry');
  assert.equal(library.rehydration.context.job.jobId, 'JOB-REHYDRATE-01');
  assert.ok(getSecretMaterial(credentialRef));
  assert.doesNotMatch(JSON.stringify(library), /super-secret-token|super-secret-value/);

  const work = {
    json: {
      ...marker.context,
      providerLibrary: library,
      failoverState: { ...marker.context.failoverState, requiredProfileId: profileId },
    },
  };
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selected = await selectProvider.call(realN8nInputContext([[work]], {
    strategy: 'firstAvailable', processingMode: 'sequential', __executionId: 'exec-phase01-rehydrate', providerFilter: 'custom', actionFilter: '', environmentFilter: 'live', queueWhenUnavailable: true,
    conditionalRouting: false, routeProviderPath: 'recipient.customFields.Provider', routeActionPath: 'recipient.customFields.Action', routeEnvironmentPath: 'recipient.customFields.Environment',
    routingRulesJson: '[]', requireConditionalMatch: false, unmatchedRouteBehavior: 'block', lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
  }));
  assert.equal(selected[0][0].json.providerAllocation.status, 'ALLOCATED');
  assert.equal(selected[0][0].json.providerAllocation.id, profileId);
  assert.equal(selected[0][0].json.providerAllocation.credentialRef, credentialRef);
});

test('v2.1.1 Phase 01 canonical Odoo workflow rehydrates provider Sheet, pool, and vault after retry and failover waits', () => {
  const canonicalPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json');
  const compatibilityPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json');
  const canonicalBytes = fs.readFileSync(canonicalPath);
  const compatibilityBytes = fs.readFileSync(compatibilityPath);
  assert.deepEqual(canonicalBytes, compatibilityBytes);
  const workflow = JSON.parse(canonicalBytes.toString('utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const custom = workflow.nodes.filter((node) => node.type.startsWith('n8n-nodes-invoicerouter.'));
  assert.equal(custom.length, 8);
  assert.equal(workflow.meta.invoiceRouterHardeningPhase, 'phase-07-final-corrective-audit');
  assert.equal(workflow.meta.invoiceRouterRuntimeRehydration, true);

  for (const name of [
    'Google Sheets - Retry Provider Accounts', 'Prepare Retry Provider Rehydration', 'Restore Retry Provider Rehydration',
    'Google Sheets - Failover Provider Accounts', 'Prepare Failover Provider Rehydration', 'Restore Failover Provider Rehydration',
  ]) assert.ok(byName[name], name);

  assert.deepEqual(workflow.connections['Wait Before Retry'].main[0].map((entry) => [entry.node, entry.index]), [['Google Sheets - Retry Provider Accounts', 0]]);
  assert.deepEqual(workflow.connections['Google Sheets - Retry Provider Accounts'].main[0].map((entry) => entry.node), ['Prepare Retry Provider Rehydration']);
  assert.deepEqual(workflow.connections['Prepare Retry Provider Rehydration'].main[0].map((entry) => entry.node), ['Provider Loader']);
  assert.deepEqual(workflow.connections['Restore Retry Provider Rehydration'].main[0].map((entry) => [entry.node, entry.index]), [['Provider Selector', 1]]);

  assert.deepEqual(workflow.connections['Wait Before Failover'].main[0].map((entry) => [entry.node, entry.index]), [['Google Sheets - Failover Provider Accounts', 0]]);
  assert.deepEqual(workflow.connections['Google Sheets - Failover Provider Accounts'].main[0].map((entry) => entry.node), ['Prepare Failover Provider Rehydration']);
  assert.deepEqual(workflow.connections['Prepare Failover Provider Rehydration'].main[0].map((entry) => entry.node), ['Provider Loader']);
  assert.deepEqual(workflow.connections['Restore Failover Provider Rehydration'].main[0].map((entry) => [entry.node, entry.index]), [['Provider Selector', 1]]);

  const loaderTargets = workflow.connections['Provider Loader'].main[0].map((entry) => entry.node).sort();
  assert.deepEqual(loaderTargets, ['Google Sheets - Issuer Mismatch Account Report Read', 'Prepare Preflight Provider Status', 'Restore Failover Provider Rehydration', 'Restore Retry Provider Rehydration'].sort());
  assert.match(byName['Prepare Preflight Provider Status'].parameters.jsCode, /rehydration/);
  assert.match(byName['Restore Retry Provider Rehydration'].parameters.jsCode, /requiredProfileId/);
  assert.match(byName['Restore Failover Provider Rehydration'].parameters.jsCode, /requiredProfileId:\s*""/);

  for (const name of ['Google Sheets - Retry Provider Accounts', 'Google Sheets - Failover Provider Accounts']) {
    assert.equal(byName[name].parameters.operation, 'read');
    assert.equal(byName[name].parameters.sheetName.value, 'provider');
    assert.equal(byName[name].retryOnFail, true);
    assert.equal(byName[name].maxTries, 3);
    assert.equal(byName[name].waitBetweenTries, 2000);
  }
});

test('v2.1.1 Phase 02 Email List blocks mixed pending Campaign_ID values before provider work', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const ctx = context([[
    { json: { Email: 'campaign-a@example.com', Campaign_ID: 'campaign-a', status: 'PENDING' } },
    { json: { Email: 'campaign-b@example.com', Campaign_ID: 'campaign-b', status: 'PENDING' } },
  ]], {
    batchId: 'phase02-mixed-campaigns', __executionId: 'exec-phase02-mixed', emailField: 'Email', nameField: 'Name', addressField: 'Address',
    statusField: 'status', jobIdField: 'Job_ID', campaignIdField: 'Campaign_ID', defaultCampaignId: 'default-campaign',
    nameGeneration: 'formatted', invalidPolicy: 'skip', preserveCustomColumns: false, preventReuse: false,
    enableCampaignSafety: true, campaignMaxInvoices: 100, campaignMaxFailures: 5, campaignDelayBetweenSendsMs: 0,
    campaignStopOnCriticalError: true, requireLiveBulkConfirmation: false, liveBulkConfirmation: '',
  });
  await assert.rejects(() => loadEmails.call(ctx), /Mixed pending campaigns found: campaign-a, campaign-b/);
});

test('v2.1.1 Phase 02 Campaign Store rebuilds Sheet state and requires the verified run lease', async () => {
  const { admitCampaignJob } = load('shared/runtime/CampaignStore.js');
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const seed = {
    schemaVersion: '2.0', source: 'sheets', campaignId: 'campaign-phase02', totalItems: 3,
    admittedJobIds: ['JOB-1', 'JOB-2'], terminalJobIds: ['JOB-1', 'JOB-2'],
    sent: 1, queued: 0, failed: 1, manualReview: 0, duplicate: 0, completed: 0,
    paused: false, pauseReason: '', runState: 'ACTIVE', runId: 'exec-phase02-owner',
    lockAcquiredAt: new Date().toISOString(), lockExpiresAt: expiresAt, revision: 7,
    lastAttemptAt: new Date(Date.now() - 1_000).toISOString(), updatedAt: new Date().toISOString(),
  };
  const config = {
    enabled: true, totalItems: 1, maxItems: 100, maxFailures: 5, delayBetweenSendsMs: 0, stopOnCriticalError: true,
    seed, runId: 'exec-phase02-owner', requireRunLease: true, leaseDurationMs: 60_000,
  };
  const result = await admitCampaignJob(context([[]], { __executionId: 'exec-phase02-owner' }), {
    scopeKey: 'workflow-test:campaign-phase02', campaignId: 'campaign-phase02', jobId: 'JOB-3', config,
  });
  assert.equal(result.approved, true);
  assert.equal(result.runState, 'ACTIVE');
  assert.equal(result.runId, 'exec-phase02-owner');
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.terminal, 2);
  assert.equal(result.pending, 1);
  assert.ok(Number(result.revision) > 7);

  const blocked = await admitCampaignJob(context([[]], { __executionId: 'exec-phase02-other' }), {
    scopeKey: 'workflow-test:campaign-phase02-other', campaignId: 'campaign-phase02', jobId: 'JOB-3',
    config: { ...config, runId: 'exec-phase02-other' },
  });
  assert.equal(blocked.approved, false);
  assert.equal(blocked.status, 'BLOCKED');
  assert.match(blocked.reason, /leased by another execution/);
});

test('v2.1.1 Phase 02 Campaign Store blocks an expired lease', async () => {
  const { admitCampaignJob } = load('shared/runtime/CampaignStore.js');
  const result = await admitCampaignJob(context([[]], { __executionId: 'exec-phase02-expired' }), {
    scopeKey: 'workflow-test:campaign-phase02-expired', campaignId: 'campaign-phase02-expired', jobId: 'JOB-1',
    config: {
      enabled: true, totalItems: 1, maxItems: 10, maxFailures: 5, delayBetweenSendsMs: 0, stopOnCriticalError: true,
      runId: 'exec-phase02-expired', requireRunLease: true, leaseDurationMs: 60_000,
      seed: { campaignId: 'campaign-phase02-expired', runState: 'ACTIVE', runId: 'exec-phase02-expired', lockExpiresAt: new Date(Date.now() - 1_000).toISOString(), revision: 2 },
    },
  });
  assert.equal(result.approved, false);
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /lease is expired/);
});

test('v2.1.1 Phase 02 canonical workflow reads durable campaign evidence and verifies a lease before provider selection', () => {
  const canonicalPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json');
  const compatibilityPath = path.join(root, 'template/providers/odoo/n8n-import-workflow-live-bulk.json');
  const canonical = fs.readFileSync(canonicalPath);
  assert.deepEqual(canonical, fs.readFileSync(compatibilityPath));
  const workflow = JSON.parse(canonical.toString('utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const targets = (name, output = 0) => (workflow.connections[name]?.main?.[output] ?? []).map((entry) => [entry.node, entry.index]);

  assert.equal(workflow.meta.invoiceRouterHardeningPhase, 'phase-07-final-corrective-audit');
  assert.equal(workflow.meta.invoiceRouterDurableCampaignState, true);
  assert.equal(workflow.meta.invoiceRouterCampaignRunLease, true);
  assert.equal(workflow.meta.invoiceRouterMixedCampaignBlock, true);
  for (const name of [
    'Google Sheets - Invoice Results Input', 'Google Sheets - Campaign Report Input', 'Prepare Campaign Lease',
    'Google Sheets - Campaign Lease Acquire', 'Google Sheets - Campaign Lease Verify', 'Verify Campaign Lease',
    'Google Sheets - Campaign Release Read', 'Prepare Campaign Lease Release', 'Google Sheets - Campaign Lease Release',
  ]) assert.ok(byName[name], name);

  assert.deepEqual(targets('Google Sheets - Retry Queue Input'), [['Prepare Invoice Results Read', 0]]);
  assert.deepEqual(targets('Prepare Invoice Results Read'), [['Google Sheets - Invoice Results Input', 0]]);
  assert.deepEqual(targets('Google Sheets - Invoice Results Input'), [['Prepare Campaign Report Read', 0]]);
  assert.deepEqual(targets('Prepare Campaign Report Read'), [['Google Sheets - Campaign Report Input', 0]]);
  assert.deepEqual(targets('Google Sheets - Campaign Report Input'), [['Prepare Account Report Read', 0]]);
  assert.match(byName['Build Durable Work Items'].parameters.jsCode, /Google Sheets - Invoice Results Input/);
  assert.match(byName['Build Durable Work Items'].parameters.jsCode, /Google Sheets - Campaign Report Input/);
  assert.match(byName['Build Durable Work Items'].parameters.jsCode, /Mixed pending campaigns found/);

  assert.deepEqual(targets('Attach Provider Library'), [['Prepare Campaign Lease', 0]]);
  assert.deepEqual(targets('Prepare Campaign Lease'), [['Google Sheets - Campaign Lease Acquire', 0]]);
  assert.deepEqual(targets('Google Sheets - Campaign Lease Acquire'), [['Prepare Campaign Lease Verify Read', 0]]);
  assert.deepEqual(targets('Prepare Campaign Lease Verify Read'), [['Google Sheets - Campaign Lease Verify', 0]]);
  assert.deepEqual(targets('Google Sheets - Campaign Lease Verify'), [['Verify Campaign Lease', 0]]);
  assert.deepEqual(targets('Verify Campaign Lease'), [['Loop Over Recipient Jobs', 0]]);
  assert.deepEqual(targets('Campaign Complete'), [['Prepare Campaign Release Read', 0]]);
  assert.deepEqual(targets('Google Sheets - Campaign Lease Release'), [['Campaign Released', 0]]);
  assert.deepEqual(targets('Restore Processing Context'), [['Provider Selector', 1]]);

  for (const name of ['Google Sheets - Campaign Lease Acquire', 'Google Sheets - Campaign Report', 'Repair Campaign Report Row', 'Google Sheets - Campaign Lease Release']) {
    const mapped = byName[name].parameters.columns.value;
    for (const field of ['Run_State', 'Run_ID', 'Lock_Acquired_At', 'Lock_Expires_At', 'Revision', 'Last_Attempt_At']) assert.ok(field in mapped, `${name}:${field}`);
  }
});

test('v2.1.1 Phase 02 campaign template contract includes lease and revision columns', () => {
  const header = fs.readFileSync(path.join(root, 'template/providers/odoo/campaign_report.csv'), 'utf8').trim().split(',');
  for (const field of ['Run_State', 'Run_ID', 'Lock_Acquired_At', 'Lock_Expires_At', 'Revision', 'Last_Attempt_At']) assert.ok(header.includes(field), field);
  const fixer = fs.readFileSync(path.join(root, 'template/providers/odoo/google-sheets/auto-fix-invoice-results-headers.gs'), 'utf8');
  for (const field of ['Run_State', 'Run_ID', 'Lock_Acquired_At', 'Lock_Expires_At', 'Revision', 'Last_Attempt_At']) assert.match(fixer, new RegExp(`"${field}"`));
});


test('v2.1.1 Phase 05 Email List emits immutable Row_ID and derives new Job_ID from it', () => {
  const source = fs.readFileSync(path.join(root, 'nodes/04_EmailList/EmailList.execute.ts'), 'utf8');
  assert.match(source, /ROW-\$\{stableHash/);
  assert.match(source, /JOB-\$\{stableHash\(`\$\{campaignId\}:\$\{rowId\}`\)\}/);
  assert.match(source, /toFiniteNumber\(item\.json\.row_number/);
  assert.match(source, /rowId, sourceRow/);
});

test('v2.1.1 Phase 05 canonical workflow writes PROVIDER_PENDING before Invoice Sender and completes the same operation envelope', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const name of ['Prepare Provider Operation Envelope','Google Sheets - Provider Operation Envelope','Restore Provider Operation Context']) assert.equal(names.has(name), true);
  assert.equal(workflow.connections['Restore Allocation Checkpoint Context'].main[0][0].node, 'Request Builder');
  assert.equal(workflow.connections['Request Builder'].main[0][0].node, 'Google Sheets - Provider Lease Verify');
  assert.equal(workflow.connections['Google Sheets - Provider Lease Verify'].main[0][0].node, 'Verify Provider Lease Before Side Effect');
  assert.equal(workflow.connections['Verify Provider Lease Before Side Effect'].main[0][0].node, 'Prepare Provider Operation Envelope');
  assert.equal(workflow.connections['Restore Provider Operation Context'].main[0][0].node, 'Invoice Sender');
  const prep = workflow.nodes.find((node) => node.name === 'Prepare Provider Operation Envelope').parameters.jsCode;
  assert.match(prep, /Operation_State:'PROVIDER_PENDING'/);
  assert.match(prep, /ready\.invoice/);
  assert.match(prep, /cannot enter PROVIDER_PENDING without a stable provider reference/);
  const result = workflow.nodes.find((node) => node.name === 'Prepare Pending Writeback Bundle').parameters.jsCode;
  assert.match(result, /Operation_State:'PROVIDER_RESULT'/);
  const complete = workflow.nodes.find((node) => node.name === 'Prepare Writeback Bundle Complete').parameters.jsCode;
  assert.match(complete, /Operation_State:'COMPLETE'/);
});

test('v2.1.1 Phase 05 recipient and provider writes match immutable Row_ID and Profile_ID', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(byName['Google Sheets - Persist Job Identity'].parameters.operation, 'update');
  assert.deepEqual(byName['Google Sheets - Persist Job Identity'].parameters.columns.matchingColumns, ['row_number']);
  assert.equal(byName['Google Sheets - Persist Job Identity'].parameters.columns.value.row_number, '={{ $json["row_number"] }}');
  assert.deepEqual(byName['Google Sheets - Recipient Status'].parameters.columns.matchingColumns, ['Row_ID']);
  assert.deepEqual(byName['Google Sheets - Provider Status'].parameters.columns.matchingColumns, ['Profile_ID']);
  assert.deepEqual(byName['Google Sheets - Preflight Provider Status'].parameters.columns.matchingColumns, ['Profile_ID']);
  const headers = fs.readFileSync(path.join(root, 'template/providers/odoo/writeback_queue.csv'), 'utf8').split(/\r?\n/)[0];
  for (const field of ['Operation_ID','Row_ID','Profile_ID','Stable_Reference','Lifecycle_Action','Operation_State','Checkpoint_JSON','Evidence_JSON']) assert.match(headers, new RegExp(field));
});



test('v2.1.1 final corrective audit bootstraps Row_ID on the exact Google Sheets row_number', async () => {
  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const emailContext = context([[{ json: { row_number: 17, Email: 'row-gap@example.com', status: 'PENDING', Campaign_ID: 'ROW-GAP-CAMPAIGN' } }]], {
    batchId: 'row-number-bootstrap', __executionId: 'row-number-bootstrap-exec', emailField: 'Email', nameField: 'Name', addressField: 'Address',
    nameGeneration: 'formatted', invalidPolicy: 'error', preserveCustomColumns: false, preventReuse: false,
  });
  const result = await loadEmails.call(emailContext);
  const entry = result[0][0].json;
  assert.equal(entry.job.sourceRow, 17);
  assert.equal(entry.recipientMeta.sourceRow, 17);
  assert.match(entry.job.rowId, /^ROW-/);
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.match(byName['Prepare Job Identity Row'].parameters.jsCode, /row_number:sourceRow/);
  assert.match(byName['Prepare Job Identity Row'].parameters.jsCode, /Google Sheets source row_number/);
});

test('v2.1.1 Phase 06 account aggregates advance monotonically and reset from a newer durable run seed', () => {
  const { updateCampaignAccountStats } = load('shared/runtime/RuntimeStore.js');
  const first = updateCampaignAccountStats({
    scopeKey: 'phase06-account', campaignId: 'campaign-a', profileId: 'profile-a', runId: 'run-a', eventId: 'event-1',
    seed: { Allocated: 4, Attempted: 4, Succeeded: 3, Revision: 9, Writer_Run_ID: 'run-old' },
    event: { Allocated: 1, Attempted: 1, Succeeded: 1, Updated_At: new Date().toISOString() },
  });
  assert.equal(first.Base_Revision, 9);
  assert.equal(first.Revision, 10);
  assert.equal(first.Allocated, 5);
  assert.equal(first.Writer_Run_ID, 'run-a');
  const second = updateCampaignAccountStats({
    scopeKey: 'phase06-account', campaignId: 'campaign-a', profileId: 'profile-a', runId: 'run-a', eventId: 'event-2',
    seed: { Allocated: 4, Revision: 9 }, event: { Attempted: 1 },
  });
  assert.equal(second.Base_Revision, 10);
  assert.equal(second.Revision, 11);
  assert.equal(second.Attempted, 6);
  const rebuilt = updateCampaignAccountStats({
    scopeKey: 'phase06-account', campaignId: 'campaign-a', profileId: 'profile-a', runId: 'run-b', eventId: 'event-3',
    seed: { Allocated: 20, Attempted: 20, Succeeded: 18, Revision: 20, Writer_Run_ID: 'run-b' },
    event: { Failed: 1 },
  });
  assert.equal(rebuilt.Base_Revision, 20);
  assert.equal(rebuilt.Revision, 21);
  assert.equal(rebuilt.Allocated, 20);
  assert.equal(rebuilt.Failed, 1);
  assert.equal(rebuilt.Aggregate_Source, 'DURABLE_ACCOUNT_REPORT_PLUS_EVENT');
});

test('v2.1.1 Phase 06 Campaign Store treats a new-run Sheet rebuild as authoritative instead of retaining stale maxima', async () => {
  const { admitCampaignJob } = load('shared/runtime/CampaignStore.js');
  const scopeKey = 'phase06-campaign-authoritative';
  const lease = (runId, revision, sent) => ({
    schemaVersion: '2.0', source: 'sheets-rebuild', authoritative: true, campaignId: 'campaign-a', totalItems: 3,
    admittedJobIds: [], terminalJobIds: [], sent, queued: 0, failed: 0, manualReview: 0, duplicate: 0, completed: 0,
    retrying: 0, failover: 0, runState: 'ACTIVE', runId, writerRunId: runId,
    lockAcquiredAt: new Date().toISOString(), lockExpiresAt: new Date(Date.now() + 60_000).toISOString(), revision,
    aggregateSource: 'DURABLE_SHEET_REBUILD', updatedAt: new Date().toISOString(),
  });
  const base = { enabled: true, totalItems: 3, maxItems: 10, maxFailures: 5, delayBetweenSendsMs: 0, stopOnCriticalError: true, requireRunLease: true, leaseDurationMs: 60_000 };
  const first = await admitCampaignJob(context([[]], {}), { scopeKey, campaignId: 'campaign-a', jobId: 'JOB-A', config: { ...base, runId: 'run-a', seed: lease('run-a', 20, 8) } });
  assert.equal(first.sent, 8);
  const rebuilt = await admitCampaignJob(context([[]], {}), { scopeKey, campaignId: 'campaign-a', jobId: 'JOB-B', config: { ...base, runId: 'run-b', seed: lease('run-b', 5, 1) } });
  assert.equal(rebuilt.sent, 1);
  assert.equal(rebuilt.writerRunId, 'run-b');
  assert.equal(rebuilt.aggregateSource, 'DURABLE_SHEET_REBUILD_PLUS_RUNTIME_EVENT');
});

test('v2.1.1 Phase 06 workflow enforces revision read-verify-write gates for campaign and account reports', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const target = (name) => workflow.connections[name]?.main?.[0]?.[0]?.node;
  assert.equal(workflow.meta.invoiceRouterMonotonicReporting, true);
  assert.equal(workflow.meta.invoiceRouterStaleWriterProtection, true);
  assert.equal(target('Prepare Campaign Report Event'), 'Google Sheets - Campaign Report Revision Read');
  assert.equal(target('Google Sheets - Campaign Report Revision Read'), 'Verify Campaign Report Revision');
  assert.equal(target('Verify Campaign Report Revision'), 'Google Sheets - Campaign Report');
  assert.equal(target('Prepare Account Report Event'), 'Google Sheets - Account Report Revision Read');
  assert.equal(target('Google Sheets - Account Report Revision Read'), 'Verify Account Report Revision');
  assert.equal(target('Verify Account Report Revision'), 'Google Sheets - Account Report');
  assert.match(byName['Verify Campaign Report Revision'].parameters.jsCode, /current!==base\|\|next!==base\+1/);
  assert.match(byName['Verify Account Report Revision'].parameters.jsCode, /stale writer rejected/);
  for (const name of ['Google Sheets - Campaign Report','Repair Campaign Report Row','Google Sheets - Campaign Lease Acquire','Google Sheets - Campaign Lease Release']) {
    for (const field of ['Base_Revision','Revision','Writer_Run_ID','Aggregate_Source']) assert.ok(field in byName[name].parameters.columns.value, `${name}:${field}`);
  }
  for (const name of ['Google Sheets - Account Report','Repair Account Report Row']) {
    for (const field of ['Base_Revision','Revision','Writer_Run_ID','Aggregate_Source']) assert.ok(field in byName[name].parameters.columns.value, `${name}:${field}`);
  }
});

test('v2.1.1 Phase 06 rebuilds campaign aggregates from durable recipient, result, and queue evidence', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const code = workflow.nodes.find((node) => node.name === 'Build Durable Work Items').parameters.jsCode;
  assert.match(code, /source:'sheets-rebuild'/);
  assert.match(code, /aggregateSource:'DURABLE_SHEET_REBUILD'/);
  assert.match(code, /totalItems:campaignEmailRows\.length/);
  assert.match(code, /sent:counts\.sent/);
  assert.match(code, /campaignQueueRows\.reduce/);
  assert.doesNotMatch(code, /Math\.max\(counts\.sent,number\(report\.Sent\)\)/);
  const repair = workflow.nodes.find((node) => node.name === 'Build Writeback Repair Items').parameters.jsCode;
  assert.match(repair, /next<=present/);
  assert.match(repair, /revision gap/);
  assert.match(repair, /repairSkippedAsStale:true/);
});

test('v2.1.1 Phase 06 persists issuer mismatch evidence in the revisioned account report contract', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  for (const name of ['Google Sheets - Issuer Mismatch Account Report Read','Prepare Issuer Mismatch Account Report','Google Sheets - Issuer Mismatch Account Report']) assert.ok(byName[name], name);
  assert.match(byName['Prepare Issuer Mismatch Account Report'].parameters.jsCode, /ISSUER_MISMATCH/);
  assert.match(byName['Prepare Issuer Mismatch Account Report'].parameters.jsCode, /ODOO_PREFLIGHT_ISSUER_EVIDENCE/);
  const accountHeader = fs.readFileSync(path.join(root, 'template/providers/odoo/account_report.csv'), 'utf8').split(/\r?\n/)[0].split(',');
  for (const field of ['Issuer_Key','Company_ID','Company_Name','Issuer_Compatibility','Issuer_Mismatch','Base_Revision','Revision','Writer_Run_ID','Aggregate_Source']) assert.ok(accountHeader.includes(field), field);
  const campaignHeader = fs.readFileSync(path.join(root, 'template/providers/odoo/campaign_report.csv'), 'utf8').split(/\r?\n/)[0].split(',');
  for (const field of ['Base_Revision','Writer_Run_ID','Aggregate_Source']) assert.ok(campaignHeader.includes(field), field);
});

test('v2.1.1 Phase 07 short-secret redaction preserves ordinary text and redacts bounded values', () => {
  const { redactString, redactJson } = load('shared/security/Redaction.js');
  assert.equal(
    redactString('Database allocation failed for worker alpha.', ['a']),
    'Database allocation failed for worker alpha.',
  );
  assert.equal(redactString('token=a; database=alpha', ['a']), 'token=[REDACTED]; database=alpha');
  assert.equal(redactString('api_key=xy, proxy=ready', ['xy']), 'api_key=[REDACTED], proxy=ready');
  assert.equal(redactString('credential=***; message=healthy', ['***']), 'credential=[REDACTED]; message=healthy');
  const redacted = redactJson({ error: 'database alpha', apiKey: 'a', nested: { detail: 'token=a' } }, ['a']);
  assert.equal(redacted.error, 'database alpha');
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.nested.detail, 'token=[REDACTED]');
});

test('v2.1.1 Phase 07 separate-process restart and other-worker regression rehydrates provider pool and vault from a 66-second resume marker', () => {
  const helper = path.join(root, 'tests/helpers/phase07-runtime-worker.cjs');
  const runWorker = (worker, execution) => JSON.parse(execFileSync(process.execPath, [helper, worker, execution, 'phase07-restart-batch'], { encoding: 'utf8' }));
  const first = runWorker('worker-a', 'execution-a');
  const second = runWorker('worker-b', 'execution-b');
  assert.notEqual(first.pid, second.pid);
  assert.equal(first.resumeAfterSeconds, 66);
  assert.equal(second.resumeAfterSeconds, 66);
  assert.equal(first.profileId, second.profileId);
  assert.equal(first.secretAvailable, true);
  assert.equal(second.secretAvailable, true);
  assert.equal(first.allocationStatus, 'ALLOCATED');
  assert.equal(second.allocationStatus, 'ALLOCATED');
  assert.equal(first.allocationProfileId, first.profileId);
  assert.equal(second.allocationProfileId, second.profileId);
  assert.equal(first.sanitizedLibrary, true);
  assert.equal(second.sanitizedLibrary, true);
});

test('v2.1.1 Phase 07 n8n 2.31.6 engine fixture is dry-run-only and contains the frozen eight custom nodes', () => {
  const fixturePath = path.join(root, 'tests/fixtures/n8n/InvoiceRouter-Phase-07-Engine-Smoke.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const custom = fixture.nodes.filter((node) => String(node.type).startsWith('n8n-nodes-invoicerouter.'));
  assert.equal(fixture.meta.invoiceRouterEngineTarget, '2.31.6');
  assert.equal(fixture.meta.invoiceRouterEngineSmoke, true);
  assert.equal(fixture.meta.sideEffects, 'dry-run-only');
  assert.equal(custom.length, 8);
  assert.equal(new Set(custom.map((node) => node.type)).size, 8);
  assert.equal(fixture.nodes.find((node) => node.name === 'Invoice Sender').parameters.dryRun, true);
  const script = fs.readFileSync(path.join(root, 'scripts/phase07-n8n-engine-smoke.mjs'), 'utf8');
  assert.match(script, /TARGET_N8N_VERSION = '2\.31\.6'/);
  assert.match(script, /'execute', '--file'/);
  assert.match(script, /N8N_CUSTOM_EXTENSIONS/);
  assert.match(script, /npm_execpath/);
  assert.match(script, /process\.execPath/);
  assert.match(script, /'import:workflow'/);
  assert.match(script, /'export:workflow'/);
  assert.doesNotMatch(script, /spawnSync\(['"](?:npm|npx)\.cmd/);
});

async function runPhase07OdooFixture(fixture) {
  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const preflightResponses = odooPreflightResponses(fixture.majorVersion, fixture.company.id, fixture.company.name);
  preflightResponses[0] = { result: { server_version: fixture.serverVersion } };
  const preflight = await loadProviders.call(context([[{ json: fixture.provider }]], {
    batchId: `phase07-preflight-${fixture.majorVersion}`, sourceName: 'provider', duplicatePolicy: 'error', includeDisabled: false, strictValidation: true,
    enableOdooPreflight: true, preflightCurrency: fixture.company.currency, preflightCheckPermissions: true, preflightFailurePolicy: 'excludeAndReport',
  }, preflightResponses));

  const { execute: loadEmails } = load('nodes/04_EmailList/EmailList.execute.js');
  const emails = await loadEmails.call(context([[{ json: fixture.recipient }]], {
    batchId: `phase07-email-${fixture.majorVersion}`, statusField: 'status', jobIdField: 'Job_ID', campaignIdField: 'Campaign_ID',
    emailField: 'Email', nameField: 'Name', addressField: 'Address', nameGeneration: 'formatted', invalidPolicy: 'error', preserveCustomColumns: true, preventReuse: false,
  }));
  const { execute: createTemplate } = load('nodes/03_InvoiceTemplate/InvoiceTemplate.execute.js');
  const template = await createTemplate.call(context([[{ json: {} }]], {
    templateMode: 'manual', invoiceId: fixture.odoo.invoiceRef, invoiceNumber: fixture.odoo.invoiceRef,
    invoiceDate: '2026-08-04', dueDate: '2026-09-03', currency: fixture.company.currency,
    lineItemsJson: '[{"name":"Phase 07 Service","description":"Odoo fixture","quantity":1,"unit_price":100}]',
    tax: 0, discount: 0, shipping: 0, paymentTerms: 'Net 30', notes: 'Phase 07 fixture', customFieldsJson: '{}', strictValidation: true,
  }));
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const allocations = await selectProvider.call(context([preflight[0], emails[0]], {
    strategy: 'firstAvailable', processingMode: 'sequential', __executionId: `phase07-${fixture.majorVersion}`,
    providerFilter: 'odoo', actionFilter: '', environmentFilter: 'live', queueWhenUnavailable: true,
    conditionalRouting: false, routeProviderPath: 'recipient.customFields.Provider', routeActionPath: 'recipient.customFields.Action',
    routeEnvironmentPath: 'recipient.customFields.Environment', routingRulesJson: '[]', requireConditionalMatch: false,
    unmatchedRouteBehavior: 'block', lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
  }));
  const { execute: buildRequest } = load('nodes/05_RequestBuilder/RequestBuilder.execute.js');
  const built = await buildRequest.call(context([allocations[0], template[0], emails[0]], {
    strictProviderWarnings: false, strictProviderValidation: true, sendGuardMode: 'audit', customBodyJson: '{}', extraHeadersJson: '{}',
    extraQueryJson: '{}', idempotencyHeader: 'Idempotency-Key', idempotencyKeyMode: 'campaignJob', idempotencyScope: 'workflow', allowHttp: false,
  }));
  const prepared = { emails, template, allocations, built };
  const responses = odooEmailResponses({
    emailTo: fixture.recipient.Email,
    invoicePdfReportId: [fixture.odoo.attachmentId, `${fixture.odoo.invoiceName.replaceAll('/', '_')}.pdf`],
    attachmentRecords: [{ id: fixture.odoo.attachmentId, name: `${fixture.odoo.invoiceName.replaceAll('/', '_')}.pdf`, mimetype: 'application/pdf', res_model: 'account.move', res_id: fixture.odoo.invoiceId, type: 'binary' }],
  });
  responses[0].body.result = fixture.odoo.uid;
  responses[2].body.result = fixture.odoo.partnerId;
  responses[3].body.result = [{ id: fixture.odoo.currencyId, name: fixture.company.currency, active: true }];
  responses[4].body.result = fixture.odoo.invoiceId;
  responses[7].body.result = fixture.odoo.wizardId;
  responses[8].body.result[0] = {
    ...responses[8].body.result[0],
    id: fixture.odoo.wizardId,
    move_id: [fixture.odoo.invoiceId, fixture.odoo.invoiceName],
    ...fixture.odoo.wizardFields,
  };
  responses[10].body.result[0].id = fixture.odoo.messageId;
  responses[10].body.result[0].attachment_ids = [fixture.odoo.attachmentId];
  responses[11].body.result[0].id = fixture.odoo.notificationId;
  responses[11].body.result[0].mail_message_id = [fixture.odoo.messageId, 'Invoice'];
  responses[12].body.result = [{ id: fixture.odoo.mailId, state: 'sent', failure_type: false, failure_reason: '', email_to: fixture.recipient.Email, recipient_ids: [fixture.odoo.partnerId], mail_message_id: [fixture.odoo.messageId, 'Invoice'] }];
  responses[13].body.result[0] = { id: fixture.odoo.invoiceId, name: fixture.odoo.invoiceName, state: 'posted', ref: fixture.odoo.invoiceRef, partner_id: [fixture.odoo.partnerId, fixture.recipient.Name], currency_id: [fixture.odoo.currencyId, fixture.company.currency], invoice_pdf_report_id: [fixture.odoo.attachmentId, `${fixture.odoo.invoiceName.replaceAll('/', '_')}.pdf`] };

  const { execute: sendInvoice } = load('nodes/06_InvoiceSender/InvoiceSender.execute.js');
  const senderContext = context([prepared.built[0]], {
    dryRun: false, includeResponseBody: true, requireSendGuard: true, activationSafetyMode: 'liveRealSend', expectedEnvironment: 'live', liveModeConfirmation: 'SEND_REAL_INVOICES', preventDuplicateSends: false, stopOnTransportError: false,
  }, responses);
  const sent = await sendInvoice.call(senderContext);
  const { execute: checkStatus } = load('nodes/07_StatusChecker/StatusChecker.execute.js');
  const checked = await checkStatus.call(context([sent[0]], { includeParsedMetadata: true, unknownSuccessStatus: 'CREATED' }));
  const { execute: manageStatus } = load('nodes/08_StatusManager/StatusManager.execute.js');
  const managed = await manageStatus.call(context([checked[0]], {
    retryLimit: 3, retryBaseDelaySeconds: 30, retryMaxDelaySeconds: 900, respectRetryAfterHeader: true, cooldownSeconds: 30, disableOnAuthFailure: true, alertOnFailure: true, includeEvents: true,
    includeExecutionLog: true, persistExecutionLog: false, executionLogRetention: 50, includeStatusWriteback: true, writebackTarget: 'invoice_results', writebackKeyMode: 'requestId',
  }));
  return { preflight, prepared, sent, checked, managed, senderContext };
}

test('v2.1.1 Phase 07 Odoo 18 and Odoo 19 fixtures exercise preflight, invoice, wizard, evidence, checker, and manager end-to-end', async () => {
  for (const name of ['odoo-18-phase07-e2e.json', 'odoo-19-phase07-e2e.json']) {
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/odoo', name), 'utf8'));
    const result = await runPhase07OdooFixture(fixture);
    const preflight = result.preflight[0][0].json;
    assert.equal(preflight.total, 1);
    assert.equal(preflight.providers[0].odooMajorVersion, fixture.majorVersion);
    assert.equal(preflight.providers[0].odooCapabilityProfileId, fixture.expected.capabilityProfileId);
    assert.equal(preflight.preflightResults[0].Capability_Status, fixture.expected.capabilityStatus);
    const lifecycle = result.sent[0][0].json.rawExecution.responseBody.result.lifecycle;
    assert.equal(String(lifecycle.postStatus).toLowerCase(), fixture.expected.invoiceState);
    assert.equal(lifecycle.emailSendStatus, fixture.expected.emailSendStatus);
    assert.equal(lifecycle.emailEvidence.pdfEvidence.status, fixture.expected.pdfEvidenceStatus);
    assert.equal(result.sent[0][0].json.rawExecution.httpStatus, fixture.expected.httpStatus);
    assert.equal(result.checked[0][0].json.standardStatus.result, 'SUCCESS');
    assert.equal(result.managed[0][0].json.management.retryScheduled, false);
    const calls = result.senderContext.calls.map(odooRpcCall);
    assert.equal(calls.filter((call) => call.model === 'account.move' && call.method === 'create').length, 1);
    assert.equal(calls.filter((call) => call.model === 'account.move' && call.method === 'action_post').length, 1);
    assert.equal(calls.filter((call) => call.model === 'account.move.send.wizard' && call.method === 'create').length, 1);
    assert.equal(calls.filter((call) => call.model === 'account.move.send.wizard' && call.method === 'action_send_and_print').length, 1);
    for (const field of fixture.expected.wizardVersionFields) assert.ok(field in responsesForWizard(result.senderContext.calls, fixture.odoo.wizardId, fixture.odoo.wizardFields));
    assert.doesNotMatch(JSON.stringify(result.sent), /phase07-odoo-secret/);
  }
});

function responsesForWizard(_calls, _wizardId, wizardFields) {
  return wizardFields;
}


test('v2.1.1 final corrective audit reconciles PROVIDER_PENDING with exact stable reference before any new provider call', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  const durable = byName['Build Durable Work Items'].parameters.jsCode;
  assert.match(durable, /providerPendingByJob/);
  assert.match(durable, /operationRecovery:providerPending/);
  assert.match(durable, /latestWritebackByRepair/);
  assert.match(durable, /Stable_Reference/);
  const envelope = byName['Prepare Provider Operation Envelope'].parameters.jsCode;
  assert.match(envelope, /ready\.invoice/);
  assert.match(envelope, /bodyInvoice\.invoice_number/);
  assert.match(envelope, /cannot enter PROVIDER_PENDING without a stable provider reference/);
  const emailSource = fs.readFileSync(path.join(root, 'nodes/04_EmailList/EmailList.execute.ts'), 'utf8');
  const builderSource = fs.readFileSync(path.join(root, 'nodes/05_RequestBuilder/RequestBuilder.execute.ts'), 'utf8');
  const senderSource = fs.readFileSync(path.join(root, 'nodes/06_InvoiceSender/InvoiceSender.execute.ts'), 'utf8');
  assert.match(emailSource, /operationRecovery/);
  assert.match(builderSource, /recoveryStableReference/);
  assert.match(senderSource, /'PROVIDER_PENDING'/);
});

test('v2.1.1 final corrective audit reconstructs an unresolved PROVIDER_PENDING row as a reconciliation run', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const code = workflow.nodes.find((node) => node.name === 'Build Durable Work Items').parameters.jsCode;
  const rows = {
    'Google Sheets - Email List': [{ json: { Email: 'recover@example.com', Name: 'Recover', status: 'PROCESSING', Job_ID: 'JOB-RECOVER', Campaign_ID: 'CAMPAIGN-RECOVER', Row_ID: 'ROW-RECOVER' } }],
    'Google Sheets - Retry Queue Input': [],
    'Google Sheets - Invoice Results Input': [],
    'Google Sheets - Campaign Report Input': [{ json: { Report_Key: 'CAMPAIGN-RECOVER', Campaign_ID: 'CAMPAIGN-RECOVER', Run_State: 'ACTIVE', Run_ID: 'RUN-RECOVER', Revision: 3, Lock_Expires_At: '2099-01-01T00:00:00.000Z' } }],
    'Google Sheets - Writeback Queue Input': [{ json: { Repair_ID: 'OP:CAMPAIGN-RECOVER:JOB-RECOVER', Operation_ID: 'OP:CAMPAIGN-RECOVER:JOB-RECOVER', Campaign_ID: 'CAMPAIGN-RECOVER', Job_ID: 'JOB-RECOVER', Row_ID: 'ROW-RECOVER', Profile_ID: 'PROFILE-RECOVER', Stable_Reference: 'CAMPAIGN-RECOVER-JOB-RECOVER', Operation_State: 'PROVIDER_PENDING', Queue_Status: 'PROVIDER_PENDING', Checkpoint_JSON: '{}', Updated_At: '2026-08-04T00:00:00.000Z' } }],
  };
  const executeCode = new Function('items', '$items', code);
  const output = executeCode([], (name) => rows[name] ?? []);
  assert.equal(output.length, 1);
  const state = output[0].json.invoiceRouterState;
  assert.equal(state.retryCount, 1);
  assert.equal(state.failoverState.queueStatus, 'PROVIDER_PENDING');
  assert.equal(state.failoverState.requiredProfileId, 'PROFILE-RECOVER');
  assert.equal(state.operationRecovery.stableReference, 'CAMPAIGN-RECOVER-JOB-RECOVER');
  assert.equal(state.operationRecovery.profileId, 'PROFILE-RECOVER');
});

test('v2.1.1 final corrective audit ignores a stale duplicate PROVIDER_PENDING row when the latest operation row is COMPLETE', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const code = workflow.nodes.find((node) => node.name === 'Build Durable Work Items').parameters.jsCode;
  const rows = {
    'Google Sheets - Email List': [{ json: { Email: 'complete@example.com', Name: 'Complete', status: 'PENDING', Job_ID: 'JOB-COMPLETE', Campaign_ID: 'CAMPAIGN-COMPLETE', Row_ID: 'ROW-COMPLETE' } }],
    'Google Sheets - Retry Queue Input': [],
    'Google Sheets - Invoice Results Input': [],
    'Google Sheets - Campaign Report Input': [{ json: { Report_Key: 'CAMPAIGN-COMPLETE', Campaign_ID: 'CAMPAIGN-COMPLETE', Run_State: '', Run_ID: '', Revision: 4 } }],
    'Google Sheets - Writeback Queue Input': [
      { json: { Repair_ID: 'OP:CAMPAIGN-COMPLETE:JOB-COMPLETE', Operation_ID: 'OP:CAMPAIGN-COMPLETE:JOB-COMPLETE', Job_ID: 'JOB-COMPLETE', Profile_ID: 'PROFILE-COMPLETE', Stable_Reference: 'CAMPAIGN-COMPLETE-JOB-COMPLETE', Operation_State: 'PROVIDER_PENDING', Queue_Status: 'PROVIDER_PENDING', Updated_At: '2026-08-04T00:00:00.000Z' } },
      { json: { Repair_ID: 'OP:CAMPAIGN-COMPLETE:JOB-COMPLETE', Operation_ID: 'OP:CAMPAIGN-COMPLETE:JOB-COMPLETE', Job_ID: 'JOB-COMPLETE', Operation_State: 'COMPLETE', Queue_Status: 'COMPLETED', Updated_At: '2026-08-04T00:01:00.000Z' } },
    ],
  };
  const executeCode = new Function('items', '$items', code);
  const output = executeCode([], (name) => rows[name] ?? []);
  assert.equal(output.length, 1);
  assert.equal(output[0].json.invoiceRouterState.operationRecovery, null);
  assert.equal(output[0].json.invoiceRouterState.retryCount, 0);
});

test('v2.1.1 final corrective audit preserves operation envelope Created_At across result and completion updates', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const resultCode = workflow.nodes.find((node) => node.name === 'Prepare Pending Writeback Bundle').parameters.jsCode;
  const completeCode = workflow.nodes.find((node) => node.name === 'Prepare Writeback Bundle Complete').parameters.jsCode;
  assert.match(resultCode, /Created_At:String\(item\.json\.Created_At\|\|managedAt\)/);
  assert.match(completeCode, /Created_At:String\(item\.json\.Created_At/);
  assert.doesNotMatch(completeCode, /Created_At:''/);
});

test('v2.1.1 final corrective audit rereads and verifies the campaign lease immediately before every provider envelope and send', () => {
  const workflow = JSON.parse(fs.readFileSync(path.join(root, 'template/providers/odoo/n8n-import-workflow-production-v2.1.1.json'), 'utf8'));
  const byName = Object.fromEntries(workflow.nodes.map((node) => [node.name, node]));
  assert.equal(workflow.nodes.length, 126);
  let edges = 0;
  for (const value of Object.values(workflow.connections)) for (const groups of Object.values(value)) for (const group of groups) edges += group.length;
  assert.equal(edges, 141);
  assert.equal(byName['Google Sheets - Provider Lease Verify'].parameters.operation, 'read');
  assert.equal(byName['Google Sheets - Provider Lease Verify'].retryOnFail, true);
  assert.equal(byName['Google Sheets - Provider Lease Verify'].maxTries, 3);
  const verify = byName['Verify Provider Lease Before Side Effect'].parameters.jsCode;
  assert.match(verify, /Run_State/);
  assert.match(verify, /Run_ID/);
  assert.match(verify, /Lock_Expires_At/);
  assert.equal(workflow.connections['Request Builder'].main[0][0].node, 'Google Sheets - Provider Lease Verify');
  assert.equal(workflow.connections['Verify Provider Lease Before Side Effect'].main[0][0].node, 'Prepare Provider Operation Envelope');
  assert.equal(workflow.connections['Restore Provider Operation Context'].main[0][0].node, 'Invoice Sender');
});

test('v2.1.1 final corrective audit hardens evidence binding and tag release publication', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/phase07-final-release-gate.mjs'), 'utf8');
  for (const fragment of ['engineBindingSha256', 'packageContentSha256', 'canonicalWorkflowSha256', 'campaignIdHash', 'recipientHash', 'evidenceArtifacts', 'reviewedBy', 'reviewedAt', 'issuerMismatchBlocked', 'rowIdCollisionCount', 'profileIdMismatchCount']) {
    assert.match(gate, new RegExp(fragment));
  }
  assert.match(gate, /Evidence must not contain an email address/);
  assert.match(gate, /deterministic engine binding/);
  assert.doesNotMatch(gate, /canary\.engineEvidenceSha256/);
  const release = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(release, /NPM_TOKEN is required for a tag release/);
  assert.match(release, /npm whoami --registry=https:\/\/registry\.npmjs\.org/);
  assert.ok(release.indexOf('Validate npm publication credentials') < release.indexOf('Create GitHub Release'));
  const canary = JSON.parse(fs.readFileSync(path.join(root, 'evidence/phase07/canary-evidence.template.json'), 'utf8'));
  const pilot = JSON.parse(fs.readFileSync(path.join(root, 'evidence/phase07/pilot-evidence.template.json'), 'utf8'));
  assert.equal(canary.schemaVersion, '1.2');
  assert.equal(pilot.schemaVersion, '1.2');
  assert.ok('engineBindingSha256' in canary && 'packageContentSha256' in canary && 'canonicalWorkflowSha256' in canary);
  assert.equal('engineEvidenceSha256' in canary, false);
  assert.equal('packageTarballSha256' in canary, false);
  assert.ok('issuerMismatchBlocked' in pilot && 'rowIdCollisionCount' in pilot && 'profileIdMismatchCount' in pilot);
});

test('v2.1.1 final corrective audit verifies referenced sanitized evidence artifact files', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/phase07-final-release-gate.mjs'), 'utf8');
  assert.match(gate, /evidence\/phase07\/artifacts/);
  assert.match(gate, /artifact hash mismatch/);
  assert.match(gate, /allowedExtensions/);
  assert.match(gate, /await validateArtifacts\(canary\.evidenceArtifacts/);
  assert.match(gate, /await validateArtifacts\(pilot\.evidenceArtifacts/);
});

test('v2.1.1 final corrective audit enforces cross-platform LF package determinism', () => {
  const attributes = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8');
  const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.equal(tsconfig.compilerOptions.newLine, 'lf');
});

test('v2.1.1 exact engine harness imports the unchanged canonical workflow through n8n separate mode', () => {
  const engine = fs.readFileSync(path.join(root, 'scripts/phase07-n8n-engine-smoke.mjs'), 'utf8');
  assert.match(engine, /const canonicalImportDir = join\(tempRoot, 'canonical-import'\)/);
  assert.match(engine, /writeFile\(join\(canonicalImportDir, basename\(canonicalPath\)\), canonicalBytes\)/);
  assert.match(engine, /'import:workflow', '--separate', '--input', canonicalImportDir/);
  assert.doesNotMatch(engine, /'import:workflow', '--input', canonicalPath/);
});

test('v2.1.1 Phase 07 static final-release gate validates the frozen release prerequisites without fabricating live evidence', () => {
  const output = execFileSync(process.execPath, [path.join(root, 'scripts/phase07-final-release-gate.mjs'), '--static-only'], { encoding: 'utf8' });
  assert.match(output, /static final-release prerequisites PASS/);
  assert.match(output, /Live canary\/pilot evidence remains intentionally PENDING/);
});
