import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { applyProviderFeedback, persistFeedback, updateCampaignAccountStats } from '../../shared/runtime/RuntimeStore';
import { isRecord, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const RETRYABLE_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERRORS = new Set(['TIMEOUT_ERROR', 'NETWORK_ERROR', 'RATE_LIMIT_ERROR', 'SERVER_ERROR', 'RETRYABLE_PROVIDER_ERROR', 'EMAIL_SEND_ERROR', 'INVOICE_POST_ERROR']);
const NON_RETRYABLE_ERRORS = new Set(['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'VALIDATION_ERROR', 'NOT_FOUND_ERROR', 'CONFLICT_ERROR', 'EMAIL_UNVERIFIED', 'CONFIGURATION_ERROR', 'QUOTA_EXHAUSTED_ERROR']);


function jobRecord(item: INodeExecutionData, status: IDataObject): IDataObject {
  if (isRecord(item.json.job)) return item.json.job;
  const request = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
  return isRecord(request.job) ? request.job : {
    jobId: toStringValue(status.requestId), campaignId: toStringValue(status.bulkRunId, 'default-campaign'), attemptCount: 0,
  };
}

function providerOperationalStatus(input: { result: string; errorType: string; errorMessage: string; retrying: boolean; failover: boolean; emailQueued: boolean }): IDataObject {
  const message = input.errorMessage.toLowerCase();
  if (input.result === 'SUCCESS' || ['DUPLICATE', 'BLOCKED', 'UNKNOWN'].includes(input.result)) return { status: 'READY', enabled: true, autoDisabled: false, reason: '' };
  if (input.emailQueued) return { status: 'READY', enabled: true, autoDisabled: false, reason: 'Provider accepted email into its outgoing queue.' };
  if (input.errorType === 'AUTHENTICATION_ERROR') return { status: 'AUTH_FAILED', enabled: false, autoDisabled: true, reason: input.errorMessage };
  if (input.errorType === 'AUTHORIZATION_ERROR') return { status: 'AUTHORIZATION_FAILED', enabled: false, autoDisabled: true, reason: input.errorMessage };
  if (input.errorType === 'QUOTA_EXHAUSTED_ERROR') return { status: 'QUOTA_EXHAUSTED', enabled: false, autoDisabled: true, reason: input.errorMessage };
  if (input.errorType === 'CONFIGURATION_ERROR' && /database .*does not exist|unknown database|database not found/.test(message)) {
    return { status: 'DATABASE_INVALID', enabled: false, autoDisabled: true, reason: input.errorMessage };
  }
  if (input.errorType === 'CONFIGURATION_ERROR' && /currency/.test(message)) return { status: 'CURRENCY_INCOMPATIBLE', enabled: true, autoDisabled: false, reason: input.errorMessage };
  if (input.errorType === 'CONFIGURATION_ERROR') return { status: 'CONFIGURATION_ERROR', enabled: true, autoDisabled: false, reason: input.errorMessage };
  if (input.errorType === 'RATE_LIMIT_ERROR') return { status: 'RATE_LIMITED', enabled: true, autoDisabled: false, reason: input.errorMessage };
  if (input.failover) return { status: 'COOLDOWN', enabled: true, autoDisabled: false, reason: input.errorMessage };
  if (input.retrying) return { status: 'COOLDOWN', enabled: true, autoDisabled: false, reason: input.errorMessage };
  return { status: 'MANUAL_REVIEW', enabled: true, autoDisabled: false, reason: input.errorMessage };
}

function recipientOperationalStatus(input: {
  duplicate: boolean; blocked: boolean; result: string; emailStatus: string; retrying: boolean; failover: boolean; errorType: string;
}): string {
  if (input.duplicate) return 'DUPLICATE';
  if (input.blocked) return 'BLOCKED';
  if (input.failover) return 'FAILOVER';
  if (input.retrying) return 'RETRYING';
  if (input.emailStatus === 'SENT' || input.result === 'SUCCESS') return 'SENT';
  if (input.emailStatus === 'QUEUED') return 'QUEUED';
  if (input.emailStatus === 'UNVERIFIED' || input.errorType === 'EMAIL_UNVERIFIED') return 'MANUAL_REVIEW';
  if (input.result === 'PARTIAL_SUCCESS') return 'MANUAL_REVIEW';
  return 'FAILED';
}

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

function booleanValue(value: unknown): boolean {
  if (value === true) return true;
  return ['true', '1', 'yes', 'on', 'requested'].includes(toStringValue(value).trim().toLowerCase());
}

function workflowStateFor(input: {
  duplicateExecution: boolean;
  blockedExecution: boolean;
  neutralExecution: boolean;
  result: string;
  shouldRetry: boolean;
}): string {
  if (input.duplicateExecution) return 'DUPLICATE';
  if (input.blockedExecution) return 'BLOCKED';
  if (input.neutralExecution) return 'PROCESSING';
  if (input.shouldRetry) return 'PENDING_RETRY';
  if (input.result === 'SUCCESS') return 'COMPLETED';
  if (input.result === 'PARTIAL_SUCCESS') return 'PARTIAL';
  if (input.result === 'UNKNOWN') return 'PROCESSING';
  return 'FAILED';
}

function buildBulkSummary(items: INodeExecutionData[]): IDataObject {
  const statuses = items.map((item) => isRecord(item.json.standardStatus) ? item.json.standardStatus : {});
  const count = (predicate: (status: IDataObject) => boolean): number => statuses.filter(predicate).length;
  const upper = (value: unknown): string => toStringValue(value).toUpperCase();
  const runIds = [...new Set(statuses.map((status) => toStringValue(status.bulkRunId)).filter(Boolean))];
  const environments = [...new Set(statuses.flatMap((status) => {
    const bulk = isRecord(status.bulkSafety) ? status.bulkSafety : {};
    return Array.isArray(bulk.environments) ? bulk.environments.map((entry) => toStringValue(entry)).filter(Boolean) : [];
  }))].sort();
  const total = statuses.length;
  const succeeded = count((status) => upper(status.result) === 'SUCCESS');
  const partial = count((status) => upper(status.result) === 'PARTIAL_SUCCESS');
  const failed = count((status) => ['FAILED', 'ERROR', 'TIMEOUT'].includes(upper(status.result)));
  const blocked = count((status) => upper(status.result) === 'BLOCKED');
  const duplicate = count((status) => upper(status.result) === 'DUPLICATE');
  const dryRun = count((status) => upper(status.transportStatus) === 'DRY_RUN');
  const invoiceCreated = count((status) => ['CREATED', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VIEWED'].includes(upper(status.invoiceStatus)) || Boolean(toStringValue(status.providerInvoiceId)));
  const invoicePosted = count((status) => upper(status.postStatus) === 'POSTED');
  const emailRequested = count((status) => booleanValue(status.emailSendRequested));
  const emailSent = count((status) => upper(status.emailSendStatus) === 'SENT');
  const emailQueued = count((status) => upper(status.emailSendStatus) === 'QUEUED');
  const emailFailed = count((status) => upper(status.emailSendStatus) === 'FAILED');
  const emailUnverified = count((status) => upper(status.emailSendStatus) === 'UNVERIFIED');
  const pending = Math.max(0, total - succeeded - partial - failed - blocked - duplicate - dryRun);
  return {
    schemaVersion: '2.0', runId: runIds[0] ?? '', totalItems: total,
    sent: emailSent, succeeded, partial, failed, blocked, duplicate, dryRun, pending,
    invoiceCreated, invoicePosted, emailRequested, emailSent, emailQueued, emailFailed, emailUnverified,
    environments, allSucceeded: total > 0 && succeeded === total, hasFailures: failed > 0,
    hasPartial: partial > 0, hasBlocked: blocked > 0, hasDuplicates: duplicate > 0,
    completedAt: nowIso(),
  };
}

function retryDecisionFallback(input: {
  result: string;
  neutralExecution: boolean;
  errorType: string;
  httpStatus: number;
  retryableByPolicy: boolean;
  nonRetryableByPolicy: boolean;
}): IDataObject {
  if (input.neutralExecution || ['SUCCESS', 'PARTIAL_SUCCESS'].includes(input.result)) {
    return { retryable: false, safeToRetry: false, source: 'status-manager-neutral', reason: 'Neutral, successful, or partial execution does not receive an automatic full retry.' };
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

function retryDelaySeconds(input: {
  shouldRetry: boolean;
  nextRetryCount: number;
  baseDelay: number;
  capDelay: number;
  respectRetryAfter: boolean;
  retryDecision: IDataObject;
  status: IDataObject;
}): number {
  if (!input.shouldRetry) return 0;
  const exponentialDelay = input.baseDelay * Math.pow(2, Math.max(0, input.nextRetryCount - 1));
  const retryAfter = toFiniteNumber(input.retryDecision.retryAfterSeconds ?? input.status.retryAfterSeconds, 0);
  const retryDelayHint = toFiniteNumber(input.retryDecision.retryDelayHintSeconds ?? input.status.retryDelayHintSeconds, 0);
  const providerDelay = input.respectRetryAfter ? Math.max(retryAfter, retryDelayHint) : 0;
  const rawDelay = Math.max(exponentialDelay, providerDelay);
  return Math.max(1, Math.min(Math.max(1, input.capDelay), Math.ceil(rawDelay)));
}

function lifecycleResume(status: IDataObject, retryDecision: IDataObject): IDataObject | null {
  const checkpoint = isRecord(status.lifecycleCheckpoint) ? status.lifecycleCheckpoint : {};
  const stage = toStringValue(status.retryResumeStage ?? retryDecision.resumeStage ?? checkpoint.nextStage);
  if (!stage) return null;
  const providerInvoiceId = toStringValue(status.providerInvoiceId ?? checkpoint.providerInvoiceId);
  const providerCustomerId = toStringValue(status.providerCustomerId ?? checkpoint.providerCustomerId);
  if (['invoice.post', 'invoice.send_email'].includes(stage) && !providerInvoiceId) return null;
  return {
    schemaVersion: '1.0', source: 'status-manager', approved: true, stage,
    requestId: status.requestId, providerId: status.providerId, profileId: status.profileId, accountId: status.accountId,
    providerCustomerId, providerInvoiceId, invoiceNumber: status.invoiceNumber ?? checkpoint.invoiceNumber,
    checkpoint, facts: isRecord(checkpoint.facts) ? checkpoint.facts : {
      providerCustomerId, providerInvoiceId, invoiceNumber: status.invoiceNumber,
    },
    createdAt: nowIso(),
  };
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
  retryResume: IDataObject | null;
  checkedAt: string;
  managedAt: string;
}): IDataObject {
  return {
    schemaVersion: '2.0', event: 'INVOICE_ROUTER_EXECUTION_RESULT', executionId: toStringValue(input.context.getExecutionId?.()),
    workflow: workflowIdentity(input.context), requestId: input.status.requestId, transactionId: input.status.transactionId,
    idempotencyKey: idempotencyKey(input.status), providerId: input.status.providerId, profileId: input.status.profileId,
    accountId: input.status.accountId, actionId: input.status.actionId, workerId: input.status.workerId,
    providerCustomerId: input.status.providerCustomerId, customerStatus: input.status.customerStatus, postStatus: input.status.postStatus,
    emailSendRequested: input.status.emailSendRequested, emailSendStatus: input.status.emailSendStatus,
    emailSendMethod: input.status.emailSendMethod, emailErrorMessage: input.status.emailErrorMessage,
    emailEvidence: input.status.emailEvidence, lifecycleOutcome: input.status.lifecycleOutcome,
    lifecycleFailedStep: input.status.lifecycleFailedStep, lifecycleCheckpoint: input.status.lifecycleCheckpoint,
    recipientEmail: input.status.recipientEmail, result: input.result, workflowState: input.workflowState,
    invoiceStatus: input.status.invoiceStatus, providerStatus: input.status.providerStatus,
    providerInvoiceId: input.status.providerInvoiceId, invoiceNumber: input.status.invoiceNumber,
    httpStatus: input.status.httpStatus, errorType: input.status.errorType, errorCategory: input.status.errorCategory,
    errorSeverity: input.status.errorSeverity, errorCode: input.status.errorCode, errorMessage: input.status.errorMessage,
    retryScheduled: input.retryScheduled, retryCount: input.retryCount, retryDelaySeconds: input.retryDelaySeconds,
    retryDecision: input.retryDecision, retryResume: input.retryResume,
    latencyMs: input.status.latencyMs, responseSizeBytes: input.status.responseSizeBytes,
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
  retryResume: IDataObject | null;
  retryQueueEntry: IDataObject | null;
  managedAt: string;
}): IDataObject {
  const key = writebackKey(input.status, input.keyMode);
  return {
    schemaVersion: '2.0', action: 'UPSERT', target: input.target, keyMode: input.keyMode, key,
    values: {
      requestId: input.status.requestId, transactionId: input.status.transactionId, idempotencyKey: idempotencyKey(input.status),
      jobId: isRecord(input.status.job) ? input.status.job.jobId : undefined, campaignId: isRecord(input.status.job) ? input.status.job.campaignId : undefined,
      providerId: input.status.providerId, profileId: input.status.profileId, accountId: input.status.accountId,
      actionId: input.status.actionId, workerId: input.status.workerId, recipientEmail: input.status.recipientEmail,
      workflowState: input.workflowState, result: input.result, invoiceStatus: input.status.invoiceStatus,
      providerStatus: input.status.providerStatus, transportStatus: input.status.transportStatus,
      providerCustomerId: input.status.providerCustomerId, customerStatus: input.status.customerStatus,
      postStatus: input.status.postStatus, emailSendRequested: input.status.emailSendRequested,
      emailSendStatus: input.status.emailSendStatus, emailSendMethod: input.status.emailSendMethod,
      emailErrorMessage: input.status.emailErrorMessage, emailEvidence: input.status.emailEvidence,
      lifecycleOutcome: input.status.lifecycleOutcome, lifecycleFailedStep: input.status.lifecycleFailedStep,
      lifecycleCheckpoint: input.status.lifecycleCheckpoint, retryResumeStage: input.status.retryResumeStage,
      retryResume: input.retryResume,
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
      presetSelfCheckApproved: input.status.presetSelfCheckApproved, presetSelfCheck: input.status.presetSelfCheck,
      bulkRunId: input.status.bulkRunId, bulkItemNumber: input.status.bulkItemNumber, bulkTotalItems: input.status.bulkTotalItems,
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
    const partialExecution = result === 'PARTIAL_SUCCESS';
    const errorType = toStringValue(status.errorType).toUpperCase();
    const httpStatus = toFiniteNumber(status.httpStatus, 0);
    const existingRetry = toFiniteNumber(item.json.retryCount, 0);
    const retryableByPolicy = status.retryableByPolicy === true;
    const nonRetryableByPolicy = status.nonRetryableByPolicy === true;
    const incomingRetryDecision = isRecord(status.retryDecision) ? status.retryDecision : retryDecisionFallback({
      result, neutralExecution, errorType, httpStatus, retryableByPolicy, nonRetryableByPolicy,
    });
    const proposedResume = lifecycleResume(status, incomingRetryDecision);
    const requestedResumeStage = toStringValue(status.retryResumeStage ?? incomingRetryDecision.resumeStage);
    const resumeRequired = ['invoice.post', 'invoice.send_email'].includes(requestedResumeStage);
    const sideEffectStage = toStringValue(status.sideEffectStage ?? incomingRetryDecision.sideEffectStage, 'none');
    const preSideEffect = sideEffectStage === 'none' && !toStringValue(status.providerInvoiceId);
    const retryable = !neutralExecution && !partialExecution && result !== 'SUCCESS'
      && incomingRetryDecision.retryable === true && incomingRetryDecision.safeToRetry !== false
      && (!resumeRequired || proposedResume !== null);
    const job = jobRecord(item, status);
    const incomingFailover = isRecord(item.json.failoverState) ? item.json.failoverState
      : isRecord(item.json.readyRequest) && isRecord(item.json.readyRequest.failoverState) ? item.json.readyRequest.failoverState : {};
    const currentProfileId = toStringValue(status.profileId);
    const attemptedProfileIds = Array.isArray(incomingFailover.attemptedProfileIds)
      ? incomingFailover.attemptedProfileIds.map((value) => toStringValue(value)).filter(Boolean) : [];
    if (currentProfileId && !attemptedProfileIds.includes(currentProfileId)) attemptedProfileIds.push(currentProfileId);
    const hardAccountFailure = ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'QUOTA_EXHAUSTED_ERROR', 'CONFIGURATION_ERROR'].includes(errorType);
    const shouldRetry = retryable && existingRetry < retryLimit;
    const failoverScheduled = !neutralExecution && !partialExecution && result !== 'SUCCESS' && preSideEffect
      && Boolean(toStringValue(incomingFailover.failoverGroup ?? (isRecord(item.json.readyRequest) ? item.json.readyRequest.failoverGroup : '')))
      && (hardAccountFailure || (retryable && existingRetry >= retryLimit));
    const nextRetryCount = shouldRetry ? existingRetry + 1 : existingRetry;
    const retryDelay = retryDelaySeconds({
      shouldRetry, nextRetryCount, baseDelay: retryBaseDelay, capDelay: retryMaxDelay,
      respectRetryAfter, retryDecision: incomingRetryDecision, status,
    });
    const authFailure = ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR'].includes(errorType);
    const manualFixRequired = ['VALIDATION_ERROR', 'NOT_FOUND_ERROR', 'CONFLICT_ERROR', 'EMAIL_UNVERIFIED', 'CONFIGURATION_ERROR'].includes(errorType);
    const emailQueued = toStringValue(status.emailSendStatus).toUpperCase() === 'QUEUED';
    const recommendation = neutralExecution ? 'NO_CHANGE' : result === 'SUCCESS' ? 'RELEASE'
      : partialExecution ? emailQueued ? 'WAIT' : 'REVIEW'
        : (authFailure && disableOnAuthFailure) || ['QUOTA_EXHAUSTED_ERROR'].includes(errorType) || (errorType === 'CONFIGURATION_ERROR' && /database .*does not exist|unknown database|database not found/i.test(toStringValue(status.errorMessage))) ? 'DISABLE' : manualFixRequired ? 'REVIEW' : 'COOLDOWN';
    const cooldownSeconds = httpStatus === 429 ? Math.max(toFiniteNumber(status.retryAfterSeconds, 0), 60, defaultCooldown) : defaultCooldown;
    const workflowState = failoverScheduled ? 'PENDING_FAILOVER' : workflowStateFor({ duplicateExecution, blockedExecution, neutralExecution, result, shouldRetry });
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
    let runtimeAccountStats: IDataObject = isRecord(status.accountStats) ? status.accountStats : {};
    if (!neutralExecution && !partialExecution && scopeKey && profileId) {
      runtimeAccountStats = applyProviderFeedback(scopeKey, {
        feedbackId, profileId, workerId: toStringValue(status.workerId), status: toStringValue(status.invoiceStatus), result,
        errorType, httpStatus, latencyMs: toFiniteNumber(status.latencyMs), retryCount: nextRetryCount, cooldownSeconds, recommendation,
      }) ?? runtimeAccountStats;
      persistFeedback(this, providerFeedback);
    }
    const retryResume = shouldRetry ? proposedResume : null;
    const failoverGroup = toStringValue(incomingFailover.failoverGroup ?? (isRecord(item.json.readyRequest) ? item.json.readyRequest.failoverGroup : ''));
    const previousProfileId = toStringValue(incomingFailover.currentProfileId);
    const failoverState: IDataObject = {
      schemaVersion: '1.0', failoverGroup, originalProfileId: toStringValue(incomingFailover.originalProfileId, currentProfileId),
      currentProfileId, attemptedProfileIds, failoverCount: Math.max(0, toFiniteNumber(incomingFailover.failoverCount, 0)) + (failoverScheduled ? 1 : 0),
      requiredProfileId: shouldRetry ? currentProfileId : '', queueStatus: failoverScheduled ? 'FAILOVER_READY' : shouldRetry ? 'RETRY_WAIT' : '',
      sideEffectStage, lastErrorType: errorType, lastError: status.errorMessage, updatedAt: managedAt,
    };
    const retryQueueEntry: IDataObject | null = shouldRetry || failoverScheduled ? {
      schemaVersion: '1.0', jobId: job.jobId, campaignId: job.campaignId, recipientEmail: status.recipientEmail,
      requestId: status.requestId, profileId, accountId: status.accountId, retryCount: nextRetryCount,
      scheduledAt: new Date(Date.now() + (shouldRetry ? retryDelay : 1) * 1000).toISOString(), delaySeconds: shouldRetry ? retryDelay : 1,
      queueStatus: failoverScheduled ? 'FAILOVER_READY' : 'RETRY_WAIT',
      reason: toStringValue(incomingRetryDecision.reason) || errorType || `HTTP_${httpStatus}`,
      source: toStringValue(incomingRetryDecision.source), errorType, errorCategory: status.errorCategory,
      retryAfterSeconds: status.retryAfterSeconds, retryDecision: incomingRetryDecision, lifecycleResume: retryResume,
      providerInvoiceId: status.providerInvoiceId, lifecycleCheckpoint: status.lifecycleCheckpoint, failoverState,
    } : null;
    const readyRequest = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
    const retryRequest: IDataObject | null = shouldRetry && Object.keys(readyRequest).length > 0
      ? { ...readyRequest, lifecycleResume: retryResume ?? undefined, failoverState }
      : null;
    const failoverRequest: IDataObject | null = failoverScheduled ? {
      ...item.json, readyRequest: undefined, rawExecution: undefined, standardStatus: undefined, management: undefined, retryCount: 0,
      job: { ...job, attemptCount: Math.max(0, toFiniteNumber(job.attemptCount, 0)) + 1, status: 'FAILOVER' },
      failoverState: { ...failoverState, requiredProfileId: '', queueStatus: 'FAILOVER_READY' },
    } : null;
    const executionLog = buildExecutionLog({
      context: this, status, result, workflowState, retryScheduled: shouldRetry, retryCount: nextRetryCount,
      retryDelaySeconds: retryDelay, retryDecision: incomingRetryDecision, retryResume, checkedAt, managedAt,
    });
    if (persistLog) persistExecutionLog(this, executionLog, executionLogRetention);
    const statusWriteback = buildStatusWriteback({
      status, workflowState, result, keyMode: writebackKeyMode, target: writebackTarget,
      retryScheduled: shouldRetry, retryCount: nextRetryCount, retryDelaySeconds: retryDelay,
      retryDecision: incomingRetryDecision, retryResume, retryQueueEntry, managedAt,
    });
    const emailStatus = toStringValue(status.emailSendStatus).toUpperCase();
    const recipientStatus = recipientOperationalStatus({ duplicate: duplicateExecution, blocked: blockedExecution, result, emailStatus, retrying: shouldRetry, failover: failoverScheduled, errorType });
    const providerState = providerOperationalStatus({ result, errorType, errorMessage: toStringValue(status.errorMessage), retrying: shouldRetry, failover: failoverScheduled, emailQueued });
    const attemptCount = Math.max(toFiniteNumber(job.attemptCount, 0), existingRetry) + (shouldRetry || failoverScheduled ? 1 : 0);
    const recipientStatusWriteback: IDataObject = {
      schemaVersion: '1.0', action: 'UPSERT', target: 'email_list', keyMode: 'Job_ID', key: toStringValue(job.jobId),
      values: { Email: status.recipientEmail, status: recipientStatus, Job_ID: job.jobId, Campaign_ID: job.campaignId,
        Attempt_Count: attemptCount, Last_Account: status.accountId, Last_Error: status.errorMessage, Updated_At: managedAt },
    };
    const providerStatusWriteback: IDataObject = {
      schemaVersion: '1.0', action: 'UPSERT', target: 'provider', keyMode: 'Account', key: toStringValue(status.accountName, toStringValue(status.accountId)),
      values: { Account: toStringValue(status.accountName, toStringValue(status.accountId)), Enabled: providerState.enabled, status: providerState.status, Status_Reason: providerState.reason,
        Auto_Disabled: providerState.autoDisabled, Consecutive_Failures: Math.max(0, toFiniteNumber(runtimeAccountStats.consecutiveFailures, result === 'SUCCESS' ? 0 : existingRetry + 1)),
        Retry_Count: Math.max(0, toFiniteNumber(runtimeAccountStats.retryCount, nextRetryCount)),
        Cooldown_Until: providerState.status === 'RATE_LIMITED' || providerState.status === 'COOLDOWN' ? new Date(Date.now() + cooldownSeconds * 1000).toISOString() : '',
        Last_Error_Type: errorType, Last_Error: status.errorMessage, Last_Used_At: managedAt,
        Total_Allocated: Math.max(0, toFiniteNumber(runtimeAccountStats.totalAllocated, 0)),
        Total_Sent: Math.max(0, toFiniteNumber(runtimeAccountStats.totalSent, 0)),
        Total_Failed: Math.max(0, toFiniteNumber(runtimeAccountStats.totalFailed, 0)), Updated_At: managedAt },
    };
    const retryQueueWriteback: IDataObject = {
      schemaVersion: '1.0', action: 'UPSERT', target: 'retry_queue', keyMode: 'Job_ID', key: toStringValue(job.jobId),
      values: { Job_ID: job.jobId, Campaign_ID: job.campaignId, Recipient_Email: status.recipientEmail,
        Original_Profile_ID: failoverState.originalProfileId, Current_Profile_ID: status.profileId,
        Attempted_Profile_IDs: JSON.stringify(attemptedProfileIds), Failover_Group: failoverState.failoverGroup,
        Side_Effect_Stage: sideEffectStage, Required_Profile_ID: failoverState.requiredProfileId, Provider_Invoice_ID: status.providerInvoiceId,
        Lifecycle_Checkpoint: JSON.stringify(status.lifecycleCheckpoint ?? {}), Resume_Stage: status.retryResumeStage,
        Retry_Count: nextRetryCount, Failover_Count: failoverState.failoverCount,
        Next_Retry_At: isRecord(retryQueueEntry) ? retryQueueEntry.scheduledAt : '', Last_Error_Type: errorType,
        Last_Error: status.errorMessage, Queue_Status: ['SENT','DUPLICATE','QUEUED'].includes(recipientStatus) ? 'COMPLETED' : recipientStatus === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : failoverScheduled ? 'FAILOVER_READY' : shouldRetry ? 'RETRY_WAIT' : 'FAILED_FINAL', Updated_At: managedAt },
    };
    const failoverFrom = previousProfileId && previousProfileId !== currentProfileId ? previousProfileId : failoverScheduled ? currentProfileId : '';
    const failoverTo = previousProfileId && previousProfileId !== currentProfileId ? currentProfileId : '';
    const accountSeedMap = isRecord(job.accountReportSeed) ? job.accountReportSeed : {};
    const accountSeed = isRecord(accountSeedMap[profileId]) ? accountSeedMap[profileId] : {};
    const accountAggregate = updateCampaignAccountStats({
      scopeKey: scopeKey || 'invoice-router', campaignId: toStringValue(job.campaignId, 'default-campaign'), profileId,
      seed: accountSeed,
      event: {
        Allocated: 1, Attempted: 1, Succeeded: result === 'SUCCESS' ? 1 : 0,
        Email_Sent: recipientStatus === 'SENT' ? 1 : 0, Email_Queued: recipientStatus === 'QUEUED' ? 1 : 0,
        Failed: recipientStatus === 'FAILED' ? 1 : 0, Retried: shouldRetry ? 1 : 0,
        Failover_Count: failoverFrom || failoverScheduled ? 1 : 0, Failover_From: failoverFrom, Failover_To: failoverTo,
        Auto_Disabled: providerState.autoDisabled, Disabled_Reason: providerState.reason,
        Last_Error_Type: errorType, Last_Error: status.errorMessage, Current_Status: providerState.status,
        Enabled: providerState.enabled, Last_Used_At: managedAt, Updated_At: managedAt,
      },
    });
    const accountReportEvent: IDataObject = {
      Report_Key: `${toStringValue(job.campaignId)}:${profileId}`, Campaign_ID: job.campaignId,
      Provider: status.providerId, Account_ID: status.accountId, Account_Name: status.accountName, Profile_ID: status.profileId,
      Current_Status: providerState.status, Enabled: providerState.enabled,
      Allocated: accountAggregate.Allocated, Attempted: accountAggregate.Attempted, Succeeded: accountAggregate.Succeeded,
      Email_Sent: accountAggregate.Email_Sent, Email_Queued: accountAggregate.Email_Queued, Failed: accountAggregate.Failed,
      Retried: accountAggregate.Retried, Failover_Count: accountAggregate.Failover_Count,
      Failover_From: accountAggregate.Failover_From, Failover_To: accountAggregate.Failover_To,
      Auto_Disabled: providerState.autoDisabled, Disabled_Reason: providerState.reason,
      Last_Error_Type: errorType, Last_Error: status.errorMessage, Last_Used_At: managedAt, Updated_At: managedAt,
    };
    const campaignReportEvent: IDataObject = {
      Report_Key: `${toStringValue(job.campaignId)}:${toStringValue(job.jobId)}`, Campaign_ID: job.campaignId, Job_ID: job.jobId,
      Recipient_Email: status.recipientEmail, Status: recipientStatus, Pending: ['PENDING','PROCESSING'].includes(recipientStatus) ? 1 : 0,
      Sent: recipientStatus === 'SENT' ? 1 : 0, Queued: recipientStatus === 'QUEUED' ? 1 : 0,
      Failed: recipientStatus === 'FAILED' ? 1 : 0, Manual_Review: recipientStatus === 'MANUAL_REVIEW' ? 1 : 0,
      Duplicate: recipientStatus === 'DUPLICATE' ? 1 : 0, Retrying: recipientStatus === 'RETRYING' ? 1 : 0,
      Failover: recipientStatus === 'FAILOVER' ? 1 : 0, Account_ID: status.accountId, Updated_At: managedAt,
    };
    const alertSeverity = toStringValue(status.alertSeverity) || (authFailure ? 'critical' : httpStatus >= 500 ? 'high' : 'warning');
    const alertNeeded = !neutralExecution && (result !== 'SUCCESS' && !emailQueued) && (result !== 'PARTIAL_SUCCESS' || errorType === 'EMAIL_UNVERIFIED');
    const managementEvents: IDataObject = {
      database: { event: 'UPSERT_INVOICE_RESULT', key: statusWriteback.key, state: workflowState, writeback: statusWriteback },
      dashboard: { event: 'UPDATE_COUNTERS', result, workflowState, providerId: status.providerId, bulkSummary },
      metrics: { event: 'RECORD_EXECUTION', success: result === 'SUCCESS', partial: partialExecution, latencyMs: status.latencyMs, httpStatus, providerId: status.providerId, accountId: status.accountId },
      analytics: { event: 'INVOICE_ROUTER_RESULT', invoiceStatus: status.invoiceStatus, lifecycleOutcome: status.lifecycleOutcome, errorType, errorCategory: status.errorCategory, timestamp: managedAt },
      retryQueue: retryQueueEntry, failover: failoverRequest, recipientStatusWriteback, providerStatusWriteback, retryQueueWriteback, accountReportEvent, campaignReportEvent,
      alert: alertNeeded && alertOnFailure ? { event: 'INVOICE_ROUTER_FAILURE', severity: alertSeverity.toUpperCase(), message: status.errorMessage || errorType || `HTTP ${httpStatus}`, retryScheduled: shouldRetry, retryDecision: incomingRetryDecision } : null,
      notification: alertNeeded ? { event: 'NOTIFICATION_REQUESTED', channels: ['email', 'webhook'], severity: alertSeverity, retryScheduled: shouldRetry } : null,
      audit: { event: 'WORKFLOW_DECISION', requestId: status.requestId, result, workflowState, retryScheduled: shouldRetry, retryDecision: incomingRetryDecision, retryResume, timestamp: managedAt },
    };
    const management: IDataObject = {
      schemaVersion: '2.0', workflowState, completed: workflowState === 'COMPLETED', partial: partialExecution,
      retryScheduled: shouldRetry, failoverScheduled, retryCount: nextRetryCount, retryDelaySeconds: retryDelay,
      retryDecision: incomingRetryDecision, retryResume, retryRequest, failoverRequest, failoverState, retryQueueEntry, providerFeedback, bulkSummary,
      recipientStatusWriteback, providerStatusWriteback, retryQueueWriteback, accountReportEvent, campaignReportEvent,
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
        emailEvidence: status.emailEvidence, lifecycleOutcome: status.lifecycleOutcome,
        lifecycleFailedStep: status.lifecycleFailedStep, lifecycleCheckpoint: status.lifecycleCheckpoint,
        retryResumeStage: status.retryResumeStage, retryResume,
        lifecycleMode: toStringValue(requestMappingValue(status, 'lifecycleMode') ?? requestMappingLifecycle(status).mode),
        lifecycleSteps: lifecycleStepsText(status), providerRecipeId: toStringValue(requestMappingLifecycle(status).recipeId ?? requestMappingValue(status, 'recipeId')),
        invoiceUrl: status.invoiceUrl, pdfUrl: status.pdfUrl, writebackKey: statusWriteback.key,
        errorType, errorCategory: status.errorCategory, retryScheduled: shouldRetry, failoverScheduled, recipientStatus, providerOperationalStatus: providerState.status, retryDelaySeconds: retryDelay,
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
