const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
function load(relative) {
  return require(path.join(root, 'dist', relative));
}

function context(inputs, parameters = {}) {
  const staticData = {};
  return {
    getInputData(index = 0) { return inputs[index] ?? []; },
    getNodeParameter(name, _itemIndex, fallback) {
      return Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : fallback;
    },
    continueOnFail() { return false; },
    getNode() { return { name: parameters.__nodeName ?? 'Phase 07 Runtime Worker' }; },
    getExecutionId() { return parameters.__executionId ?? 'phase07-worker-execution'; },
    getWorkflow() { return { id: 'phase07-workflow', name: 'InvoiceRouter Phase 07 Worker Regression' }; },
    getWorkflowStaticData() { return staticData; },
    helpers: { async httpRequest() { throw new Error('HTTP is not expected in the runtime rehydration probe.'); } },
  };
}

async function main() {
  const workerId = process.argv[2] || 'worker-unknown';
  const executionId = process.argv[3] || `execution-${workerId}`;
  const batchId = process.argv[4] || 'phase07-restart-batch';
  const jobId = 'JOB-PHASE07-RESTART-001';
  const marker = {
    schemaVersion: '1.0',
    mode: 'retry',
    sourceNode: 'Wait Before Retry',
    resumeAfterSeconds: 66,
    resumedByWorker: workerId,
    context: {
      worker_id: workerId,
      recipient: { email: 'restart.worker@example.com', name: 'Restart Worker' },
      invoiceTemplate: { invoiceId: '#INV#', currency: 'USD' },
      job: {
        jobId,
        campaignId: 'phase07-restart-campaign',
        campaignSafety: { enabled: false },
      },
      failoverState: {
        failoverGroup: '', attemptedProfileIds: [], requiredProfileId: '',
        queueStatus: 'RETRY_WAIT', sideEffectStage: 'none',
      },
    },
  };
  const rows = [{ json: {
    Enabled: true,
    Provider: 'Custom',
    Account: 'Phase 07 Restart Account',
    Environment: 'Live',
    Action: 'Custom Request',
    Method: 'POST',
    'Base URL': 'https://api.example.test',
    Endpoint: '/invoices',
    'Auth Type': 'Bearer',
    'Content-Type': 'application/json',
    'Header Name': 'Authorization',
    'Header Value': 'Bearer {{API_KEY}}',
    'API Key': 'phase07-worker-secret',
    'API Secret': 'phase07-worker-api-secret',
    'Extra Value': 'phase07-worker-tenant',
    Timeout: 30,
    __invoiceRouterRehydration: marker,
  } }];

  const { execute: loadProviders } = load('nodes/01_ProviderLoader/ProviderLoader.execute.js');
  const libraryOutput = await loadProviders.call(context([rows], {
    batchId, __executionId: executionId, sourceName: 'provider', duplicatePolicy: 'error',
    includeDisabled: false, strictValidation: true,
  }));
  const library = libraryOutput[0][0].json;
  const profileId = library.providers[0].id;
  const scopeKey = library.runtime.scopeKey;
  const credentialRef = `${scopeKey}::${profileId}`;
  const { getSecretMaterial } = load('shared/runtime/RuntimeStore.js');
  const secretAvailable = Boolean(getSecretMaterial(credentialRef));

  const work = {
    json: {
      ...marker.context,
      worker_id: workerId,
      providerLibrary: library,
      failoverState: { ...marker.context.failoverState, requiredProfileId: profileId },
    },
  };
  const { execute: selectProvider } = load('nodes/02_ProviderSelector/ProviderSelector.execute.js');
  const selected = await selectProvider.call(context([[work]], {
    strategy: 'firstAvailable', processingMode: 'sequential', __executionId: executionId,
    providerFilter: 'custom', actionFilter: '', environmentFilter: 'live', queueWhenUnavailable: true,
    conditionalRouting: false, routeProviderPath: 'recipient.customFields.Provider',
    routeActionPath: 'recipient.customFields.Action', routeEnvironmentPath: 'recipient.customFields.Environment',
    routingRulesJson: '[]', requireConditionalMatch: false, unmatchedRouteBehavior: 'block',
    lockTimeoutSeconds: 300, maxRequestsPerMinute: 60, circuitBreakerThreshold: 5,
  }));
  const allocation = selected[0][0].json.providerAllocation;
  process.stdout.write(JSON.stringify({
    pid: process.pid,
    workerId,
    executionId,
    batchId,
    resumeAfterSeconds: marker.resumeAfterSeconds,
    profileId,
    scopeKey,
    credentialRef,
    secretAvailable,
    allocationStatus: allocation.status,
    allocationProfileId: allocation.id,
    allocationWorkerId: allocation.workerId,
    sanitizedLibrary: !JSON.stringify(library).includes('phase07-worker-secret'),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
