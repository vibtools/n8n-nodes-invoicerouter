import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { allocateProvider, applyProviderFeedback, executionIdentity, publicPoolSnapshot, readPersistedFeedback, type AllocationStrategy } from '../../shared/runtime/RuntimeStore';
import { admitCampaignJob } from '../../shared/runtime/CampaignStore';
import { safeInputData } from '../../shared/utils/Input';
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

function blockedAllocation(job: INodeExecutionData, itemIndex: number, workerId: string, scopeKey: string, routing: IDataObject, message: string, status = 'BLOCKED', campaignSafety: IDataObject = {}): INodeExecutionData {
  return {
    json: {
      ...job.json,
      providerAllocation: { status, workerId, scopeKey, routing, reason: message, campaignSafety },
      providerPool: publicPoolSnapshot(scopeKey),
    },
    pairedItem: { item: itemIndex },
  };
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const primaryItems = safeInputData(this, 0);
  const secondaryItems = safeInputData(this, 1);
  const primaryLooksLikeWork = primaryItems.some((item) => isRecord(item.json.job) || isRecord(item.json.recipient) || isRecord(item.json.providerLibrary));
  const providerItems = secondaryItems.length > 0 || !primaryLooksLikeWork ? primaryItems : [];
  const workItems = secondaryItems.length > 0 ? secondaryItems : primaryLooksLikeWork ? primaryItems : [];
  const embeddedLibrary = workItems.find((item) => isRecord(item.json.providerLibrary))?.json.providerLibrary;
  const library = providerItems.find((item) => Array.isArray(item.json.providers))?.json ?? providerItems[0]?.json ?? (isRecord(embeddedLibrary) ? embeddedLibrary : {});
  const workRuntime = workItems.length > 0 && isRecord(workItems[0].json.runtime) ? workItems[0].json.runtime : {};
  const batchId = toStringValue(library.batch_id, 'default');
  const runtime = isRecord(library.runtime) && Object.keys(library.runtime).length > 0 ? library.runtime : workRuntime;
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
  for (const [itemIndex, job] of jobs.entries()) {
    const jobRecord = isRecord(job.json.job) ? job.json.job : {};
    const failoverState = isRecord(job.json.failoverState) ? job.json.failoverState : isRecord(jobRecord.failoverState) ? jobRecord.failoverState : {};
    const attemptedProfileIds = Array.isArray(failoverState.attemptedProfileIds) ? failoverState.attemptedProfileIds.map((value) => toStringValue(value)).filter(Boolean) : [];
    const failoverGroup = toStringValue(failoverState.failoverGroup ?? jobRecord.failoverGroup).trim();
    const requiredProfileId = toStringValue(failoverState.requiredProfileId).trim();
    const workerId = toStringValue(job.json.worker_id ?? jobRecord.jobId, `worker-${itemIndex + 1}`);
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
      continue;
    }
    const campaignConfig = isRecord(jobRecord.campaignSafety) ? jobRecord.campaignSafety : {};
    const campaignId = toStringValue(jobRecord.campaignId, 'default-campaign');
    const jobId = toStringValue(jobRecord.jobId, workerId);
    const campaignSafety = await admitCampaignJob(this, { scopeKey, campaignId, jobId, config: campaignConfig });
    if (campaignSafety.approved !== true) {
      const status = toStringValue(campaignSafety.status, 'QUEUED').toUpperCase();
      output.push(blockedAllocation(job, itemIndex, workerId, scopeKey, routing, toStringValue(campaignSafety.reason, 'Campaign is not currently eligible for sending.'), status, campaignSafety));
      continue;
    }
    const invoiceTemplate = isRecord(job.json.invoiceTemplate) ? job.json.invoiceTemplate : {};
    const requiredCurrency = toStringValue(invoiceTemplate.currency).trim().toUpperCase();
    const allocation = allocateProvider(scopeKey, {
      strategy, filters: itemFilters, workerId, workflowId: identity.workflowId, executionId: identity.executionId,
      lockTimeoutMs, maxRequestsPerMinute, circuitBreakerThreshold, holdLock: processingMode === 'parallel',
      excludeProfileIds: requiredProfileId ? [] : attemptedProfileIds, failoverGroup, requiredProfileId, requiredCurrency,
    });
    if (!allocation) {
      if (!queueWhenUnavailable) throw new Error(`No eligible provider account is available for worker ${workerId}.`);
      output.push({ json: { ...job.json, providerAllocation: { status: 'QUEUED', workerId, scopeKey, routing, attemptedProfileIds, failoverGroup, requiredProfileId, requiredCurrency, campaignSafety, reason: requiredCurrency ? `No eligible provider account is currently available for currency ${requiredCurrency}.` : 'No eligible provider account is currently available.' }, providerPool: publicPoolSnapshot(scopeKey) }, pairedItem: { item: itemIndex } });
      continue;
    }
    output.push({
      json: { ...job.json, providerAllocation: { ...allocation, status: 'ALLOCATED', workerId, scopeKey, routing, attemptedProfileIds, failoverGroup, requiredProfileId, requiredCurrency, campaignSafety }, providerPool: publicPoolSnapshot(scopeKey) },
      pairedItem: { item: itemIndex },
    });
  }
  return [output];
}
