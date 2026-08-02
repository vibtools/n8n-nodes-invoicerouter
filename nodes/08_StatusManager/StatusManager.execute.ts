import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { applyProviderFeedback, persistFeedback } from '../../shared/runtime/RuntimeStore';
import { isRecord, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const RETRYABLE_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERRORS = new Set(['TIMEOUT_ERROR', 'NETWORK_ERROR', 'RATE_LIMIT_ERROR', 'SERVER_ERROR', 'RETRYABLE_PROVIDER_ERROR']);
const NON_RETRYABLE_ERRORS = new Set(['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'VALIDATION_ERROR', 'NOT_FOUND_ERROR', 'CONFLICT_ERROR']);

function workflowIdentity(context: IExecuteFunctions): IDataObject {
  const workflow = context.getWorkflow?.();
  return { id: toStringValue(workflow?.id), name: toStringValue(workflow?.name) };
}

function idempotencyKey(status: IDataObject): string {
  return isRecord(status.idempotency) ? toStringValue(status.idempotency.value) : '';
}

function writebackKey(status: IDataObject, mode: string): string {
  if (mode === 'idempotencyKey') return idempotencyKey(status) || toStringValue(status.requestId);
  if (mode === 'providerInvoiceId') return toStringValue(status.providerInvoiceId) || toStringValue(status.requestId);
  if (mode === 'transactionId') return toStringValue(status.transactionId) || toStringValue(status.requestId);
  return toStringValue(status.requestId);
}

function workflowStateFor(input: { duplicateExecution: boolean; blockedExecution: boolean; neutralExecution: boolean; result: string; shouldRetry: boolean }): string {
  if (input.duplicateExecution) return 'DUPLICATE';
  if (input.blockedExecution) return 'BLOCKED';
  if (input.neutralExecution) return 'PROCESSING';
  if (input.result === 'SUCCESS') return 'COMPLETED';
  if (input.shouldRetry) return 'PENDING_RETRY';
  if (input.result === 'UNKNOWN') return 'PROCESSING';
  return 'FAILED';
}

function buildBulkSummary(items: INodeExecutionData[]): IDataObject {
  const statuses = items.map((item) => isRecord(item.json.standardStatus) ? item.json.standardStatus : {});
  const count = (predicate: (status: IDataObject) => boolean): number => statuses.filter(predicate).length;
  const runIds = [...new Set(statuses.map((status) => toStringValue(status.bulkRunId)).filter(Boolean))];
  const environments = [...new Set(statuses.flatMap((status) => {
    const bulk = isRecord(status.bulkSafety) ? status.bulkSafety : {};
    return Array.isArray(bulk.environments) ? bulk.environments.map((entry) => toStringValue(entry)).filter(Boolean) : [];
  }))].sort();
  const total = statuses.length;
  const sent = count((status) => toStringValue(status.result).toUpperCase() === 'SUCCESS');
  const failed = count((status) => ['FAILED', 'ERROR', 'TIMEOUT'].includes(toStringValue(status.result).toUpperCase()));
  const blocked = count((status) => toStringValue(status.result).toUpperCase() === 'BLOCKED');
  const duplicate = count((status) => toStringValue(status.result).toUpperCase() === 'DUPLICATE');
  const dryRun = count((status) => toStringValue(status.transportStatus).toUpperCase() === 'DRY_RUN');
  const pending = Math.max(0, total - sent - failed - blocked - duplicate - dryRun);
  return {
    schemaVersion: '1.0', runId: runIds[0] ?? '', totalItems: total, sent, failed, blocked, duplicate, dryRun, pending,
    environments, allSucceeded: total > 0 && sent === total, hasFailures: failed > 0, hasBlocked: blocked > 0, hasDuplicates: duplicate > 0,
    completedAt: nowIso(),
  };
}

function retryDecisionFallback(input: { status: IDataObject; result: string; neutralExecution: boolean; errorType: string; httpStatus: number; retryableByPolicy: boolean; nonRetryableByPolicy: boolean }): IDataObject {
  if (input.neutralExecution || input.result === 'SUCCESS') {
    return { retryable: false, safeToRetry: false, source: 'status-manager-neutral', reason: 'Neutral or successful execution does not need retry.' };
  }
  if (input.nonRetryableByPolicy || NON_RETRYABLE_ERRORS.has(input.errorType)) {
    return { retryable: false, safeToRetry: false, source: 'status-manager-non-retryable', reason: `${input.errorType || `HTTP_${input.httpStatus}`} requires review before retry.` };
  }
  const retryable = input.retryableByPolicy || RETRYABLE_HTTP.has(input.httpStatus) || RETRYABLE_ERRORS.has(input.errorType);
  return {
    retryable, safeToRetry: retryable, source: retryable ? 'status-manager-fallback' : 'status-manager-default',
    reason: retryable ? `${input.errorType || `HTTP_${input.httpStatus}`} is retryable.` : `${input.errorType || `HTTP_${input.httpStatus}`} is not retryable by default.`,
  };
}

function retryDelaySeconds(input: { shouldRetry: boolean; nextRetryCount: number; baseDelay: number; capDelay: number; respectRetryAfter: boolean; retryDecision: IDataObject; status: IDataObject }): number {
  if (!input.shouldRetry) return 0;
  const exponentialDelay = input.baseDelay * Math.pow(2, Math.max(0, input.nextRetryCount - 1));
  const retryAfter = toFiniteNumber(input.retryDecision.retryAfterSeconds ?? input.status.retryAfterSeconds, 0);
  const retryDelayHint = toFiniteNumber(input.retryDecision.retryDelayHintSeconds ?? input.status.retryDelayHintSeconds, 0);
  const providerDelay = input.respectRetryAfter ? Math.max(retryAfter, retryDelayHint) : 0;
  const rawDelay = Math.max(exponentialDelay, providerDelay);
  return Math.max(1, Math.min(Math.max(1, input.capDelay), Math.ceil(rawDelay)));
}

function buildExecutionLog(input: {
  context: IExecuteFunctions;
  status: IDataObject;
  result: string;
  workflowState: string;
  retryScheduled: boolean;
  retryCount: number;
  retryDelaySeconds: number;
  retryDecision: IDataObject;
  checkedAt: string;
  managedAt: string;
}): IDataObject {
  return {
    schemaVersion: '1.0', event: 'INVOICE_ROUTER_EXECUTION_RESULT', executionId: toStringValue(input.context.getExecutionId?.()),
    workflow: workflowIdentity(input.context), requestId: input.status.requestId, transactionId: input.status.transactionId,
    idempotencyKey: idempotencyKey(input.status), providerId: input.status.providerId, profileId: input.status.profileId,
    accountId: input.status.accountId, actionId: input.status.actionId, workerId: input.status.workerId,
      providerCustomerId: input.status.providerCustomerId, customerStatus: input.status.customerStatus, postStatus: input.status.postStatus,
      emailSendRequested: input.status.emailSendRequested, emailSendStatus: input.status.emailSendStatus,
      emailSendMethod: input.status.emailSendMethod, emailErrorMessage: input.status.emailErrorMessage,
    recipientEmail: input.status.recipientEmail, result: input.result, workflowState: input.workflowState,
    invoiceStatus: input.status.invoiceStatus, providerStatus: input.status.providerStatus,
    providerInvoiceId: input.status.providerInvoiceId, invoiceNumber: input.status.invoiceNumber,
    httpStatus: input.status.httpStatus, errorType: input.status.errorType, errorCategory: input.status.errorCategory,
    errorSeverity: input.status.errorSeverity, errorCode: input.status.errorCode, errorMessage: input.status.errorMessage,
    retryScheduled: input.retryScheduled, retryCount: input.retryCount, retryDelaySeconds: input.retryDelaySeconds,
    retryDecision: input.retryDecision, latencyMs: input.status.latencyMs, responseSizeBytes: input.status.responseSizeBytes,
    transportStatus: input.status.transportStatus, activationSafety: input.status.activationSafety,
    activationMode: input.status.activationMode, activationApproved: input.status.activationApproved,
    presetSelfCheck: input.status.presetSelfCheck, presetSelfCheckMode: input.status.presetSelfCheckMode,
    presetSelfCheckApproved: input.status.presetSelfCheckApproved,
    bulkSafety: input.status.bulkSafety, bulkRunId: input.status.bulkRunId, bulkItemNumber: input.status.bulkItemNumber,
    bulkTotalItems: input.status.bulkTotalItems, bulkDecision: input.status.bulkDecision,
    requestMapping: input.status.requestMapping, responsePolicy: input.status.responsePolicy,
    retryableByPolicy: input.status.retryableByPolicy, nonRetryableByPolicy: input.status.nonRetryableByPolicy,
    retryAfterSeconds: input.status.retryAfterSeconds, retryDelayHintSeconds: input.status.retryDelayHintSeconds,
    checkedAt: input.checkedAt, managedAt: input.managedAt,
  };
}


function requestMappingValue(status: IDataObject, key: string): unknown {
  const mapping = isRecord(status.requestMapping) ? status.requestMapping : {};
  return mapping[key];
}

function requestMappingLifecycle(status: IDataObject): IDataObject {
  const mapping = isRecord(status.requestMapping) ? status.requestMapping : {};
  return isRecord(mapping.lifecycle) ? mapping.lifecycle : {};
}

function lifecycleStepsText(status: IDataObject): string {
  const steps = requestMappingValue(status, 'lifecycleSteps') ?? requestMappingLifecycle(status).steps;
  return Array.isArray(steps) ? JSON.stringify(steps) : toStringValue(steps);
}

function buildStatusWriteback(input: {
  status: IDataObject;
  workflowState: string;
  result: string;
  keyMode: string;
  target: string;
  retryScheduled: boolean;
  retryCount: number;
  retryDelaySeconds: number;
  retryDecision: IDataObject;
  retryQueueEntry: IDataObject | null;
  managedAt: string;
}): IDataObject {
  const key = writebackKey(input.status, input.keyMode);
  return {
    schemaVersion: '1.0', action: 'UPSERT', target: input.target, keyMode: input.keyMode, key,
    values: {
      requestId: input.status.requestId, transactionId: input.status.transactionId, idempotencyKey: idempotencyKey(input.status),
      providerId: input.status.providerId, profileId: input.status.profileId, accountId: input.status.accountId,
      actionId: input.status.actionId, workerId: input.status.workerId, recipientEmail: input.status.recipientEmail,
      workflowState: input.workflowState, result: input.result, invoiceStatus: input.status.invoiceStatus,
      providerStatus: input.status.providerStatus, transportStatus: input.status.transportStatus,
      providerCustomerId: input.status.providerCustomerId, customerStatus: input.status.customerStatus,
      postStatus: input.status.postStatus, emailSendRequested: input.status.emailSendRequested,
      emailSendStatus: input.status.emailSendStatus, emailSendMethod: input.status.emailSendMethod,
      emailErrorMessage: input.status.emailErrorMessage,
      providerInvoiceId: input.status.providerInvoiceId, invoiceNumber: input.status.invoiceNumber,
      invoiceUrl: input.status.invoiceUrl, pdfUrl: input.status.pdfUrl, httpStatus: input.status.httpStatus,
      errorType: input.status.errorType, errorCategory: input.status.errorCategory, errorSeverity: input.status.errorSeverity,
      errorCode: input.status.errorCode, errorMessage: input.status.errorMessage,
      retryScheduled: input.retryScheduled, retryCount: input.retryCount, retryDelaySeconds: input.retryDelaySeconds,
      retryDecisionSource: toStringValue(input.retryDecision.source), retryDecisionReason: toStringValue(input.retryDecision.reason),
      retryAfterSeconds: input.status.retryAfterSeconds, retryDelayHintSeconds: input.status.retryDelayHintSeconds,
      nextRetryAt: isRecord(input.retryQueueEntry) ? input.retryQueueEntry.scheduledAt : undefined,
      lifecycleMode: toStringValue(requestMappingValue(input.status, 'lifecycleMode') ?? requestMappingLifecycle(input.status).mode),
      lifecycleSteps: lifecycleStepsText(input.status),
      providerRecipeId: toStringValue(requestMappingLifecycle(input.status).recipeId ?? requestMappingValue(input.status, 'recipeId')),
      activationMode: input.status.activationMode, activationApproved: input.status.activationApproved,
      activationSafety: input.status.activationSafety, presetSelfCheckMode: input.status.presetSelfCheckMode,
      presetSelfCheckApproved: input.status.presetSelfCheckApproved, presetSelfCheck: input.status.presetSelfCheck, bulkRunId: input.status.bulkRunId,
      bulkItemNumber: input.status.bulkItemNumber, bulkTotalItems: input.status.bulkTotalItems,
      bulkDecision: input.status.bulkDecision, bulkSafety: input.status.bulkSafety,
      duplicatePrevention: input.status.duplicatePrevention, retryableByPolicy: input.status.retryableByPolicy,
      nonRetryableByPolicy: input.status.nonRetryableByPolicy, checkedAt: input.status.checkedAt, managedAt: input.managedAt,
    },
  };
}

function persistExecutionLog(context: IExecuteFunctions, entry: IDataObject, retention: number): void {
  try {
    const data = context.getWorkflowStaticData?.('global');
    if (!data) return;
    const previous = Array.isArray(data.invoiceRouterExecutionLog) ? data.invoiceRouterExecutionLog.filter(isRecord) : [];
    data.invoiceRouterExecutionLog = [...previous, entry].slice(-Math.max(1, retention));
  } catch {
    // Execution log persistence is best-effort. The item output still contains the full log entry.
  }
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  const bulkSummary = buildBulkSummary(items);
  items.forEach((item, itemIndex) => {
    if (!isRecord(item.json.standardStatus)) throw new Error(`Item ${itemIndex}: Standard Status is missing.`);
    const status = item.json.standardStatus;
    const retryLimit = Math.max(0, toFiniteNumber(this.getNodeParameter('retryLimit', itemIndex, 3), 3));
    const retryBaseDelay = Math.max(1, toFiniteNumber(this.getNodeParameter('retryBaseDelaySeconds', itemIndex, 30), 30));
    const retryMaxDelay = Math.max(1, toFiniteNumber(this.getNodeParameter('retryMaxDelaySeconds', itemIndex, 900), 900));
    const respectRetryAfter = Boolean(this.getNodeParameter('respectRetryAfterHeader', itemIndex, true));
    const defaultCooldown = Math.max(1, toFiniteNumber(this.getNodeParameter('cooldownSeconds', itemIndex, 30), 30));
    const disableOnAuthFailure = Boolean(this.getNodeParameter('disableOnAuthFailure', itemIndex, true));
    const alertOnFailure = Boolean(this.getNodeParameter('alertOnFailure', itemIndex, true));
    const includeEvents = Boolean(this.getNodeParameter('includeEvents', itemIndex, true));
    const includeExecutionLog = Boolean(this.getNodeParameter('includeExecutionLog', itemIndex, true));
    const includeStatusWriteback = Boolean(this.getNodeParameter('includeStatusWriteback', itemIndex, true));
    const persistLog = Boolean(this.getNodeParameter('persistExecutionLog', itemIndex, false));
    const executionLogRetention = Math.max(1, toFiniteNumber(this.getNodeParameter('executionLogRetention', itemIndex, 500), 500));
    const writebackTarget = toStringValue(this.getNodeParameter('writebackTarget', itemIndex, 'invoice_results'), 'invoice_results');
    const writebackKeyMode = toStringValue(this.getNodeParameter('writebackKeyMode', itemIndex, 'requestId'), 'requestId');
    const result = toStringValue(status.result, 'UNKNOWN').toUpperCase();
    const transportStatus = toStringValue(status.transportStatus).toUpperCase();
    const duplicateExecution = transportStatus === 'DUPLICATE' || result === 'DUPLICATE';
    const blockedExecution = transportStatus === 'BLOCKED' || transportStatus === 'SKIPPED' || duplicateExecution;
    const neutralExecution = transportStatus === 'DRY_RUN' || transportStatus === 'QUEUED' || blockedExecution;
    const errorType = toStringValue(status.errorType).toUpperCase();
    const httpStatus = toFiniteNumber(status.httpStatus, 0);
    const existingRetry = toFiniteNumber(item.json.retryCount, 0);
    const retryableByPolicy = status.retryableByPolicy === true;
    const nonRetryableByPolicy = status.nonRetryableByPolicy === true;
    const incomingRetryDecision = isRecord(status.retryDecision) ? status.retryDecision : retryDecisionFallback({
      status, result, neutralExecution, errorType, httpStatus, retryableByPolicy, nonRetryableByPolicy,
    });
    const retryable = !neutralExecution && result !== 'SUCCESS' && incomingRetryDecision.retryable === true && incomingRetryDecision.safeToRetry !== false;
    const shouldRetry = retryable && existingRetry < retryLimit;
    const nextRetryCount = shouldRetry ? existingRetry + 1 : existingRetry;
    const retryDelay = retryDelaySeconds({
      shouldRetry, nextRetryCount, baseDelay: retryBaseDelay, capDelay: retryMaxDelay,
      respectRetryAfter, retryDecision: incomingRetryDecision, status,
    });
    const authFailure = ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR'].includes(errorType);
    const manualFixRequired = ['VALIDATION_ERROR', 'NOT_FOUND_ERROR', 'CONFLICT_ERROR'].includes(errorType);
    const recommendation = neutralExecution ? 'NO_CHANGE' : result === 'SUCCESS' ? 'RELEASE' : authFailure && disableOnAuthFailure ? 'DISABLE' : manualFixRequired ? 'REVIEW' : 'COOLDOWN';
    const cooldownSeconds = httpStatus === 429 ? Math.max(toFiniteNumber(status.retryAfterSeconds, 0), 60, defaultCooldown) : defaultCooldown;
    const workflowState = workflowStateFor({ duplicateExecution, blockedExecution, neutralExecution, result, shouldRetry });
    const runtime = isRecord(status.runtime) ? status.runtime : {};
    const scopeKey = toStringValue(runtime.scopeKey);
    const profileId = toStringValue(status.profileId);
    const managedAt = nowIso();
    const checkedAt = toStringValue(status.checkedAt, managedAt);
    const feedbackId = `${toStringValue(status.requestId, 'unassigned')}:${existingRetry}:${checkedAt}`;
    const providerFeedback: IDataObject = {
      feedbackId, scopeKey, providerId: status.providerId, profileId, accountId: status.accountId, workerId: status.workerId,
      invoiceId: status.providerInvoiceId, status: status.invoiceStatus, result, errorType, errorCategory: status.errorCategory,
      errorSeverity: status.errorSeverity, errorCode: status.errorCode, httpStatus, latencyMs: status.latencyMs,
      retryCount: nextRetryCount, cooldownSeconds, retryDecision: incomingRetryDecision, recommendation, timestamp: managedAt,
    };
    if (!neutralExecution && scopeKey && profileId) {
      applyProviderFeedback(scopeKey, {
        feedbackId, profileId, workerId: toStringValue(status.workerId), status: toStringValue(status.invoiceStatus), result,
        errorType, httpStatus, latencyMs: toFiniteNumber(status.latencyMs), retryCount: nextRetryCount, cooldownSeconds, recommendation,
      });
      persistFeedback(this, providerFeedback);
    }
    const retryQueueEntry: IDataObject | null = shouldRetry ? {
      requestId: status.requestId, profileId, accountId: status.accountId, retryCount: nextRetryCount,
      scheduledAt: new Date(Date.now() + retryDelay * 1000).toISOString(), delaySeconds: retryDelay,
      reason: toStringValue(incomingRetryDecision.reason) || errorType || `HTTP_${httpStatus}`,
      source: toStringValue(incomingRetryDecision.source), errorType, errorCategory: status.errorCategory,
      retryAfterSeconds: status.retryAfterSeconds, retryDecision: incomingRetryDecision,
    } : null;
    const executionLog = buildExecutionLog({
      context: this, status, result, workflowState, retryScheduled: shouldRetry, retryCount: nextRetryCount,
      retryDelaySeconds: retryDelay, retryDecision: incomingRetryDecision, checkedAt, managedAt,
    });
    if (persistLog) persistExecutionLog(this, executionLog, executionLogRetention);
    const statusWriteback = buildStatusWriteback({
      status, workflowState, result, keyMode: writebackKeyMode, target: writebackTarget,
      retryScheduled: shouldRetry, retryCount: nextRetryCount, retryDelaySeconds: retryDelay,
      retryDecision: incomingRetryDecision, retryQueueEntry, managedAt,
    });
    const alertSeverity = toStringValue(status.alertSeverity) || (authFailure ? 'critical' : httpStatus >= 500 ? 'high' : 'warning');
    const managementEvents: IDataObject = {
      database: { event: 'UPSERT_INVOICE_RESULT', key: statusWriteback.key, state: workflowState, writeback: statusWriteback },
      dashboard: { event: 'UPDATE_COUNTERS', result, workflowState, providerId: status.providerId },
      metrics: { event: 'RECORD_EXECUTION', success: result === 'SUCCESS', latencyMs: status.latencyMs, httpStatus, providerId: status.providerId, accountId: status.accountId },
      analytics: { event: 'INVOICE_ROUTER_RESULT', invoiceStatus: status.invoiceStatus, errorType, errorCategory: status.errorCategory, timestamp: managedAt },
      retryQueue: retryQueueEntry,
      alert: !neutralExecution && result !== 'SUCCESS' && alertOnFailure ? { event: 'INVOICE_ROUTER_FAILURE', severity: alertSeverity.toUpperCase(), message: status.errorMessage || errorType || `HTTP ${httpStatus}`, retryScheduled: shouldRetry, retryDecision: incomingRetryDecision } : null,
      notification: result === 'SUCCESS' || neutralExecution ? null : { event: 'NOTIFICATION_REQUESTED', channels: ['email', 'webhook'], severity: alertSeverity, retryScheduled: shouldRetry },
      audit: { event: 'WORKFLOW_DECISION', requestId: status.requestId, result, workflowState, retryScheduled: shouldRetry, retryDecision: incomingRetryDecision, timestamp: managedAt },
    };
    const management: IDataObject = {
      schemaVersion: '1.0', workflowState, completed: workflowState === 'COMPLETED', retryScheduled: shouldRetry,
      retryCount: nextRetryCount, retryDelaySeconds: retryDelay, retryDecision: incomingRetryDecision,
      retryQueueEntry, providerFeedback, bulkSummary,
      executionLog: includeExecutionLog ? executionLog : undefined,
      statusWriteback: includeStatusWriteback ? statusWriteback : undefined,
      events: includeEvents ? managementEvents : undefined,
      workflowResult: {
        requestId: status.requestId, transactionId: status.transactionId, providerId: status.providerId,
        accountId: status.accountId, recipientEmail: status.recipientEmail, invoiceStatus: status.invoiceStatus,
        result, workflowState, providerInvoiceId: status.providerInvoiceId, invoiceNumber: status.invoiceNumber,
        providerCustomerId: status.providerCustomerId, customerStatus: status.customerStatus, postStatus: status.postStatus,
        emailSendRequested: status.emailSendRequested, emailSendStatus: status.emailSendStatus,
        emailSendMethod: status.emailSendMethod, emailErrorMessage: status.emailErrorMessage,
        lifecycleMode: toStringValue(requestMappingValue(status, 'lifecycleMode') ?? requestMappingLifecycle(status).mode),
        lifecycleSteps: lifecycleStepsText(status), providerRecipeId: toStringValue(requestMappingLifecycle(status).recipeId ?? requestMappingValue(status, 'recipeId')),
        invoiceUrl: status.invoiceUrl, pdfUrl: status.pdfUrl, writebackKey: statusWriteback.key,
        errorType, errorCategory: status.errorCategory, retryScheduled: shouldRetry, retryDelaySeconds: retryDelay,
        activationMode: status.activationMode, activationApproved: status.activationApproved,
        presetSelfCheckMode: status.presetSelfCheckMode, presetSelfCheckApproved: status.presetSelfCheckApproved,
        bulkRunId: status.bulkRunId, bulkItemNumber: status.bulkItemNumber, bulkTotalItems: status.bulkTotalItems,
        bulkSummary,
      },
      managedAt,
    };
    output.push({ json: { ...item.json, management }, pairedItem: { item: itemIndex } });
  });
  return [output];
}
