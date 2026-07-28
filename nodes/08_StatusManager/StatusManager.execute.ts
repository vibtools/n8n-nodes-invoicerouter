import type { IDataObject, IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { applyProviderFeedback, persistFeedback } from '../../shared/runtime/RuntimeStore';
import { isRecord, nowIso, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

const RETRYABLE_HTTP = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERRORS = new Set(['TIMEOUT_ERROR', 'NETWORK_ERROR', 'RATE_LIMIT_ERROR', 'SERVER_ERROR', 'PROVIDER_ERROR']);

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  items.forEach((item, itemIndex) => {
    if (!isRecord(item.json.standardStatus)) throw new Error(`Item ${itemIndex}: Standard Status is missing.`);
    const status = item.json.standardStatus;
    const retryLimit = Math.max(0, toFiniteNumber(this.getNodeParameter('retryLimit', itemIndex, 3), 3));
    const retryBaseDelay = Math.max(1, toFiniteNumber(this.getNodeParameter('retryBaseDelaySeconds', itemIndex, 30), 30));
    const defaultCooldown = Math.max(1, toFiniteNumber(this.getNodeParameter('cooldownSeconds', itemIndex, 30), 30));
    const disableOnAuthFailure = Boolean(this.getNodeParameter('disableOnAuthFailure', itemIndex, true));
    const alertOnFailure = Boolean(this.getNodeParameter('alertOnFailure', itemIndex, true));
    const includeEvents = Boolean(this.getNodeParameter('includeEvents', itemIndex, true));
    const result = toStringValue(status.result, 'UNKNOWN').toUpperCase();
    const transportStatus = toStringValue(status.transportStatus).toUpperCase();
    const neutralExecution = transportStatus === 'DRY_RUN' || transportStatus === 'QUEUED';
    const errorType = toStringValue(status.errorType).toUpperCase();
    const httpStatus = toFiniteNumber(status.httpStatus, 0);
    const existingRetry = toFiniteNumber(item.json.retryCount, 0);
    const retryable = !neutralExecution && result !== 'SUCCESS' && (RETRYABLE_HTTP.has(httpStatus) || RETRYABLE_ERRORS.has(errorType));
    const shouldRetry = retryable && existingRetry < retryLimit;
    const nextRetryCount = shouldRetry ? existingRetry + 1 : existingRetry;
    const retryDelay = shouldRetry ? retryBaseDelay * Math.pow(2, Math.max(0, nextRetryCount - 1)) : 0;
    const authFailure = ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR'].includes(errorType);
    const recommendation = neutralExecution ? 'NO_CHANGE' : result === 'SUCCESS' ? 'RELEASE' : authFailure && disableOnAuthFailure ? 'DISABLE' : 'COOLDOWN';
    const cooldownSeconds = httpStatus === 429 ? Math.max(60, defaultCooldown) : defaultCooldown;
    const workflowState = neutralExecution ? 'PROCESSING' : result === 'SUCCESS' ? 'COMPLETED' : shouldRetry ? 'PENDING_RETRY' : result === 'UNKNOWN' ? 'PROCESSING' : 'FAILED';
    const runtime = isRecord(status.runtime) ? status.runtime : {};
    const scopeKey = toStringValue(runtime.scopeKey);
    const profileId = toStringValue(status.profileId);
    const feedbackId = `${toStringValue(status.requestId, 'unassigned')}:${existingRetry}:${toStringValue(status.checkedAt, nowIso())}`;
    const providerFeedback: IDataObject = {
      feedbackId, scopeKey, providerId: status.providerId, profileId, accountId: status.accountId, workerId: status.workerId,
      invoiceId: status.providerInvoiceId, status: status.invoiceStatus, result, errorType, errorCode: status.errorCode,
      httpStatus, latencyMs: status.latencyMs, retryCount: nextRetryCount, cooldownSeconds, recommendation, timestamp: nowIso(),
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
      reason: errorType || `HTTP_${httpStatus}`,
    } : null;
    const managementEvents: IDataObject = {
      database: { event: 'UPSERT_INVOICE_RESULT', key: status.requestId, state: workflowState, status },
      dashboard: { event: 'UPDATE_COUNTERS', result, workflowState, providerId: status.providerId },
      metrics: { event: 'RECORD_EXECUTION', success: result === 'SUCCESS', latencyMs: status.latencyMs, httpStatus, providerId: status.providerId, accountId: status.accountId },
      analytics: { event: 'INVOICE_ROUTER_RESULT', invoiceStatus: status.invoiceStatus, errorType, timestamp: nowIso() },
      retryQueue: retryQueueEntry,
      alert: !neutralExecution && result !== 'SUCCESS' && alertOnFailure ? { event: 'INVOICE_ROUTER_FAILURE', severity: authFailure ? 'CRITICAL' : httpStatus >= 500 ? 'HIGH' : 'WARNING', message: status.errorMessage || errorType || `HTTP ${httpStatus}` } : null,
      notification: result === 'SUCCESS' || neutralExecution ? null : { event: 'NOTIFICATION_REQUESTED', channels: ['email', 'webhook'], severity: authFailure ? 'critical' : 'warning' },
      audit: { event: 'WORKFLOW_DECISION', requestId: status.requestId, result, workflowState, retryScheduled: shouldRetry, timestamp: nowIso() },
    };
    const management: IDataObject = {
      schemaVersion: '1.0', workflowState, completed: workflowState === 'COMPLETED', retryScheduled: shouldRetry,
      retryCount: nextRetryCount, retryQueueEntry, providerFeedback,
      events: includeEvents ? managementEvents : undefined,
      workflowResult: { requestId: status.requestId, providerId: status.providerId, accountId: status.accountId, invoiceStatus: status.invoiceStatus, result, workflowState, providerInvoiceId: status.providerInvoiceId, invoiceUrl: status.invoiceUrl, pdfUrl: status.pdfUrl },
      managedAt: nowIso(),
    };
    output.push({ json: { ...item.json, management }, pairedItem: { item: itemIndex } });
  });
  return [output];
}
