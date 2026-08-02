import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { buildProviderRequest, normalizeProviderId } from '../../providers';
import { buildDynamicTags, replaceTags } from '../../shared/utils/Template';
import { isRecord, parseJsonObject, slug, toStringValue } from '../../shared/utils/Helpers';

function itemAt(items: INodeExecutionData[], index: number): INodeExecutionData | undefined {
  return items[index] ?? items[0];
}

function safeRecord(value: JsonValue | undefined, label: string): IDataObject {
  if (!isRecord(value)) throw new Error(`${label} is missing or invalid.`);
  return value;
}

function blockedBuild(item: IDataObject, status: string, message: string, allocation: IDataObject, itemIndex: number): INodeExecutionData {
  return { json: { ...item, requestBuild: { success: false, status, message, allocation } }, pairedItem: { item: itemIndex, input: 2 } };
}

function guardCheck(id: string, passed: boolean, message: string): IDataObject {
  return { id, passed, message };
}

function buildSendGuard(input: {
  providerId: string;
  profileId: string;
  accountId: string;
  requestId: string;
  idempotencyValue: string;
  url: string;
  credentialRef: string;
  allowHttp: boolean;
  routing: IDataObject;
  providerValidationErrors: string[];
  method: string;
  contentType: string;
  responsePaths: IDataObject;
}): IDataObject {
  let urlIsSafe = false;
  try {
    const parsed = new URL(input.url.replace(/\{[^}]+\}/g, 'placeholder'));
    urlIsSafe = parsed.protocol === 'https:' || input.allowHttp || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    urlIsSafe = false;
  }
  const checks = [
    guardCheck('providerAllocated', Boolean(input.providerId && input.profileId && input.accountId), 'Provider, profile, and account are resolved.'),
    guardCheck('requestIdentified', Boolean(input.requestId), 'Request ID is resolved.'),
    guardCheck('idempotencyResolved', Boolean(input.idempotencyValue), 'Idempotency value is resolved.'),
    guardCheck('credentialAvailable', Boolean(input.credentialRef), 'Runtime credential reference is present.'),
    guardCheck('providerValidationClean', input.providerValidationErrors.length === 0, 'Provider-specific required field validation passed.'),
    guardCheck('methodAllowed', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method), 'HTTP method is supported by the transport layer.'),
    guardCheck('contentTypeResolved', Boolean(input.contentType), 'Content type is resolved for the provider request.'),
    guardCheck('responseMappingConfigured', Boolean(input.responsePaths.invoiceId && input.responsePaths.status), 'Provider response extraction paths are configured.'),
    guardCheck('urlSafe', urlIsSafe, 'Request URL is HTTPS or an explicitly allowed development URL.'),
  ];
  const approved = checks.every((check) => check.passed === true);
  return {
    schemaVersion: '1.0', approved, mode: 'prepared_request', checkedAt: new Date().toISOString(),
    routing: input.routing, checks,
    decision: approved ? 'APPROVED_FOR_SENDER' : 'BLOCK_BEFORE_SEND',
  };
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const allocationItems = this.getInputData(0);
  const templateItems = this.getInputData(1);
  const recipientItems = this.getInputData(2);
  if (allocationItems.length === 0) throw new Error('Provider Selector input is empty. Connect Provider Selector to input 1.');
  if (templateItems.length === 0) throw new Error('Invoice Template input is empty. Connect Invoice Template to input 2.');
  if (recipientItems.length === 0) throw new Error('Email List input is empty. Connect Email List to input 3.');

  const strictWarnings = Boolean(this.getNodeParameter('strictProviderWarnings', 0, false));
  const strictProviderValidation = Boolean(this.getNodeParameter('strictProviderValidation', 0, false));
  const sendGuardMode = toStringValue(this.getNodeParameter('sendGuardMode', 0, 'audit'));
  const customBody = parseJsonObject(this.getNodeParameter('customBodyJson', 0, '{}'), 'Custom Body Override');
  const extraHeaders = parseJsonObject(this.getNodeParameter('extraHeadersJson', 0, '{}'), 'Extra Headers');
  const extraQuery = parseJsonObject(this.getNodeParameter('extraQueryJson', 0, '{}'), 'Extra Query');
  const idempotencyHeader = toStringValue(this.getNodeParameter('idempotencyHeader', 0, 'Idempotency-Key'));
  const idempotencyKeyMode = toStringValue(this.getNodeParameter('idempotencyKeyMode', 0, 'requestId'));
  const idempotencyScope = toStringValue(this.getNodeParameter('idempotencyScope', 0, 'workflow'));
  const allowHttp = Boolean(this.getNodeParameter('allowHttp', 0, false));
  const output: INodeExecutionData[] = [];

  recipientItems.forEach((recipientItem, itemIndex) => {
    const allocationItem = itemAt(allocationItems, itemIndex);
    const templateItem = itemAt(templateItems, itemIndex);
    const recipient = safeRecord(recipientItem.json.recipient, 'Recipient');
    const allocation = safeRecord(allocationItem?.json.providerAllocation, 'Provider allocation');
    const allocationStatus = toStringValue(allocation.status).toUpperCase();
    if (allocationStatus === 'QUEUED') {
      output.push(blockedBuild(recipientItem.json, 'QUEUED', 'No provider account is currently available.', allocation, itemIndex));
      return;
    }
    if (allocationStatus === 'BLOCKED' || allocationStatus === 'SKIPPED') {
      output.push(blockedBuild(recipientItem.json, allocationStatus, toStringValue(allocation.reason, 'Provider allocation was blocked before request preparation.'), allocation, itemIndex));
      return;
    }
    const template = safeRecord(templateItem?.json.invoiceTemplate, 'Invoice template');
    const providerId = normalizeProviderId(allocation.providerId ?? allocation.providerName);
    const profileId = toStringValue(allocation.id);
    const accountId = toStringValue(allocation.accountId);
    const workerId = toStringValue(allocation.workerId ?? (isRecord(allocation.runtime) && isRecord(allocation.runtime.lock) ? allocation.runtime.lock.workerId : ''), `worker-${itemIndex + 1}`);
    const executionId = toStringValue((allocationItem?.json.runtime && isRecord(allocationItem.json.runtime)) ? allocationItem.json.runtime.executionId : '');
    const tags = buildDynamicTags(`${executionId}:${profileId}:${toStringValue(recipient.email)}:${itemIndex}`, recipient, allocation);
    const resolvedTemplateValue = replaceTags(template, tags);
    const invoice = safeRecord(resolvedTemplateValue, 'Resolved invoice template');
    const build = buildProviderRequest({ providerId, actionId: toStringValue(allocation.actionId), invoice, recipient, profile: allocation });
    const resolvedCustomBody = replaceTags(customBody, tags);
    const body: JsonValue = Object.keys(customBody).length > 0 ? resolvedCustomBody : build.body;
    if (strictProviderValidation && build.errors.length > 0) throw new Error(build.errors.join(' '));
    if (strictWarnings && build.warnings.length > 0) throw new Error(build.warnings.join(' '));

    const baseUrl = toStringValue(allocation.baseUrl).replace(/\/+$/, '');
    const endpoint = toStringValue(allocation.endpoint);
    if (!baseUrl || !endpoint) throw new Error(`Provider profile ${profileId} has no Base URL or Endpoint.`);
    const url = `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;
    const parsed = new URL(url.replace(/\{[^}]+\}/g, 'placeholder'));
    const localhost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(allowHttp || localhost)) throw new Error('Provider URL must use HTTPS. Enable Allow HTTP only for a trusted development endpoint.');

    const requestMapping = isRecord(build.requestMapping) ? build.requestMapping : {};
    const responsePolicy = isRecord(build.responsePolicy) ? build.responsePolicy : {};
    const effectiveMethod = toStringValue(allocation.method || requestMapping.method, 'POST').toUpperCase();
    const effectiveContentType = toStringValue(allocation.contentType || requestMapping.contentType, 'application/json');
    const effectiveIdempotencyHeader = idempotencyHeader || toStringValue(requestMapping.idempotencyHeader, 'Idempotency-Key');
    const headers: IDataObject = {
      Accept: 'application/json',
      'Content-Type': effectiveContentType,
      ...(replaceTags(extraHeaders, tags) as IDataObject),
    };
    const requestId = toStringValue(invoice.invoiceId, tags.INV);
    const query: IDataObject = { ...build.query, ...(replaceTags(extraQuery, tags) as IDataObject) };
    const routing = isRecord(allocation.routing) ? allocation.routing : { enabled: false };
    const environment = toStringValue(allocation.environment, 'live');
    const idempotencyComponents: IDataObject = {
      providerId, profileId, accountId, actionId: toStringValue(allocation.actionId), environment,
      invoiceId: requestId, recipientEmail: toStringValue(recipient.email), transactionId: toStringValue(invoice.transactionId, tags.TRX),
    };
    const stableParts = [providerId, profileId, toStringValue(allocation.actionId), environment, requestId, toStringValue(recipient.email)]
      .map((value) => slug(value) || 'unassigned');
    const invoiceOnlyParts = [providerId, profileId, toStringValue(allocation.actionId), environment, requestId]
      .map((value) => slug(value) || 'unassigned');
    const idempotencyValue = idempotencyKeyMode === 'providerInvoiceRecipient'
      ? stableParts.join(':')
      : idempotencyKeyMode === 'providerInvoiceOnly'
        ? invoiceOnlyParts.join(':')
        : requestId;
    const sendGuard = buildSendGuard({
      providerId, profileId, accountId, requestId, idempotencyValue, url,
      credentialRef: toStringValue(allocation.credentialRef), allowHttp, routing, providerValidationErrors: build.errors,
      method: effectiveMethod, contentType: effectiveContentType, responsePaths: build.responsePaths,
    });
    if (sendGuardMode === 'strict' && sendGuard.approved !== true) throw new Error(`Send guard rejected request ${requestId}.`);
    const readyRequest: IDataObject = {
      schemaVersion: '1.0', requestId, transactionId: toStringValue(invoice.transactionId, tags.TRX),
      providerId, profileId, accountId, workerId, actionId: toStringValue(allocation.actionId), actionName: toStringValue(allocation.actionName),
      method: effectiveMethod, baseUrl, endpoint, url, headers, query, body,
      contentType: effectiveContentType, timeoutMs: allocation.timeoutMs ?? 60_000,
      credentialRef: toStringValue(allocation.credentialRef), authType: toStringValue(allocation.authType),
      idempotency: { header: effectiveIdempotencyHeader, value: idempotencyValue, requestId, mode: idempotencyKeyMode, scope: idempotencyScope, components: idempotencyComponents },
      responsePaths: build.responsePaths, requestMapping, responsePolicy,
      invoice, recipient, warnings: build.warnings, providerValidation: { errors: build.errors, warnings: build.warnings }, sendGuard,
      runtime: { scopeKey: toStringValue(allocation.scopeKey ?? (isRecord(allocationItem?.json.runtime) ? allocationItem?.json.runtime.scopeKey : '')), lock: isRecord(allocation.runtime) ? allocation.runtime.lock : null },
      preparedAt: new Date().toISOString(),
    };
    output.push({
      json: { readyRequest, requestBuild: { success: true, providerId, profileId, accountId, requestId, warningCount: build.warnings.length, providerValidationErrorCount: build.errors.length, sendGuardApproved: sendGuard.approved, responseKind: requestMapping.responseKind } },
      pairedItem: [{ item: Math.min(itemIndex, allocationItems.length - 1), input: 0 }, { item: Math.min(itemIndex, templateItems.length - 1), input: 1 }, { item: itemIndex, input: 2 }],
    });
  });
  return [output];
}
