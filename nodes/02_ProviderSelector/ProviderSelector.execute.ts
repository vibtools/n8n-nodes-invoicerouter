import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { allocateProvider, applyProviderFeedback, executionIdentity, publicPoolSnapshot, readPersistedFeedback, type AllocationStrategy } from '../../shared/runtime/RuntimeStore';
import { isRecord, slug, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const providerItems = this.getInputData(0);
  const workItems = this.getInputData(1);
  const library = providerItems.find((item) => Array.isArray(item.json.providers))?.json ?? providerItems[0]?.json ?? {};
  const batchId = toStringValue(library.batch_id, 'default');
  const runtime = isRecord(library.runtime) ? library.runtime : {};
  const identity = executionIdentity(this, batchId);
  const scopeKey = toStringValue(runtime.scopeKey, identity.scopeKey);
  const strategy = toStringValue(this.getNodeParameter('strategy', 0, 'firstAvailable')) as AllocationStrategy;
  const processingMode = toStringValue(this.getNodeParameter('processingMode', 0, 'sequential'));
  const filters: IDataObject = {
    providerId: slug(this.getNodeParameter('providerFilter', 0, '')),
    actionId: slug(this.getNodeParameter('actionFilter', 0, '')),
    environment: slug(this.getNodeParameter('environmentFilter', 0, '')),
  };
  const queueWhenUnavailable = Boolean(this.getNodeParameter('queueWhenUnavailable', 0, true));
  const lockTimeoutMs = Math.max(1, toFiniteNumber(this.getNodeParameter('lockTimeoutSeconds', 0, 300), 300)) * 1000;
  const maxRequestsPerMinute = Math.max(1, toFiniteNumber(this.getNodeParameter('maxRequestsPerMinute', 0, 60), 60));
  const circuitBreakerThreshold = Math.max(1, toFiniteNumber(this.getNodeParameter('circuitBreakerThreshold', 0, 5), 5));

  for (const feedback of readPersistedFeedback(this)) {
    if (!isRecord(feedback) || toStringValue(feedback.scopeKey) !== scopeKey) continue;
    applyProviderFeedback(scopeKey, {
      feedbackId: toStringValue(feedback.feedbackId), profileId: toStringValue(feedback.profileId), status: toStringValue(feedback.status), result: toStringValue(feedback.result),
      errorType: toStringValue(feedback.errorType), httpStatus: toFiniteNumber(feedback.httpStatus), latencyMs: toFiniteNumber(feedback.latencyMs),
      retryCount: toFiniteNumber(feedback.retryCount), cooldownSeconds: toFiniteNumber(feedback.cooldownSeconds), recommendation: toStringValue(feedback.recommendation),
    });
  }

  const jobs = workItems.length > 0 ? workItems : [{ json: {} }];
  const output: INodeExecutionData[] = [];
  jobs.forEach((job, itemIndex) => {
    const workerId = toStringValue(job.json.worker_id, `worker-${itemIndex + 1}`);
    const allocation = allocateProvider(scopeKey, {
      strategy, filters, workerId, workflowId: identity.workflowId, executionId: identity.executionId,
      lockTimeoutMs, maxRequestsPerMinute, circuitBreakerThreshold, holdLock: processingMode === 'parallel',
    });
    if (!allocation) {
      if (!queueWhenUnavailable) throw new Error(`No eligible provider account is available for worker ${workerId}.`);
      output.push({ json: { ...job.json, providerAllocation: { status: 'QUEUED', workerId, scopeKey }, providerPool: publicPoolSnapshot(scopeKey) }, pairedItem: { item: itemIndex, input: 1 } });
      return;
    }
    output.push({
      json: { ...job.json, providerAllocation: { ...allocation, status: 'ALLOCATED', workerId, scopeKey }, providerPool: publicPoolSnapshot(scopeKey) },
      pairedItem: { item: itemIndex, input: workItems.length > 0 ? 1 : 0 },
    });
  });
  return [output];
}
