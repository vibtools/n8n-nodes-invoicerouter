const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));

function context(parameters, responses = []) {
  const calls = [];
  return {
    calls,
    getInputData() {
      return [
        {
          json: {
            invoice: {
              requestId: 'REQ-1001',
              provider: 'custom',
              customerName: 'Test Customer',
              customerEmail: 'customer@example.com',
              amount: 100,
              currency: 'USD',
              lineItems: [{ description: 'Service', quantity: 1, amount: 100 }],
              metadata: {},
            },
          },
        },
      ];
    },
    getNodeParameter(name, _itemIndex, fallback) {
      return Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : fallback;
    },
    async getCredentials() {
      return {
        baseUrl: 'https://api.example.test/v1',
        authType: 'bearer',
        bearerToken: 'secret-token',
        defaultHeaders: '{}',
        timeoutMs: 30000,
        allowHttp: false,
      };
    },
    continueOnFail() {
      return false;
    },
    getNode() {
      return { name: 'Invoice Sender' };
    },
    helpers: {
      async httpRequest(options) {
        calls.push(options);
        return responses[calls.length - 1] ?? {};
      },
    },
  };
}

test('package metadata and production assets are internally consistent', () => {
  assert.equal(packageJson.name, 'n8n-nodes-invoicerouter');
  assert.equal(packageJson.version, '1.1.0');
  assert.equal(packageJson.n8n.n8nNodesApiVersion, 1);
  assert.equal(packageJson.n8n.nodes.length, 5);
  assert.equal(packageJson.n8n.credentials.length, 1);
  assert.ok(fs.existsSync(path.join(root, 'workflows/google-sheets-real-invoice-router.json')));
});

test('all declared n8n build artifacts exist and export classes', () => {
  for (const relativePath of [...packageJson.n8n.credentials, ...packageJson.n8n.nodes]) {
    const fullPath = path.join(root, relativePath);
    assert.ok(fs.existsSync(fullPath), `${relativePath} is missing`);
    const exportsObject = require(fullPath);
    const classes = Object.values(exportsObject).filter((value) => typeof value === 'function');
    assert.ok(classes.length > 0, `${relativePath} exports no class`);
  }
});

test('invoice sender performs credential-backed create and send requests', async () => {
  const { execute } = require(path.join(root, 'dist/nodes/04_InvoiceSender/InvoiceSender.execute.js'));
  const mock = context(
    {
      operation: 'createAndSend',
      providerSource: 'input',
      dryRun: false,
      createEndpoint: '/invoices',
      createMethod: 'POST',
      createBodyMode: 'invoice',
      sendEndpoint: '/invoices/{invoiceId}/send',
      sendMethod: 'POST',
      sendBodyJson: '{}',
      extraHeadersJson: '{}',
      queryJson: '{}',
      idempotencyHeader: 'Idempotency-Key',
      invoiceIdPath: 'id',
      statusPath: 'status',
      invoiceUrlPath: 'hosted_invoice_url',
      pdfUrlPath: 'invoice_pdf',
      messagePath: 'message',
      includeRawResponse: false,
    },
    [
      { id: 'inv_1001', status: 'draft' },
      { id: 'inv_1001', status: 'sent', hosted_invoice_url: 'https://invoice.example.test/inv_1001' },
    ],
  );

  const result = await execute.call(mock);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[0].url, 'https://api.example.test/v1/invoices');
  assert.equal(mock.calls[0].headers.Authorization, 'Bearer secret-token');
  assert.equal(mock.calls[0].headers['Idempotency-Key'], 'REQ-1001');
  assert.equal(mock.calls[1].url, 'https://api.example.test/v1/invoices/inv_1001/send');
  assert.equal(result[0][0].json.invoiceResponse.success, true);
  assert.equal(result[0][0].json.invoiceResponse.invoiceId, 'inv_1001');
  assert.equal(result[0][0].json.invoiceResponse.status, 'sent');
});

test('invoice sender dry run never performs HTTP requests', async () => {
  const { execute } = require(path.join(root, 'dist/nodes/04_InvoiceSender/InvoiceSender.execute.js'));
  const mock = context({
    operation: 'create',
    providerSource: 'input',
    dryRun: true,
    createEndpoint: '/invoices',
    createMethod: 'POST',
    createBodyMode: 'invoice',
    extraHeadersJson: '{}',
    queryJson: '{}',
    idempotencyHeader: 'Idempotency-Key',
    includeRawResponse: false,
  });
  const result = await execute.call(mock);
  assert.equal(mock.calls.length, 0);
  assert.equal(result[0][0].json.invoiceResponse.status, 'dry_run');
});

test('main and declaration outputs exist', () => {
  assert.ok(fs.existsSync(path.join(root, packageJson.main)));
  assert.ok(fs.existsSync(path.join(root, packageJson.types)));
});
