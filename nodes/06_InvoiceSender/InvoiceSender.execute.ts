import type { IDataObject, IExecuteFunctions, INodeExecutionData, IHttpRequestOptions, JsonValue } from '../../shared/types/N8n';
import { finalizeInvoiceSend, getSecretMaterial, reserveInvoiceSend } from '../../shared/runtime/RuntimeStore';
import { redactJson, redactString, secretValues } from '../../shared/security/Redaction';
import { isRecord, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

function secretVariables(secret: { apiKey: string; apiSecret: string; extraValue: string }): Record<string, string> {
  const variables: Record<string, string> = {
    API_KEY: secret.apiKey, ACCESS_TOKEN: secret.apiKey, API_SECRET: secret.apiSecret, EXTRA_VALUE: secret.extraValue,
    SESSION_ID: secret.extraValue, BASE64_KEY_SECRET: globalThis.btoa(`${secret.apiKey}:${secret.apiSecret}`),
    realmId: secret.extraValue, accountId: secret.extraValue, organizationId: secret.extraValue, tenantId: secret.extraValue, site: secret.extraValue,
  };
  try {
    const parsed: unknown = JSON.parse(secret.extraValue);
    if (isRecord(parsed)) for (const [key, value] of Object.entries(parsed)) variables[key] = toStringValue(value);
  } catch { /* Extra Value may intentionally be plain text. */ }
  return variables;
}

function interpolate(value: string, variables: Record<string, string>): string {
  return value
    .replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => variables[key] ?? '')
    .replace(/\{([^}]+)\}/g, (_match, key: string) => variables[key] ?? `{${key}}`);
}

function interpolateJson(value: JsonValue, variables: Record<string, string>): JsonValue {
  if (typeof value === 'string') return interpolate(value, variables);
  if (Array.isArray(value)) return value.map((entry) => interpolateJson(entry, variables));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) output[key] = entry === undefined ? undefined : interpolateJson(entry, variables);
    return output;
  }
  return value;
}

function formPairs(value: JsonValue, prefix = '', output: Array<[string, string]> = []): Array<[string, string]> {
  if (Array.isArray(value)) value.forEach((entry, index) => formPairs(entry, `${prefix}[${index}]`, output));
  else if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) if (entry !== undefined) formPairs(entry, prefix ? `${prefix}[${key}]` : key, output);
  } else if (value !== undefined && value !== null) output.push([prefix, toStringValue(value)]);
  return output;
}

function parseResponseBody(value: unknown): JsonValue {
  if (typeof value !== 'string') return (value ?? null) as JsonValue;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed) as JsonValue; } catch { return value; }
}

function responseParts(response: unknown): { statusCode: number; headers: IDataObject; body: JsonValue } {
  if (isRecord(response) && ('statusCode' in response || 'body' in response)) {
    return {
      statusCode: toFiniteNumber(response.statusCode, 0),
      headers: isRecord(response.headers) ? response.headers : {},
      body: parseResponseBody(response.body),
    };
  }
  return { statusCode: 200, headers: {}, body: parseResponseBody(response) };
}

function byteSize(value: unknown): number {
  try { return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length; } catch { return 0; }
}

function numericList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toFiniteNumber(entry, NaN)).filter((entry) => Number.isFinite(entry));
}

function unresolvedTokensInString(value: string): string[] {
  const output = new Set<string>();
  for (const match of value.matchAll(/\{\{\s*([^}]+?)\s*\}\}|\{([A-Za-z0-9_.-]+)\}/g)) {
    const token = toStringValue(match[1] ?? match[2]).trim();
    if (token) output.add(token);
  }
  return [...output];
}

function collectUnresolvedTokens(value: unknown, prefix = 'request', output: string[] = []): string[] {
  if (typeof value === 'string') {
    for (const token of unresolvedTokensInString(value)) output.push(`${prefix}:${token}`);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUnresolvedTokens(entry, `${prefix}[${index}]`, output));
  } else if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) collectUnresolvedTokens(entry, `${prefix}.${key}`, output);
  }
  return output;
}


function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function bulkRunId(context: IExecuteFunctions): string {
  return toStringValue(context.getExecutionId?.(), `${Date.now()}`);
}

function bulkSafetySnapshot(input: {
  enabled: boolean;
  runId: string;
  totalItems: number;
  itemIndex: number;
  maxItems: number;
  requireUniformEnvironment: boolean;
  environments: string[];
  delayBetweenSendsMs: number;
  maxFailedSendsBeforeAbort: number;
  stopOnCriticalBulkError: boolean;
  decision: string;
  reason?: string;
  failedSendCount?: number;
}): IDataObject {
  return {
    schemaVersion: '1.0', enabled: input.enabled, runId: input.runId, totalItems: input.totalItems,
    itemIndex: input.itemIndex, itemNumber: input.itemIndex + 1, maxItems: input.maxItems,
    requireUniformEnvironment: input.requireUniformEnvironment, environments: input.environments,
    delayBetweenSendsMs: input.delayBetweenSendsMs, maxFailedSendsBeforeAbort: input.maxFailedSendsBeforeAbort,
    stopOnCriticalBulkError: input.stopOnCriticalBulkError, failedSendCount: input.failedSendCount ?? 0,
    decision: input.decision, reason: input.reason ?? '', checkedAt: new Date().toISOString(),
  };
}

