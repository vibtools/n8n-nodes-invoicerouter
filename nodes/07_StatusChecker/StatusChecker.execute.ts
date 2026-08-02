import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { getByPath, isRecord, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const STATUS_MAP: Record<string, string> = {
  draft: 'DRAFT', created: 'CREATED', open: 'SENT', sent: 'SENT', delivered: 'SENT', viewed: 'VIEWED',
  pending: 'PENDING', processing: 'PROCESSING', queued: 'QUEUED', accepted: 'QUEUED', unverified: 'UNVERIFIED',
  paid: 'PAID', succeeded: 'PAID', completed: 'PAID', complete: 'PAID',
  overdue: 'OVERDUE', past_due: 'OVERDUE', void: 'CANCELLED', voided: 'CANCELLED', cancelled: 'CANCELLED', canceled: 'CANCELLED',
  failed: 'FAILED', error: 'FAILED', refunded: 'REFUNDED', partially_paid: 'PARTIALLY_PAID',
};

interface ErrorClassification extends IDataObject {
  errorType: string | null;
  category: string;
  severity: string;
  alertSeverity: string;
  retryable: boolean;
  safeToRetry: boolean;
  source: string;
  reason: string;
}

function normalizeStatus(value: unknown, fallback: string): string {
  const key = toStringValue(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_MAP[key] ?? (key ? key.toUpperCase() : fallback);
}

function numericList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toFiniteNumber(entry, NaN)).filter((entry) => Number.isFinite(entry));
}

function firstByPath(body: unknown, pathsValue: unknown, fallback: string): unknown {
  const paths = Array.isArray(pathsValue) ? pathsValue.map((path) => toStringValue(path)) : [toStringValue(pathsValue, fallback)];
  for (const path of paths) {
    const found = getByPath(body, path);
    if (found !== undefined && found !== null && toStringValue(found).trim() !== '') return found;
  }
  return undefined;
}

function flattenText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return toStringValue(value); }
}

function booleanValue(value: unknown): boolean {
  if (value === true) return true;
  return ['true', '1', 'yes', 'on', 'requested'].includes(toStringValue(value).trim().toLowerCase());
}

function headerValue(headers: unknown, name: string): string {
  if (!isRecord(headers)) return '';
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value.map((entry) => toStringValue(entry)).filter(Boolean).join(', ');
    return toStringValue(value);
  }
  return '';
}

function parseRetryAfter(value: string, nowMs = Date.now()): number {
  const text = value.trim();
  if (!text) return 0;
  const seconds = Number(text);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const dateMs = Date.parse(text);
  if (!Number.isFinite(dateMs)) return 0;
  return Math.max(0, Math.ceil((dateMs - nowMs) / 1000));
}

function parseRateLimitReset(value: string, nowMs = Date.now()): number {
  const number = Number(value.trim());
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (number > 1_000_000_000_000) return Math.max(0, Math.ceil((number - nowMs) / 1000));
  if (number > 1_000_000_000) return Math.max(0, Math.ceil((number * 1000 - nowMs) / 1000));
  return Math.max(0, Math.ceil(number));
}

function retryAfterSeconds(headers: unknown): number {
  const retryAfter = parseRetryAfter(headerValue(headers, 'retry-after'));
  if (retryAfter > 0) return retryAfter;
  for (const name of ['x-ratelimit-reset', 'x-rate-limit-reset', 'ratelimit-reset', 'rate-limit-reset']) {
    const reset = parseRateLimitReset(headerValue(headers, name));
    if (reset > 0) return reset;
  }
  return 0;
}

function successClassification(reason = 'Provider response matched the success policy.'): ErrorClassification {
  return {
    errorType: null, category: 'success', severity: 'none', alertSeverity: 'none', retryable: false,
    safeToRetry: false, source: 'success', reason,
  };
}

