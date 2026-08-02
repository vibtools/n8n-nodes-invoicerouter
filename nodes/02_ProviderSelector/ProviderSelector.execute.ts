import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { allocateProvider, applyProviderFeedback, executionIdentity, publicPoolSnapshot, readPersistedFeedback, type AllocationStrategy } from '../../shared/runtime/RuntimeStore';
import { getByPath, isRecord, parseJsonArray, slug, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

interface ConditionalRoute {
  providerId: string;
  actionId: string;
  environment: string;
  source: string;
  matched: boolean;
  ruleName: string;
}

function sameConditionValue(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return expected.some((entry) => sameConditionValue(actual, entry));
  const actualText = toStringValue(actual).trim();
  const expectedText = toStringValue(expected).trim();
  if (expectedText === '*') return actualText.length > 0;
  return actualText.toLowerCase() === expectedText.toLowerCase();
}

function ruleMatches(item: IDataObject, when: IDataObject): boolean {
  return Object.entries(when).every(([path, expected]) => sameConditionValue(getByPath(item, path), expected));
}

function routeFromRules(item: IDataObject, rules: JsonValue[]): ConditionalRoute | null {
  for (const entry of rules) {
    if (!isRecord(entry)) continue;
    const when = isRecord(entry.when) ? entry.when : {};
    if (Object.keys(when).length === 0 || !ruleMatches(item, when)) continue;
    const providerId = slug(entry.providerId ?? entry.provider);
    const actionId = slug(entry.actionId ?? entry.action);
    const environment = slug(entry.environment ?? entry.env);
    return {
      providerId, actionId, environment,
      source: 'rule', matched: Boolean(providerId || actionId || environment),
      ruleName: toStringValue(entry.name, 'unnamed rule'),
    };
  }
  return null;
}

function routeFromPaths(item: IDataObject, providerPath: string, actionPath: string, environmentPath: string): ConditionalRoute {
  const providerId = slug(getByPath(item, providerPath));
  const actionId = slug(getByPath(item, actionPath));
  const environment = slug(getByPath(item, environmentPath));
  return { providerId, actionId, environment, source: 'fields', matched: Boolean(providerId || actionId || environment), ruleName: '' };
}

function resolveConditionalRoute(item: IDataObject, rules: JsonValue[], providerPath: string, actionPath: string, environmentPath: string): ConditionalRoute {
  return routeFromRules(item, rules) ?? routeFromPaths(item, providerPath, actionPath, environmentPath);
}

function blockedAllocation(job: INodeExecutionData, itemIndex: number, workerId: string, scopeKey: string, routing: IDataObject, message: string): INodeExecutionData {
  return {
    json: {
      ...job.json,
      providerAllocation: { status: 'BLOCKED', workerId, scopeKey, routing, reason: message },
      providerPool: publicPoolSnapshot(scopeKey),
    },
    pairedItem: { item: itemIndex, input: 1 },
  };
}

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
  const conditionalRouting = Boolean(this.getNodeParameter('conditionalRouting', 0, false));
  const routeProviderPath = toStringValue(this.getNodeParameter('routeProviderPath', 0, 'recipient.customFields.Provider'));
  const routeActionPath = toStringValue(this.getNodeParameter('routeActionPath', 0, 'recipient.customFields.Action'));
  const routeEnvironmentPath = toStringValue(this.getNodeParameter('routeEnvironmentPath', 0, 'recipient.customFields.Environment'));
  const routingRules = parseJsonArray(this.getNodeParameter('routingRulesJson', 0, '[]'), 'Routing Rules');
  const requireConditionalMatch = Boolean(this.getNodeParameter('requireConditionalMatch', 0, false));
  const unmatchedRouteBehavior = toStringValue(this.getNodeParameter('unmatchedRouteBehavior', 0, 'block'));
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
    const route = conditionalRouting ? resolveConditionalRoute(job.json, routingRules, routeProviderPath, routeActionPath, routeEnvironmentPath) : { providerId: '', actionId: '', environment: '', source: 'disabled', matched: false, ruleName: '' };
    const itemFilters: IDataObject = {
      providerId: route.providerId || filters.providerId,
      actionId: route.actionId || filters.actionId,
      environment: route.environment || filters.environment,
    };
    const routing: IDataObject = {
      enabled: conditionalRouting,
      matched: route.matched,
      source: route.source,
      ruleName: route.ruleName,
      requested: { providerId: route.providerId, actionId: route.actionId, environment: route.environment },
      effectiveFilters: itemFilters,
    };
    if (conditionalRouting && requireConditionalMatch && !route.matched) {
      const message = 'Conditional routing is required, but this item did not match a routing rule or routing fields.';
      if (unmatchedRouteBehavior === 'error') throw new Error(`${message} Worker: ${workerId}.`);
      output.push(blockedAllocation(job, itemIndex, workerId, scopeKey, routing, message));
      return;
    }
    const allocation = allocateProvider(scopeKey, {
      strategy, filters: itemFilters, workerId, workflowId: identity.workflowId, executionId: identity.executionId,
      lockTimeoutMs, maxRequestsPerMinute, circuitBreakerThreshold, holdLock: processingMode === 'parallel',
    });
    if (!allocation) {
      if (!queueWhenUnavailable) throw new Error(`No eligible provider account is available for worker ${workerId}.`);
      output.push({ json: { ...job.json, providerAllocation: { status: 'QUEUED', workerId, scopeKey, routing }, providerPool: publicPoolSnapshot(scopeKey) }, pairedItem: { item: itemIndex, input: 1 } });
      return;
    }
    output.push({
      json: { ...job.json, providerAllocation: { ...allocation, status: 'ALLOCATED', workerId, scopeKey, routing }, providerPool: publicPoolSnapshot(scopeKey) },
      pairedItem: { item: itemIndex, input: workItems.length > 0 ? 1 : 0 },
    });
  });
  return [output];
}