function requestEnvironments(items: INodeExecutionData[]): string[] {
  const environments = new Set<string>();
  for (const item of items) {
    const request = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
    if (Object.keys(request).length === 0) continue;
    environments.add(requestEnvironment(request));
  }
  return [...environments].sort();
}

function isCriticalBulkStatus(status: string, message: string, httpStatus = 0): boolean {
  const normalized = status.toUpperCase();
  const text = message.toLowerCase();
  return [401, 403].includes(httpStatus) ||
    (normalized === 'BLOCKED' && /(activation|send guard|credential|unresolved template|environment|confirmation|validation)/i.test(message)) ||
    /authentication|authorization|unauthorized|forbidden|invalid api key|credential|permission/.test(text);
}

function readPersistedIdempotency(context: IExecuteFunctions): IDataObject[] {
  try {
    const data = context.getWorkflowStaticData?.('global');
    const value = data?.invoiceRouterIdempotency;
    return Array.isArray(value) ? value.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function persistIdempotency(context: IExecuteFunctions, record: IDataObject): void {
  try {
    const data = context.getWorkflowStaticData?.('global');
    if (!data) return;
    const previous = readPersistedIdempotency(context).filter((entry) => !(entry.scopeKey === record.scopeKey && entry.key === record.key));
    data.invoiceRouterIdempotency = [...previous.slice(-999), record];
  } catch {
    // Workflow static data is best-effort; in-process duplicate prevention remains active.
  }
}

function activePersistedDuplicate(context: IExecuteFunctions, scopeKey: string, key: string): IDataObject | undefined {
  const now = Date.now();
  const records = readPersistedIdempotency(context);
  const active = records.filter((entry) => toFiniteNumber(entry.expiresAt, 0) === 0 || toFiniteNumber(entry.expiresAt, 0) > now);
  try {
    const data = context.getWorkflowStaticData?.('global');
    if (data) data.invoiceRouterIdempotency = active.slice(-1000);
  } catch {
    // Ignore persistence cleanup failure.
  }
  return active.find((entry) => entry.scopeKey === scopeKey && entry.key === key && ['RESERVED', 'SENT'].includes(toStringValue(entry.status)));
}

function workflowScope(context: IExecuteFunctions): string {
  const workflow = context.getWorkflow?.();
  return toStringValue(workflow?.id ?? workflow?.name, 'invoice-router');
}

function duplicateScopeKey(context: IExecuteFunctions, request: IDataObject): string {
  const idempotency = isRecord(request.idempotency) ? request.idempotency : {};
  const mode = toStringValue(idempotency.scope, 'workflow');
  const workflow = workflowScope(context);
  if (mode === 'batch') return `batch:${toStringValue(isRecord(request.runtime) ? request.runtime.scopeKey : '', workflow)}`;
  if (mode === 'providerProfile') return `provider-profile:${workflow}:${toStringValue(request.providerId)}:${toStringValue(request.profileId)}`;
  return `workflow:${workflow}`;
}

function requestEnvironment(request: IDataObject): string {
  const idempotency = isRecord(request.idempotency) ? request.idempotency : {};
  const components = isRecord(idempotency.components) ? idempotency.components : {};
  return toStringValue(request.environment ?? components.environment, 'live').trim().toLowerCase() || 'live';
}

function buildActivationSafety(input: {
  mode: string;
  expectedEnvironment: string;
  requestEnvironment: string;
  dryRun: boolean;
  sandboxModeConfirmation: string;
  liveModeConfirmation: string;
}): IDataObject {
  const mode = toStringValue(input.mode, 'compatibility');
  const expectedEnvironment = toStringValue(input.expectedEnvironment, 'any').toLowerCase();
  const environment = toStringValue(input.requestEnvironment, 'live').toLowerCase();
  const expectedMatch = expectedEnvironment === 'any' || environment === expectedEnvironment;
  const base: IDataObject = {
    schemaVersion: '1.0', mode, expectedEnvironment, requestEnvironment: environment, dryRun: input.dryRun,
    checkedAt: new Date().toISOString(), requiredSandboxConfirmation: 'SEND_SANDBOX_INVOICES',
    requiredLiveConfirmation: 'SEND_REAL_INVOICES', expectedMatch,
  };
  const reject = (reason: string): IDataObject => ({ ...base, approved: false, decision: 'BLOCK_BEFORE_TRANSPORT', reason });
  const approve = (reason: string): IDataObject => ({ ...base, approved: true, decision: 'APPROVED_FOR_TRANSPORT', reason });

  if (mode === 'compatibility') return approve('Compatibility mode preserves the existing Dry Run / Live Mode Confirmation behavior.');
  if (!expectedMatch) return reject(`Request environment ${environment} does not match expected environment ${expectedEnvironment}.`);
  if (mode === 'dryRunValidation') {
    if (!input.dryRun) return reject('Dry Run Validation mode requires Invoice Sender Dry Run to remain enabled.');
    if (environment === 'live') return reject('Dry Run Validation mode blocks live-routed requests. Use sandbox-routed rows for first import validation.');
    return approve('Dry Run Validation mode approved a non-live dry-run request.');
  }
  if (mode === 'sandboxRealSend') {
    if (input.dryRun) return reject('Sandbox Real Send mode requires Dry Run to be disabled after dry-run validation passes.');
    if (environment !== 'sandbox') return reject(`Sandbox Real Send mode only allows sandbox-routed requests, received ${environment}.`);
    if (input.sandboxModeConfirmation !== 'SEND_SANDBOX_INVOICES') return reject('Sandbox Real Send mode requires Sandbox Mode Confirmation to equal SEND_SANDBOX_INVOICES.');
    return approve('Sandbox Real Send mode approved a sandbox-routed real HTTP request.');
  }
  if (mode === 'liveRealSend') {
    if (input.dryRun) return reject('Live Real Send mode requires Dry Run to be disabled only after sandbox evidence is accepted.');
    if (environment !== 'live') return reject(`Live Real Send mode only allows live-routed requests, received ${environment}.`);
    if (input.liveModeConfirmation !== 'SEND_REAL_INVOICES') return reject('Live Real Send mode requires Live Mode Confirmation to equal SEND_REAL_INVOICES.');
    return approve('Live Real Send mode approved a live-routed real HTTP request.');
  }
  return reject(`Unsupported Activation Safety Mode ${mode}.`);
}

function buildProductionPresetSelfCheck(input: {
  mode: string;
  dryRun: boolean;
  activationSafetyMode: string;
  expectedEnvironment: string;
  requireSendGuard: boolean;
  preventDuplicateSends: boolean;
  enableBulkSafety: boolean;
  requireUniformEnvironment: boolean;
  stopOnTransportError: boolean;
  stopOnCriticalBulkError: boolean;
  maxInvoicesPerExecution: number;
  maxFailedSendsBeforeAbort: number;
  totalItems: number;
  sandboxModeConfirmation: string;
  liveModeConfirmation: string;
  sandboxBulkConfirmation: string;
  liveBulkConfirmation: string;
}): IDataObject {
  const mode = toStringValue(input.mode, 'off');
  const expectedEnvironment = toStringValue(input.expectedEnvironment, 'any').toLowerCase();
  const activationSafetyMode = toStringValue(input.activationSafetyMode, 'compatibility');
  const failures: string[] = [];
  const require = (condition: boolean, message: string): void => { if (!condition) failures.push(message); };
  const commonStrict = (): void => {
    require(input.requireSendGuard, 'Require Send Guard must stay enabled.');
    require(input.preventDuplicateSends, 'Prevent Duplicate Sends must stay enabled.');
    require(input.enableBulkSafety, 'Enable Bulk Run Safety must stay enabled.');
    require(input.requireUniformEnvironment, 'Require Uniform Environment must stay enabled.');
    require(!input.stopOnTransportError, 'Stop on Transport Error must remain disabled so Status Checker/Manager can classify failures.');
    require(input.stopOnCriticalBulkError, 'Stop on Critical Bulk Error must stay enabled.');
    require(input.maxInvoicesPerExecution >= Math.max(1, input.totalItems), 'Max Invoices Per Execution must allow the current guarded batch size.');
  };

  if (mode === 'off') {
    return { schemaVersion: '1.0', mode, approved: true, decision: 'NOT_ENFORCED', failures, checkedAt: new Date().toISOString() };
  }
  commonStrict();
  if (mode === 'dryRunValidation') {
    require(input.dryRun, 'Dry Run Validation preset requires Dry Run to be enabled.');
    require(activationSafetyMode === 'dryRunValidation', 'Activation Safety Mode must be Dry Run Validation.');
    require(expectedEnvironment === 'sandbox', 'Expected Request Environment must be sandbox for first import validation.');
    require(input.sandboxModeConfirmation === '', 'Sandbox Mode Confirmation must remain blank in dry-run validation.');
    require(input.liveModeConfirmation === '', 'Live Mode Confirmation must remain blank in dry-run validation.');
    require(input.sandboxBulkConfirmation === '', 'Sandbox Bulk Confirmation must remain blank in dry-run validation.');
    require(input.liveBulkConfirmation === '', 'Live Bulk Confirmation must remain blank in dry-run validation.');
  } else if (mode === 'sandboxRealSend') {
    require(!input.dryRun, 'Sandbox Real Send preset requires Dry Run to be disabled intentionally.');
    require(activationSafetyMode === 'sandboxRealSend', 'Activation Safety Mode must be Sandbox Real Send.');
    require(expectedEnvironment === 'sandbox', 'Expected Request Environment must be sandbox.');
    require(input.sandboxModeConfirmation === 'SEND_SANDBOX_INVOICES', 'Sandbox Mode Confirmation must equal SEND_SANDBOX_INVOICES.');
    require(input.liveModeConfirmation !== 'SEND_REAL_INVOICES', 'Live Mode Confirmation must not be armed during sandbox real sends.');
    if (input.totalItems > 1) require(input.sandboxBulkConfirmation === 'SEND_BULK_SANDBOX_INVOICES', 'Sandbox Bulk Confirmation must equal SEND_BULK_SANDBOX_INVOICES for multi-item sandbox sends.');
  } else if (mode === 'liveRealSend') {
    require(!input.dryRun, 'Live Real Send preset requires Dry Run to be disabled intentionally.');
    require(activationSafetyMode === 'liveRealSend', 'Activation Safety Mode must be Live Real Send.');
    require(expectedEnvironment === 'live', 'Expected Request Environment must be live.');
    require(input.liveModeConfirmation === 'SEND_REAL_INVOICES', 'Live Mode Confirmation must equal SEND_REAL_INVOICES.');
    if (input.totalItems > 1) require(input.liveBulkConfirmation === 'SEND_BULK_REAL_INVOICES', 'Live Bulk Confirmation must equal SEND_BULK_REAL_INVOICES for multi-item live sends.');
    require(input.maxFailedSendsBeforeAbort > 0, 'Max Failed Sends Before Abort must be greater than 0 for live sends.');
  } else {
    failures.push(`Unsupported Production Preset Self-Check mode ${mode}.`);
  }

  return {
    schemaVersion: '1.0', mode, approved: failures.length === 0,
    decision: failures.length === 0 ? 'APPROVED_PRESET' : 'BLOCK_RUN', failures,
    checkedAt: new Date().toISOString(), expected: { activationSafetyMode: mode, expectedEnvironment },
  };
}

function idempotencyRecord(request: IDataObject, scopeKey: string, key: string, status: string, ttlMs: number, message = ''): IDataObject {
  const now = Date.now();
  return {
    schemaVersion: '1.0', scopeKey, key, status, requestId: request.requestId, transactionId: request.transactionId,
    providerId: request.providerId, profileId: request.profileId, accountId: request.accountId, actionId: request.actionId,
    idempotency: isRecord(request.idempotency) ? request.idempotency : null, message,
    createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), expiresAt: now + Math.max(1, ttlMs),
  };
}

function guardedRawExecution(item: IDataObject, status: string, message: string, itemIndex: number, idempotencyRecord?: IDataObject, activationSafety?: IDataObject, bulkSafety?: IDataObject, presetSelfCheck?: IDataObject): INodeExecutionData {
  const request = isRecord(item.readyRequest) ? item.readyRequest : {};
  const build = isRecord(item.requestBuild) ? item.requestBuild : {};
  const allocation = isRecord(build.allocation) ? build.allocation : {};
  const now = new Date().toISOString();
  return { json: { ...item, rawExecution: {
    schemaVersion: '1.0', success: false, transportStatus: status, requestId: request.requestId ?? build.requestId ?? '',
    providerId: request.providerId ?? allocation.providerId, profileId: request.profileId ?? allocation.id, accountId: request.accountId ?? allocation.accountId,
    workerId: request.workerId ?? allocation.workerId, actionId: request.actionId ?? allocation.actionId, httpStatus: 0,
    responseHeaders: {}, responseBody: null, latencyMs: 0, responseSizeBytes: 0,
    guard: request.sendGuard ?? allocation.routing ?? null, activationSafety: activationSafety ?? request.activationSafety ?? null, bulkSafety: bulkSafety ?? request.bulkSafety ?? null, presetSelfCheck: presetSelfCheck ?? request.presetSelfCheck ?? null, idempotency: request.idempotency ?? null,
    duplicate: status === 'DUPLICATE' ? { blocked: true, message, existing: idempotencyRecord ?? null } : undefined,
    queueReason: status === 'QUEUED' ? message : undefined,
    error: ['BLOCKED', 'DUPLICATE'].includes(status) ? { message } : undefined,
    startedAt: now, finishedAt: now, responsePaths: request.responsePaths, responsePolicy: request.responsePolicy,
    requestMapping: request.requestMapping, runtime: request.runtime ?? { scopeKey: allocation.scopeKey },
  } }, pairedItem: { item: itemIndex } };
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const output: INodeExecutionData[] = [];
  const totalItems = items.length;
  const firstIndex = 0;
  const enableBulkSafety = Boolean(this.getNodeParameter('enableBulkSafety', firstIndex, false));
  const maxInvoicesPerExecution = Math.max(1, toFiniteNumber(this.getNodeParameter('maxInvoicesPerExecution', firstIndex, 100), 100));
  const requireUniformEnvironment = Boolean(this.getNodeParameter('requireUniformEnvironment', firstIndex, true));
  const delayBetweenSendsMs = Math.max(0, toFiniteNumber(this.getNodeParameter('delayBetweenSendsMs', firstIndex, 0), 0));
  const maxFailedSendsBeforeAbort = Math.max(0, toFiniteNumber(this.getNodeParameter('maxFailedSendsBeforeAbort', firstIndex, 5), 5));
  const stopOnCriticalBulkError = Boolean(this.getNodeParameter('stopOnCriticalBulkError', firstIndex, true));
  const sandboxBulkConfirmation = toStringValue(this.getNodeParameter('sandboxBulkConfirmation', firstIndex, ''));
  const liveBulkConfirmation = toStringValue(this.getNodeParameter('liveBulkConfirmation', firstIndex, ''));
  const productionPresetMode = toStringValue(this.getNodeParameter('productionPresetMode', firstIndex, 'off'));
  const firstDryRun = Boolean(this.getNodeParameter('dryRun', firstIndex, false));
  const firstRequireSendGuard = Boolean(this.getNodeParameter('requireSendGuard', firstIndex, false));
  const firstActivationSafetyMode = toStringValue(this.getNodeParameter('activationSafetyMode', firstIndex, 'compatibility'));
  const firstExpectedEnvironment = toStringValue(this.getNodeParameter('expectedEnvironment', firstIndex, 'any'));
  const firstSandboxModeConfirmation = toStringValue(this.getNodeParameter('sandboxModeConfirmation', firstIndex, ''));
  const firstLiveModeConfirmation = toStringValue(this.getNodeParameter('liveModeConfirmation', firstIndex, ''));
  const firstPreventDuplicateSends = Boolean(this.getNodeParameter('preventDuplicateSends', firstIndex, false));
  const firstStopOnTransportError = Boolean(this.getNodeParameter('stopOnTransportError', firstIndex, false));
  const runId = bulkRunId(this);
  const environments = requestEnvironments(items);
  const commonBulk = {
    enabled: enableBulkSafety, runId, totalItems, maxItems: maxInvoicesPerExecution, requireUniformEnvironment,
    environments, delayBetweenSendsMs, maxFailedSendsBeforeAbort, stopOnCriticalBulkError,
  };
  const presetSelfCheck = buildProductionPresetSelfCheck({
    mode: productionPresetMode, dryRun: firstDryRun, activationSafetyMode: firstActivationSafetyMode,
    expectedEnvironment: firstExpectedEnvironment, requireSendGuard: firstRequireSendGuard,
    preventDuplicateSends: firstPreventDuplicateSends, enableBulkSafety, requireUniformEnvironment,
    stopOnTransportError: firstStopOnTransportError, stopOnCriticalBulkError, maxInvoicesPerExecution,
    maxFailedSendsBeforeAbort, totalItems, sandboxModeConfirmation: firstSandboxModeConfirmation,
    liveModeConfirmation: firstLiveModeConfirmation, sandboxBulkConfirmation, liveBulkConfirmation,
  });
  const blockEntireRun = (reason: string, selfCheck: IDataObject | undefined = undefined): INodeExecutionData[][] => {
    items.forEach((item, itemIndex) => {
      const bulkSafety = bulkSafetySnapshot({ ...commonBulk, itemIndex, decision: 'BLOCK_RUN', reason });
      output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, undefined, bulkSafety, selfCheck));
    });
    return [output];
  };
  if (presetSelfCheck.approved !== true) return blockEntireRun(`Production preset self-check failed: ${Array.isArray(presetSelfCheck.failures) ? presetSelfCheck.failures.join(' ') : 'unsafe configuration'}`, presetSelfCheck);
  if (enableBulkSafety && totalItems > maxInvoicesPerExecution) return blockEntireRun(`Bulk safety blocked ${totalItems} items because Max Invoices Per Execution is ${maxInvoicesPerExecution}.`);
  if (enableBulkSafety && requireUniformEnvironment && environments.length > 1) return blockEntireRun(`Bulk safety blocked mixed request environments: ${environments.join(', ')}.`);
  let failedSendCount = 0;
  let abortRemainingReason = '';
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const startedAt = new Date();
    const started = Date.now();
    const dryRun = Boolean(this.getNodeParameter('dryRun', itemIndex, false));
    const includeResponseBody = Boolean(this.getNodeParameter('includeResponseBody', itemIndex, true));
    const requireSendGuard = Boolean(this.getNodeParameter('requireSendGuard', itemIndex, false));
    const liveModeConfirmation = toStringValue(this.getNodeParameter('liveModeConfirmation', itemIndex, ''));
    const activationSafetyMode = toStringValue(this.getNodeParameter('activationSafetyMode', itemIndex, 'compatibility'));
    const expectedEnvironment = toStringValue(this.getNodeParameter('expectedEnvironment', itemIndex, 'any'));
    const sandboxModeConfirmation = toStringValue(this.getNodeParameter('sandboxModeConfirmation', itemIndex, ''));
    const preventDuplicateSends = Boolean(this.getNodeParameter('preventDuplicateSends', itemIndex, false));
    const duplicateTtlHours = Math.max(1, toFiniteNumber(this.getNodeParameter('duplicateTtlHours', itemIndex, 720), 720));
    const reservationTtlMinutes = Math.max(1, toFiniteNumber(this.getNodeParameter('reservationTtlMinutes', itemIndex, 15), 15));
    const stopOnTransportError = Boolean(this.getNodeParameter('stopOnTransportError', itemIndex, false));
    const bulkSafetyBase = bulkSafetySnapshot({
      ...commonBulk, itemIndex, decision: abortRemainingReason ? 'ABORT_REMAINING' : 'APPROVED_FOR_ITEM',
      reason: abortRemainingReason, failedSendCount,
    });
    if (enableBulkSafety && abortRemainingReason) {
      output.push(guardedRawExecution(item.json, 'BLOCKED', abortRemainingReason, itemIndex, undefined, undefined, bulkSafetyBase, presetSelfCheck));
      continue;
    }
    const abortRemainingIfCritical = (status: string, message: string, httpStatus = 0): void => {
      if (enableBulkSafety && stopOnCriticalBulkError && isCriticalBulkStatus(status, message, httpStatus)) {
        abortRemainingReason = `Bulk safety stopped remaining items after critical error on item ${itemIndex + 1}: ${message}`;
      }
    };
    let activeSecrets: string[] = [];
    let reservedDuplicateKey = '';
    let reservedDuplicateScope = '';
    let activationSafety: IDataObject | undefined;
    try {
      if (!isRecord(item.json.readyRequest)) {
        const build = isRecord(item.json.requestBuild) ? item.json.requestBuild : {};
        const status = toStringValue(build.status).toUpperCase();
        if (['QUEUED', 'BLOCKED', 'SKIPPED'].includes(status)) {
          const reason = toStringValue(build.message, status === 'QUEUED' ? 'No provider account is currently available.' : 'Request was blocked before sending.');
          output.push(guardedRawExecution(item.json, status, reason, itemIndex, undefined, undefined, bulkSafetyBase, presetSelfCheck));
          abortRemainingIfCritical(status, reason);
          continue;
        }
        throw new Error('Ready Request is missing.');
      }
      const request = item.json.readyRequest;
      request.presetSelfCheck = presetSelfCheck;
      const sendGuard = isRecord(request.sendGuard) ? request.sendGuard : {};
      if (requireSendGuard && sendGuard.approved !== true) {
        const reason = 'Send guard is required but did not approve this request.';
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, undefined, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      activationSafety = buildActivationSafety({
        mode: activationSafetyMode, expectedEnvironment, requestEnvironment: requestEnvironment(request), dryRun,
        sandboxModeConfirmation, liveModeConfirmation,
      });
      request.activationSafety = activationSafety;
      if (activationSafety.approved !== true) {
        const reason = toStringValue(activationSafety.reason, 'Activation safety gate blocked this request.');
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      if (activationSafetyMode === 'compatibility' && !dryRun && requireSendGuard && liveModeConfirmation !== 'SEND_REAL_INVOICES') {
        const reason = 'Live mode is blocked until Live Mode Confirmation equals SEND_REAL_INVOICES.';
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      if (enableBulkSafety && !dryRun && totalItems > 1 && activationSafetyMode === 'sandboxRealSend' && sandboxBulkConfirmation !== 'SEND_BULK_SANDBOX_INVOICES') {
        const reason = 'Bulk sandbox real send requires Sandbox Bulk Confirmation to equal SEND_BULK_SANDBOX_INVOICES.';
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      if (enableBulkSafety && !dryRun && totalItems > 1 && activationSafetyMode === 'liveRealSend' && liveBulkConfirmation !== 'SEND_BULK_REAL_INVOICES') {
        const reason = 'Bulk live real send requires Live Bulk Confirmation to equal SEND_BULK_REAL_INVOICES.';
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      request.bulkSafety = bulkSafetyBase;
      const credentialRef = toStringValue(request.credentialRef);
      const secret = getSecretMaterial(credentialRef);
      if (!secret) throw new Error('Provider credential reference is unavailable. Run Provider Loader in the same active n8n process and batch.');
      const variables = secretVariables(secret);
      const secrets = secretValues(secret);
      activeSecrets = secrets;
      const headers: Record<string, string> = {};
      if (isRecord(request.headers)) for (const [key, value] of Object.entries(request.headers)) if (value != null) headers[key] = interpolate(toStringValue(value), variables);
      if (secret.headerName && secret.headerValue) headers[secret.headerName] = interpolate(secret.headerValue, variables);
      else if (secret.authType === 'bearer' || secret.authType === 'oauth2') headers.Authorization = `Bearer ${secret.apiKey}`;
      else if (secret.authType === 'basic') headers.Authorization = `Basic ${variables.BASE64_KEY_SECRET}`;
      else if (secret.authType === 'token') headers.Authorization = `token ${secret.apiKey}:${secret.apiSecret}`;
      else if (secret.authType === 'session') headers[secret.headerName || 'Cookie'] = secret.headerValue ? interpolate(secret.headerValue, variables) : `session_id=${secret.extraValue}`;
      if (isRecord(request.idempotency)) {
        const header = toStringValue(request.idempotency.header);
        if (header) headers[header] = toStringValue(request.idempotency.value);
      }
      const query: Record<string, string> = {};
      if (isRecord(request.query)) for (const [key, value] of Object.entries(request.query)) if (value != null) query[key] = interpolate(toStringValue(value), variables);
      const contentType = toStringValue(request.contentType, 'application/json').toLowerCase();
      const bodyValue = interpolateJson((request.body ?? null) as JsonValue, variables);
      const body = contentType.includes('application/x-www-form-urlencoded') ? new URLSearchParams(formPairs(bodyValue)).toString() : bodyValue;
      const options: IHttpRequestOptions = {
        method: toStringValue(request.method, 'POST').toUpperCase() as IHttpRequestOptions['method'],
        url: interpolate(toStringValue(request.url), variables), headers, qs: Object.keys(query).length ? query : undefined,
        body, json: !contentType.includes('application/x-www-form-urlencoded'), timeout: Math.max(1, toFiniteNumber(request.timeoutMs, 60_000)),
        returnFullResponse: true, ignoreHttpStatusErrors: true,
      };
      const unresolvedTokens = [
        ...collectUnresolvedTokens(options.url, 'url'),
        ...collectUnresolvedTokens(headers, 'headers'),
        ...collectUnresolvedTokens(query, 'query'),
        ...collectUnresolvedTokens(body, 'body'),
      ];
      if (!dryRun && unresolvedTokens.length > 0) {
        const reason = `Provider request contains unresolved template tokens: ${unresolvedTokens.join(', ')}.`;
        output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
        abortRemainingIfCritical('BLOCKED', reason);
        continue;
      }
      if (dryRun) {
        output.push({ json: { ...item.json, rawExecution: {
          schemaVersion: '1.0', success: true, transportStatus: 'DRY_RUN', requestId: request.requestId,
          providerId: request.providerId, profileId: request.profileId, accountId: request.accountId, workerId: request.workerId,
          httpStatus: 0, responseHeaders: {}, responseBody: null, latencyMs: 0, responseSizeBytes: 0,
          requestPreview: { method: options.method, url: redactString(options.url, secrets), headerNames: Object.keys(headers), queryNames: Object.keys(query), contentType, unresolvedTokens },
          idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null,
          startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), runtime: request.runtime,
        } }, pairedItem: { item: itemIndex } });
        continue;
      }
      if (preventDuplicateSends) {
        const idempotency = isRecord(request.idempotency) ? request.idempotency : {};
        const key = toStringValue(idempotency.value ?? request.requestId).trim();
        const scopeKey = duplicateScopeKey(this, request);
        if (!key) {
          const reason = 'Duplicate prevention is enabled but the idempotency key is empty.';
          output.push(guardedRawExecution(item.json, 'BLOCKED', reason, itemIndex, undefined, activationSafety, bulkSafetyBase, presetSelfCheck));
          abortRemainingIfCritical('BLOCKED', reason);
          continue;
        }
        const persistedDuplicate = activePersistedDuplicate(this, scopeKey, key);
        if (persistedDuplicate) {
          output.push(guardedRawExecution(item.json, 'DUPLICATE', `Duplicate invoice send blocked for idempotency key ${key}.`, itemIndex, persistedDuplicate, activationSafety, bulkSafetyBase, presetSelfCheck));
          continue;
        }
        const ttlMs = duplicateTtlHours * 60 * 60 * 1000;
        const reservationTtlMs = reservationTtlMinutes * 60 * 1000;
        const baseRecord = idempotencyRecord(request, scopeKey, key, 'RESERVED', reservationTtlMs, 'Live send reserved before provider transport.');
        const runtimeReservation = reserveInvoiceSend(scopeKey, key, baseRecord, reservationTtlMs);
        if (runtimeReservation.duplicate === true) {
          const existing = isRecord(runtimeReservation.existing) ? runtimeReservation.existing : runtimeReservation;
          output.push(guardedRawExecution(item.json, 'DUPLICATE', `Duplicate invoice send blocked for idempotency key ${key}.`, itemIndex, existing, activationSafety, bulkSafetyBase, presetSelfCheck));
          continue;
        }
        persistIdempotency(this, baseRecord);
        reservedDuplicateKey = key;
        reservedDuplicateScope = scopeKey;
        request.duplicatePrevention = { enabled: true, scopeKey, key, ttlHours: duplicateTtlHours, reserved: true };
        request.idempotencyRetentionMs = ttlMs;
      }
      const response = await this.helpers.httpRequest(options);
      const parts = responseParts(response);
      const finishedAt = new Date();
      const safeBody = includeResponseBody ? redactJson(parts.body, secrets) : null;
      const successStatusCodes = numericList(isRecord(request.responsePolicy) ? request.responsePolicy.successStatusCodes : []);
      const transportSuccess = successStatusCodes.length > 0 ? successStatusCodes.includes(parts.statusCode) : parts.statusCode >= 200 && parts.statusCode < 300;
      if (preventDuplicateSends && reservedDuplicateKey && reservedDuplicateScope) {
        const ttlMs = duplicateTtlHours * 60 * 60 * 1000;
        const status = transportSuccess ? 'SENT' : 'FAILED';
        const record = idempotencyRecord(request, reservedDuplicateScope, reservedDuplicateKey, status, ttlMs, transportSuccess ? 'Provider transport completed successfully.' : `Provider transport failed with HTTP ${parts.statusCode}.`);
        finalizeInvoiceSend(reservedDuplicateScope, reservedDuplicateKey, status, { httpStatus: parts.statusCode, finishedAt: finishedAt.toISOString() });
        persistIdempotency(this, record);
      }
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: transportSuccess, transportStatus: 'COMPLETED',
        requestId: request.requestId, transactionId: request.transactionId, providerId: request.providerId, profileId: request.profileId,
        accountId: request.accountId, workerId: request.workerId, actionId: request.actionId, httpStatus: parts.statusCode,
        responseHeaders: redactJson(parts.headers, secrets), responseBody: safeBody, latencyMs: Date.now() - started,
        responseSizeBytes: byteSize(parts.body), idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, duplicatePrevention: request.duplicatePrevention ?? null, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        responsePaths: request.responsePaths, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null, runtime: request.runtime,
      } }, pairedItem: { item: itemIndex } });
      if (!transportSuccess && enableBulkSafety) {
        failedSendCount += 1;
        const failureReason = `Provider transport failed with HTTP ${parts.statusCode}.`;
        if (stopOnCriticalBulkError && isCriticalBulkStatus('COMPLETED', failureReason, parts.statusCode)) abortRemainingReason = `Bulk safety stopped remaining items after critical HTTP ${parts.statusCode} on item ${itemIndex + 1}.`;
        else if (maxFailedSendsBeforeAbort > 0 && failedSendCount >= maxFailedSendsBeforeAbort) abortRemainingReason = `Bulk safety stopped remaining items after ${failedSendCount} failed provider sends.`;
      }
      if (enableBulkSafety && !dryRun && delayBetweenSendsMs > 0 && itemIndex < items.length - 1 && !abortRemainingReason) await wait(delayBetweenSendsMs);
    } catch (error) {
      const message = redactString(error instanceof Error ? error.message : String(error), activeSecrets);
      const request = isRecord(item.json.readyRequest) ? item.json.readyRequest : {};
      if (preventDuplicateSends && reservedDuplicateKey && reservedDuplicateScope) {
        const ttlMs = duplicateTtlHours * 60 * 60 * 1000;
        const record = idempotencyRecord(request, reservedDuplicateScope, reservedDuplicateKey, 'FAILED', ttlMs, message);
        finalizeInvoiceSend(reservedDuplicateScope, reservedDuplicateKey, 'FAILED', { errorMessage: message, finishedAt: new Date().toISOString() });
        persistIdempotency(this, record);
      }
      if (stopOnTransportError && !this.continueOnFail()) throw new Error(`${this.getNode().name} item ${itemIndex}: ${message}`);
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: false, transportStatus: /timeout/i.test(message) ? 'TIMEOUT' : 'ERROR',
        requestId: request.requestId, providerId: request.providerId, profileId: request.profileId, accountId: request.accountId,
        workerId: request.workerId, actionId: request.actionId, httpStatus: 0, responseHeaders: {}, responseBody: null,
        latencyMs: Date.now() - started, responseSizeBytes: 0, error: { message }, idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
        responsePaths: request.responsePaths, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null, runtime: request.runtime,
      } }, pairedItem: { item: itemIndex } });
      if (enableBulkSafety) {
        failedSendCount += 1;
        if (stopOnCriticalBulkError && isCriticalBulkStatus('ERROR', message)) abortRemainingReason = `Bulk safety stopped remaining items after critical transport error on item ${itemIndex + 1}: ${message}`;
        else if (maxFailedSendsBeforeAbort > 0 && failedSendCount >= maxFailedSendsBeforeAbort) abortRemainingReason = `Bulk safety stopped remaining items after ${failedSendCount} failed provider sends.`;
      }
    }
  }
  return [output];
}