function baseClassification(input: {
  httpStatus: number;
  transport: string;
  body: unknown;
  message: string;
  retryableByPolicy: boolean;
  nonRetryableByPolicy: boolean;
  success: boolean;
}): ErrorClassification {
  if (input.success) return successClassification();

  const combined = `${input.message} ${flattenText(input.body)}`.toLowerCase();
  if (input.transport === 'TIMEOUT' || /timeout|timed out|deadline exceeded/.test(combined)) {
    return {
      errorType: 'TIMEOUT_ERROR', category: 'transport', severity: 'medium', alertSeverity: 'warning',
      retryable: true, safeToRetry: true, source: 'transport', reason: 'Provider transport timed out before a terminal response.',
    };
  }
  if (input.httpStatus === 401 || /invalid token|expired token|authentication|unauthorized|invalid api key/.test(combined)) {
    return {
      errorType: 'AUTHENTICATION_ERROR', category: 'authentication', severity: 'critical', alertSeverity: 'critical',
      retryable: false, safeToRetry: false, source: 'http_or_message', reason: 'Authentication failed and requires credential review.',
    };
  }
  if (input.httpStatus === 403 || /forbidden|permission|authorization|not authorized|access denied/.test(combined)) {
    return {
      errorType: 'AUTHORIZATION_ERROR', category: 'authorization', severity: 'critical', alertSeverity: 'critical',
      retryable: false, safeToRetry: false, source: 'http_or_message', reason: 'Provider rejected authorization or permissions.',
    };
  }
  if (input.httpStatus === 429 || /rate.?limit|too many requests|quota exceeded/.test(combined)) {
    return {
      errorType: 'RATE_LIMIT_ERROR', category: 'rate_limit', severity: 'medium', alertSeverity: 'warning',
      retryable: true, safeToRetry: true, source: 'http_or_message', reason: 'Provider rate limit was reached.',
    };
  }
  if ([408, 425].includes(input.httpStatus)) {
    return {
      errorType: 'RETRYABLE_PROVIDER_ERROR', category: 'provider_retryable', severity: 'medium', alertSeverity: 'warning',
      retryable: true, safeToRetry: true, source: 'http_status', reason: `HTTP ${input.httpStatus} is retryable for guarded invoice send attempts.`,
    };
  }
  if (input.httpStatus >= 500) {
    return {
      errorType: 'SERVER_ERROR', category: 'provider_server', severity: 'high', alertSeverity: 'high',
      retryable: true, safeToRetry: true, source: 'http_status', reason: `Provider returned HTTP ${input.httpStatus}.`,
    };
  }
  if ([400, 422].includes(input.httpStatus) || /validation|invalid field|required field|required parameter|missing required|invalid request|parameter_unknown/.test(combined)) {
    return {
      errorType: 'VALIDATION_ERROR', category: 'validation', severity: 'medium', alertSeverity: 'warning',
      retryable: false, safeToRetry: false, source: 'http_or_message', reason: 'Provider rejected request validation; fix request data before retrying.',
    };
  }
  if (input.httpStatus === 404 || /not found|unknown customer|unknown invoice/.test(combined)) {
    return {
      errorType: 'NOT_FOUND_ERROR', category: 'not_found', severity: 'medium', alertSeverity: 'warning',
      retryable: false, safeToRetry: false, source: 'http_or_message', reason: 'Referenced provider resource was not found.',
    };
  }
  if (input.nonRetryableByPolicy) {
    return {
      errorType: 'PROVIDER_ERROR', category: 'provider_non_retryable', severity: 'medium', alertSeverity: 'warning',
      retryable: false, safeToRetry: false, source: 'responsePolicy.nonRetryableStatusCodes',
      reason: `HTTP ${input.httpStatus} is marked non-retryable by provider response policy.`,
    };
  }
  if (input.retryableByPolicy) {
    return {
      errorType: 'RETRYABLE_PROVIDER_ERROR', category: 'provider_retryable', severity: 'medium', alertSeverity: 'warning',
      retryable: true, safeToRetry: true, source: 'responsePolicy.retryableStatusCodes',
      reason: `HTTP ${input.httpStatus} is marked retryable by provider response policy.`,
    };
  }
  if (input.httpStatus === 409 || /duplicate|already exists|conflict|idempotency/.test(combined)) {
    const retryableConflict = /locked|try again|concurrent|temporar/.test(combined);
    return {
      errorType: 'CONFLICT_ERROR', category: 'conflict', severity: 'medium', alertSeverity: 'warning',
      retryable: retryableConflict, safeToRetry: retryableConflict, source: 'http_or_message',
      reason: retryableConflict ? 'Provider conflict appears temporary.' : 'Provider conflict requires review before retry.',
    };
  }
  if (input.httpStatus === 0 && input.transport === 'ERROR') {
    return {
      errorType: 'NETWORK_ERROR', category: 'transport', severity: 'medium', alertSeverity: 'warning',
      retryable: true, safeToRetry: true, source: 'transport', reason: 'Network/transport failed before an HTTP response was received.',
    };
  }
  if (input.httpStatus >= 400) {
    return {
      errorType: 'PROVIDER_ERROR', category: 'provider_non_retryable', severity: 'medium', alertSeverity: 'warning',
      retryable: false, safeToRetry: false, source: 'http_status', reason: `Provider returned non-success HTTP ${input.httpStatus}.`,
    };
  }
  return {
    errorType: 'UNKNOWN_ERROR', category: 'unknown', severity: 'medium', alertSeverity: 'warning',
    retryable: false, safeToRetry: false, source: 'fallback', reason: 'Provider result could not be classified as success or retryable.',
  };
}

function lifecycleRecords(body: unknown): { lifecycle: IDataObject; checkpoint: IDataObject; evidence: IDataObject } {
  const root = isRecord(body) ? body : {};
  const result = isRecord(root.result) ? root.result : {};
  const lifecycle = isRecord(result.lifecycle) ? result.lifecycle : {};
  const checkpoint = isRecord(lifecycle.checkpoint) ? lifecycle.checkpoint
    : isRecord(lifecycle.lifecycleCheckpoint) ? lifecycle.lifecycleCheckpoint
      : isRecord(result.lifecycleCheckpoint) ? result.lifecycleCheckpoint : {};
  const evidence = isRecord(lifecycle.emailEvidence) ? lifecycle.emailEvidence
    : isRecord(lifecycle.email_evidence) ? lifecycle.email_evidence
      : isRecord(checkpoint.emailEvidence) ? checkpoint.emailEvidence : {};
  return { lifecycle, checkpoint, evidence };
}

function lifecycleFailureClassification(stage: string, message: string, evidence: IDataObject): ErrorClassification {
  const text = `${message} ${flattenText(evidence)}`.toLowerCase();
  const authentication = /authentication|unauthorized|invalid api key|expired token/.test(text);
  const authorization = /forbidden|permission|authorization|access denied/.test(text);
  if (authentication) return {
    errorType: 'AUTHENTICATION_ERROR', category: 'authentication', severity: 'critical', alertSeverity: 'critical',
    retryable: false, safeToRetry: false, source: 'lifecycle_evidence', reason: 'Lifecycle operation failed authentication.',
  };
  if (authorization) return {
    errorType: 'AUTHORIZATION_ERROR', category: 'authorization', severity: 'critical', alertSeverity: 'critical',
    retryable: false, safeToRetry: false, source: 'lifecycle_evidence', reason: 'Lifecycle operation was denied by provider permissions.',
  };
  const transient = /timeout|timed out|temporar|try again|connection|smtp|mail_smtp|server error|service unavailable|rate.?limit|locked|concurrent/.test(text);
  const validation = /missing recipient|invalid recipient|invalid email address|missing email address|did not resolve an email recipient|template|validation|required field|not found|does not match/.test(text);
  const emailStage = stage === 'invoice.send_email';
  return {
    errorType: emailStage ? 'EMAIL_SEND_ERROR' : stage === 'invoice.post' ? 'INVOICE_POST_ERROR' : 'LIFECYCLE_ERROR',
    category: emailStage ? 'lifecycle_email' : stage === 'invoice.post' ? 'lifecycle_post' : 'lifecycle',
    severity: transient ? 'high' : 'medium', alertSeverity: transient ? 'high' : 'warning',
    retryable: transient && !validation, safeToRetry: transient && !validation,
    source: 'lifecycle_evidence',
    reason: transient && !validation
      ? `Provider lifecycle stage ${stage || 'unknown'} failed transiently and may resume from its checkpoint.`
      : `Provider lifecycle stage ${stage || 'unknown'} requires review before retry.`,
  };
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  items.forEach((item, itemIndex) => {
    if (!isRecord(item.json.rawExecution)) throw new Error(`Item ${itemIndex}: Raw Execution is missing.`);
    const raw = item.json.rawExecution;
    const request = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
    const recipient = isRecord(request.recipient) ? request.recipient : {};
    const body = raw.responseBody;
    const headers = isRecord(raw.responseHeaders) ? raw.responseHeaders : {};
    const paths = isRecord(raw.responsePaths) ? raw.responsePaths : {};
    const httpStatus = toFiniteNumber(raw.httpStatus, 0);
    const transport = toStringValue(raw.transportStatus, 'UNKNOWN').toUpperCase();
    const responsePolicy = isRecord(raw.responsePolicy) ? raw.responsePolicy : isRecord(request.responsePolicy) ? request.responsePolicy : {};
    const retryableStatuses = numericList(responsePolicy.retryableStatusCodes);
    const nonRetryableStatuses = numericList(responsePolicy.nonRetryableStatusCodes);
    const successStatusCodes = numericList(responsePolicy.successStatusCodes);
    const providerStatus = firstByPath(body, paths.status, 'status');
    const transportErrorMessage = toStringValue(firstByPath(body, paths.errorMessage, 'error.message') ?? (isRecord(raw.error) ? raw.error.message : ''));
    const duplicateTransport = transport === 'DUPLICATE';
    const blockedTransport = transport === 'BLOCKED' || transport === 'SKIPPED' || duplicateTransport;
    const neutralTransport = transport === 'DRY_RUN' || transport === 'QUEUED' || blockedTransport;
    const retryableByPolicy = !neutralTransport && retryableStatuses.includes(httpStatus);
    const nonRetryableByPolicy = !neutralTransport && nonRetryableStatuses.includes(httpStatus);
    const transportSuccess = raw.success === true && (successStatusCodes.length > 0 ? successStatusCodes.includes(httpStatus) : httpStatus >= 200 && httpStatus < 300);
    let classification: ErrorClassification = neutralTransport
      ? { errorType: null, category: 'neutral', severity: 'none', alertSeverity: 'none', retryable: false, safeToRetry: false, source: 'transport', reason: `Neutral transport status ${transport}.` }
      : baseClassification({ httpStatus, transport, body, message: transportErrorMessage, retryableByPolicy, nonRetryableByPolicy, success: transportSuccess });

    const { lifecycle, checkpoint, evidence } = lifecycleRecords(body);
    const lifecycleOutcome = toStringValue(lifecycle.lifecycleOutcome ?? lifecycle.outcome ?? checkpoint.outcome).toUpperCase();
    const lifecycleFailedStep = toStringValue(lifecycle.failedStep ?? lifecycle.failed_step ?? checkpoint.failedStep ?? checkpoint.nextStage);
    const lifecycleInvoiceStatus = toStringValue(lifecycle.invoiceStatus ?? lifecycle.invoice_status ?? checkpoint.invoiceStatus).toUpperCase();
    const postStatus = toStringValue(lifecycle.postStatus ?? lifecycle.post_status ?? checkpoint.postStatus).toUpperCase();
    const emailSendRequestedRaw = lifecycle.emailSendRequested ?? lifecycle.email_send_requested ?? checkpoint.emailSendRequested ?? getByPath(body, 'odoo.send_invoice_email');
    const emailSendRequested = booleanValue(emailSendRequestedRaw);
    const emailSendStatus = toStringValue(lifecycle.emailSendStatus ?? lifecycle.email_send_status ?? checkpoint.emailSendStatus).toUpperCase();
    const emailSendMethod = toStringValue(lifecycle.emailSendMethod ?? lifecycle.email_send_method ?? getByPath(body, 'odoo.email_method'));
    const emailErrorMessage = toStringValue(lifecycle.emailErrorMessage ?? lifecycle.email_error_message ?? checkpoint.errorMessage ?? getByPath(body, 'odoo.email_error_message'));

    let semanticResult = duplicateTransport ? 'DUPLICATE' : blockedTransport ? 'BLOCKED'
      : transport === 'TIMEOUT' ? 'TIMEOUT' : transportSuccess ? 'SUCCESS'
        : transport === 'ERROR' ? 'ERROR' : httpStatus ? 'FAILED' : 'UNKNOWN';
    let semanticErrorMessage = transportErrorMessage;
    let retryResumeStage = '';
    if (!neutralTransport && Object.keys(lifecycle).length > 0) {
      if (postStatus === 'FAILED' || lifecycleFailedStep === 'invoice.post') {
        semanticResult = 'FAILED';
        semanticErrorMessage = emailErrorMessage || transportErrorMessage || 'Invoice post/finalize lifecycle stage failed.';
        retryResumeStage = 'invoice.post';
        classification = lifecycleFailureClassification(retryResumeStage, semanticErrorMessage, evidence);
      } else if (emailSendRequested) {
        if (emailSendStatus === 'SENT') {
          semanticResult = 'SUCCESS';
          semanticErrorMessage = '';
          classification = successClassification('Provider-side email evidence confirmed sent status.');
        } else if (emailSendStatus === 'QUEUED') {
          semanticResult = 'PARTIAL_SUCCESS';
          semanticErrorMessage = '';
          classification = {
            errorType: null, category: 'lifecycle_processing', severity: 'none', alertSeverity: 'none', retryable: false,
            safeToRetry: false, source: 'lifecycle_evidence', reason: 'Provider accepted the invoice email into its outgoing queue.',
          };
        } else if (emailSendStatus === 'UNVERIFIED') {
          semanticResult = 'PARTIAL_SUCCESS';
          semanticErrorMessage = emailErrorMessage || 'Invoice send wizard completed, but terminal email evidence is unavailable.';
          classification = {
            errorType: 'EMAIL_UNVERIFIED', category: 'lifecycle_verification', severity: 'low', alertSeverity: 'warning',
            retryable: false, safeToRetry: false, source: 'lifecycle_evidence',
            reason: 'Automatic retry is blocked because the email may already have been sent.',
          };
        } else if (emailSendStatus === 'FAILED' || emailSendStatus === 'PENDING' || lifecycleOutcome === 'FAILED') {
          semanticResult = 'FAILED';
          semanticErrorMessage = emailErrorMessage || transportErrorMessage || 'Invoice email lifecycle stage failed.';
          retryResumeStage = lifecycleFailedStep || 'invoice.send_email';
          classification = lifecycleFailureClassification(retryResumeStage, semanticErrorMessage, evidence);
        }
      } else if (lifecycleOutcome === 'PARTIAL' || lifecycleOutcome === 'PROCESSING') {
        semanticResult = 'PARTIAL_SUCCESS';
      } else if (lifecycleOutcome === 'FAILED') {
        semanticResult = 'FAILED';
        semanticErrorMessage = emailErrorMessage || transportErrorMessage || 'Provider lifecycle failed.';
        retryResumeStage = lifecycleFailedStep;
        classification = lifecycleFailureClassification(retryResumeStage, semanticErrorMessage, evidence);
      } else if (lifecycleOutcome === 'COMPLETED') {
        semanticResult = 'SUCCESS';
        classification = successClassification('Provider lifecycle completed the requested stages.');
      }
    }

    const retryAfter = retryAfterSeconds(headers);
    const retryDelayHint = classification.safeToRetry && retryAfter > 0 ? retryAfter : 0;
    const retryDecision: IDataObject = {
      retryable: classification.retryable, safeToRetry: classification.safeToRetry, source: classification.source,
      reason: classification.reason, retryAfterSeconds: retryAfter, retryDelayHintSeconds: retryDelayHint,
      errorType: classification.errorType, errorCategory: classification.category, httpStatus,
      resumeStage: retryResumeStage, lifecycleCheckpoint: checkpoint,
    };
    const unknownSuccessStatus = toStringValue(this.getNodeParameter('unknownSuccessStatus', itemIndex, 'CREATED'), 'CREATED').toUpperCase();
    const fallbackInvoiceStatus = duplicateTransport ? 'DUPLICATE' : blockedTransport ? 'BLOCKED' : neutralTransport ? 'PENDING'
      : normalizeStatus(providerStatus, semanticResult === 'SUCCESS' ? unknownSuccessStatus : semanticResult === 'PARTIAL_SUCCESS' ? 'CREATED' : 'FAILED');
    const invoiceStatus = lifecycleInvoiceStatus || fallbackInvoiceStatus;
    const parsedMetadata: IDataObject = {
      invoiceId: toStringValue(firstByPath(body, paths.invoiceId, 'id')),
      invoiceNumber: toStringValue(firstByPath(body, paths.invoiceNumber, 'invoice_number')),
      invoiceUrl: toStringValue(firstByPath(body, paths.invoiceUrl, 'hosted_invoice_url')),
      pdfUrl: toStringValue(firstByPath(body, paths.pdfUrl, 'invoice_pdf')),
      transactionId: toStringValue(firstByPath(body, paths.transactionId, 'transaction_id') ?? raw.transactionId),
      providerReference: toStringValue(getByPath(body, 'reference') ?? getByPath(body, 'data.reference')),
      providerCustomerId: toStringValue(firstByPath(body, paths.providerCustomerId, 'result.partner_id') ?? checkpoint.providerCustomerId),
      customerStatus: toStringValue(firstByPath(body, paths.customerStatus, 'result.lifecycle.customerStatus') ?? checkpoint.customerStatus),
      postStatus,
      emailSendRequested, emailSendStatus, emailSendMethod, emailErrorMessage,
      lifecycleOutcome, lifecycleFailedStep, lifecycleCheckpoint: checkpoint, emailEvidence: evidence,
    };
    const includeParsedMetadata = Boolean(this.getNodeParameter('includeParsedMetadata', itemIndex, true));
    const standardStatus: IDataObject = {
      schemaVersion: '1.0', requestId: raw.requestId, providerId: raw.providerId, profileId: raw.profileId, accountId: raw.accountId,
      workerId: raw.workerId, actionId: raw.actionId, transportStatus: transport, result: semanticResult, invoiceStatus,
      providerStatus: toStringValue(providerStatus), providerInvoiceId: parsedMetadata.invoiceId, invoiceNumber: parsedMetadata.invoiceNumber,
      providerCustomerId: parsedMetadata.providerCustomerId, customerStatus: parsedMetadata.customerStatus,
      postStatus: parsedMetadata.postStatus, emailSendRequested: parsedMetadata.emailSendRequested,
      emailSendStatus: parsedMetadata.emailSendStatus, emailSendMethod: parsedMetadata.emailSendMethod,
      emailErrorMessage: parsedMetadata.emailErrorMessage, emailEvidence: evidence,
      lifecycleOutcome, lifecycleFailedStep, lifecycleCheckpoint: checkpoint, retryResumeStage,
      partialSuccess: semanticResult === 'PARTIAL_SUCCESS', httpStatus,
      errorType: classification.errorType, errorCategory: classification.category, errorSeverity: classification.severity,
      alertSeverity: classification.alertSeverity, errorCode: toStringValue(firstByPath(body, paths.errorCode, 'error.code')),
      errorMessage: semanticErrorMessage, latencyMs: raw.latencyMs, responseSizeBytes: raw.responseSizeBytes,
      invoiceUrl: parsedMetadata.invoiceUrl, pdfUrl: parsedMetadata.pdfUrl, transactionId: parsedMetadata.transactionId,
      recipientEmail: toStringValue(recipient.email), idempotency: raw.idempotency ?? request.idempotency ?? null,
      duplicatePrevention: raw.duplicatePrevention ?? request.duplicatePrevention ?? null,
      bulkSafety: raw.bulkSafety ?? request.bulkSafety ?? null,
      bulkRunId: isRecord(raw.bulkSafety) ? raw.bulkSafety.runId : isRecord(request.bulkSafety) ? request.bulkSafety.runId : undefined,
      bulkItemNumber: isRecord(raw.bulkSafety) ? raw.bulkSafety.itemNumber : isRecord(request.bulkSafety) ? request.bulkSafety.itemNumber : undefined,
      bulkTotalItems: isRecord(raw.bulkSafety) ? raw.bulkSafety.totalItems : isRecord(request.bulkSafety) ? request.bulkSafety.totalItems : undefined,
      bulkDecision: isRecord(raw.bulkSafety) ? raw.bulkSafety.decision : isRecord(request.bulkSafety) ? request.bulkSafety.decision : undefined,
      activationSafety: raw.activationSafety ?? request.activationSafety ?? null,
      presetSelfCheck: raw.presetSelfCheck ?? request.presetSelfCheck ?? null,
      presetSelfCheckMode: isRecord(raw.presetSelfCheck) ? raw.presetSelfCheck.mode : isRecord(request.presetSelfCheck) ? request.presetSelfCheck.mode : undefined,
      presetSelfCheckApproved: isRecord(raw.presetSelfCheck) ? raw.presetSelfCheck.approved : isRecord(request.presetSelfCheck) ? request.presetSelfCheck.approved : undefined,
      activationMode: isRecord(raw.activationSafety) ? raw.activationSafety.mode : isRecord(request.activationSafety) ? request.activationSafety.mode : undefined,
      activationApproved: isRecord(raw.activationSafety) ? raw.activationSafety.approved : isRecord(request.activationSafety) ? request.activationSafety.approved : undefined,
      retryableByPolicy, nonRetryableByPolicy, retryAfterSeconds: retryAfter, retryDelayHintSeconds: retryDelayHint,
      retryDecision, errorClassification: classification,
      responsePolicy: raw.responsePolicy ?? request.responsePolicy ?? null,
      requestMapping: raw.requestMapping ?? request.requestMapping ?? null,
      lifecycleResume: raw.lifecycleResume ?? request.lifecycleResume ?? null,
      sendGuard: raw.guard ?? request.sendGuard ?? null, startedAt: raw.startedAt, finishedAt: raw.finishedAt,
      parsedMetadata: includeParsedMetadata ? parsedMetadata : undefined,
      runtime: raw.runtime, checkedAt: nowIso(),
    };
    output.push({ json: { ...item.json, standardStatus }, pairedItem: { item: itemIndex } });
  });
  return [output];
}
