import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, JsonValue } from '../shared/types/N8n';
import { getByPath, isRecord, toFiniteNumber, toStringValue } from '../shared/utils/Helpers';

export interface DeclarativeRuntimeSecret {
  apiKey: string;
  apiSecret: string;
  extraValue: string;
  username?: string;
  password?: string;
  database?: string;
  extraConfig?: IDataObject;
}

interface ResponseParts {
  statusCode: number;
  headers: IDataObject;
  body: JsonValue;
}

function parseResponseBody(value: unknown): JsonValue {
  if (typeof value !== 'string') return (value ?? null) as JsonValue;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed) as JsonValue; } catch { return value; }
}

function responseParts(response: unknown): ResponseParts {
  if (isRecord(response) && ('statusCode' in response || 'body' in response)) {
    return {
      statusCode: toFiniteNumber(response.statusCode, 0),
      headers: isRecord(response.headers) ? response.headers : {},
      body: parseResponseBody(response.body),
    };
  }
  return { statusCode: 200, headers: {}, body: parseResponseBody(response) };
}

function asJsonValue(value: unknown): JsonValue {
  if (value === undefined) return '';
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((entry) => asJsonValue(entry));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) output[key] = asJsonValue(entry);
    return output;
  }
  return toStringValue(value);
}

function secretVariables(secret: DeclarativeRuntimeSecret): IDataObject {
  const output: IDataObject = {
    API_KEY: secret.apiKey, ACCESS_TOKEN: secret.apiKey, API_SECRET: secret.apiSecret,
    USERNAME: toStringValue(secret.username || secret.apiKey), PASSWORD: toStringValue(secret.password || secret.apiSecret),
    DATABASE: toStringValue(secret.database), DB: toStringValue(secret.database), EXTRA_VALUE: secret.extraValue,
    TENANT_ID: secret.extraValue, ORGANIZATION_ID: secret.extraValue, REALM_ID: secret.extraValue, ACCOUNT_ID: secret.extraValue,
  };
  try {
    const parsed: unknown = JSON.parse(secret.extraValue || '{}');
    if (isRecord(parsed)) for (const [key, value] of Object.entries(parsed)) output[key] = asJsonValue(value);
  } catch {
    // Extra Value can intentionally be plain text.
  }
  return output;
}

function pathValue(context: IDataObject, path: string): unknown {
  if (!path) return '';
  const direct = getByPath(context, path);
  if (direct !== undefined) return direct;
  return getByPath(isRecord(context.secrets) ? context.secrets : {}, path) ?? '';
}

function renderString(template: string, context: IDataObject): JsonValue {
  const exact = template.match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/);
  if (exact) return asJsonValue(pathValue(context, exact[1].trim()));
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => toStringValue(pathValue(context, key.trim())));
}

function renderJson(value: unknown, context: IDataObject): JsonValue {
  if (typeof value === 'string') return renderString(value, context);
  if (Array.isArray(value)) return value.map((entry) => renderJson(entry, context));
  if (isRecord(value)) {
    const output: IDataObject = {};
    for (const [key, entry] of Object.entries(value)) output[key] = renderJson(entry, context);
    return output;
  }
  return asJsonValue(value);
}

function renderStringRecord(value: unknown, context: IDataObject): Record<string, string> {
  if (!isRecord(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) output[key] = toStringValue(renderJson(entry, context));
  return output;
}

function lifecycleMode(request: IDataObject): string {
  const mapping = isRecord(request.requestMapping) ? request.requestMapping : {};
  const lifecycle = isRecord(mapping.lifecycle) ? mapping.lifecycle : {};
  return toStringValue(mapping.lifecycleMode ?? lifecycle.mode, 'createOnly');
}

function lifecycleStepSet(request: IDataObject): Set<string> {
  const mapping = isRecord(request.requestMapping) ? request.requestMapping : {};
  const lifecycle = isRecord(mapping.lifecycle) ? mapping.lifecycle : {};
  const raw = Array.isArray(lifecycle.steps) ? lifecycle.steps : Array.isArray(mapping.lifecycleSteps) ? mapping.lifecycleSteps : [];
  return new Set(raw.map((entry) => toStringValue(entry)).filter(Boolean));
}

function declarativeRecipe(request: IDataObject): IDataObject {
  const mapping = isRecord(request.requestMapping) ? request.requestMapping : {};
  const lifecycle = isRecord(mapping.lifecycle) ? mapping.lifecycle : {};
  const recipe = isRecord(lifecycle.declarativeRecipe) ? lifecycle.declarativeRecipe : isRecord(mapping.declarativeRecipe) ? mapping.declarativeRecipe : {};
  if (!isRecord(recipe) || Object.keys(recipe).length === 0) throw new Error('Declarative provider recipe is missing from request mapping.');
  return recipe;
}

function stepId(step: IDataObject, index: number): string {
  return toStringValue(step.id ?? step.name ?? step.lifecycleStep, `step_${index + 1}`);
}

function stepLifecycleId(step: IDataObject, index: number): string {
  return toStringValue(step.lifecycleStep ?? step.id ?? step.name, `step_${index + 1}`);
}

function shouldRunStep(step: IDataObject, request: IDataObject): boolean {
  const mode = lifecycleMode(request);
  const allowedModes = Array.isArray(step.lifecycleModes) ? step.lifecycleModes.map((entry) => toStringValue(entry)) : [];
  if (allowedModes.length > 0 && !allowedModes.includes(mode)) return false;
  const onlyWhenLifecycleIncludes = toStringValue(step.onlyWhenLifecycleIncludes ?? step.lifecycleStep);
  if (onlyWhenLifecycleIncludes && !lifecycleStepSet(request).has(onlyWhenLifecycleIncludes)) return false;
  const skipWhenLifecycleExcludes = toStringValue(step.skipWhenLifecycleExcludes);
  if (skipWhenLifecycleExcludes && !lifecycleStepSet(request).has(skipWhenLifecycleExcludes)) return false;
  return step.enabled !== false;
}

function requestForStep(baseOptions: IHttpRequestOptions, step: IDataObject, context: IDataObject): IHttpRequestOptions {
  const request = isRecord(step.request) ? step.request : step;
  const method = toStringValue(request.method ?? baseOptions.method, 'POST').toUpperCase() as IHttpRequestOptions['method'];
  const url = toStringValue(renderJson(request.url ?? baseOptions.url, context));
  const headers = { ...(baseOptions.headers ?? {}), ...renderStringRecord(request.headers, context) };
  const qs = { ...(baseOptions.qs ?? {}), ...renderStringRecord(request.query ?? request.qs, context) };
  const body = request.body === undefined ? undefined : renderJson(request.body, context);
  const timeout = Math.max(1, toFiniteNumber(request.timeoutMs ?? baseOptions.timeout, baseOptions.timeout ?? 60_000));
  const encoding = toStringValue(request.bodyEncoding ?? request.encoding, 'json').toLowerCase();
  return {
    method, url, headers, qs, body, json: encoding !== 'raw', timeout,
    returnFullResponse: true, ignoreHttpStatusErrors: true,
  };
}

function firstMappedValue(body: unknown, paths: unknown): JsonValue {
  const candidates = Array.isArray(paths) ? paths : [paths];
  for (const path of candidates) {
    const key = toStringValue(path);
    if (!key) continue;
    const value = getByPath(body, key);
    if (value !== undefined && value !== null && value !== '') return asJsonValue(value);
  }
  return '';
}

function applyResponseMap(target: IDataObject, map: unknown, body: unknown): void {
  if (!isRecord(map)) return;
  for (const [key, paths] of Object.entries(map)) {
    const value = firstMappedValue(body, paths);
    if (value !== '') target[key] = value;
  }
}

function normalizeLifecycleStatus(value: unknown): string {
  return toStringValue(value).trim().replace(/[\s-]+/g, '_').toUpperCase();
}

function normalizedEmailStatus(mapped: IDataObject, parts: ResponseParts): string {
  const explicit = normalizeLifecycleStatus(mapped.emailSendStatus ?? mapped.email_send_status);
  if (['SENT', 'DELIVERED', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(explicit)) return 'SENT';
  if (['QUEUED', 'PENDING', 'PROCESSING', 'ACCEPTED', 'OUTGOING'].includes(explicit)) return 'QUEUED';
  if (['FAILED', 'ERROR', 'EXCEPTION', 'BOUNCE', 'BOUNCED', 'CANCEL', 'CANCELED', 'CANCELLED'].includes(explicit)) return 'FAILED';
  if (parts.statusCode === 202) return 'QUEUED';
  if (parts.statusCode >= 200 && parts.statusCode < 300) return 'UNVERIFIED';
  return 'FAILED';
}

function updateLifecycleFromSuccess(lifecycle: IDataObject, id: string, parts: ResponseParts, step: IDataObject, mapped: IDataObject): void {
  if (/customer/.test(id)) {
    lifecycle.customerStatus = toStringValue(mapped.customerStatus ?? mapped.customer_status ?? step.successStatus, id.includes('create') ? 'CREATED' : 'FOUND').toUpperCase();
    lifecycle.customer_status = lifecycle.customerStatus;
  }
  if (/invoice\.create|createInvoice|invoice-create/.test(id)) {
    lifecycle.invoiceStatus = toStringValue(mapped.invoiceStatus ?? mapped.invoice_status, 'CREATED').toUpperCase();
    lifecycle.invoice_status = lifecycle.invoiceStatus;
  }
  if (/invoice\.(post|finalize)|postInvoice|finalizeInvoice/.test(id)) {
    const status = normalizeLifecycleStatus(mapped.postStatus ?? mapped.post_status);
    lifecycle.postStatus = ['FAILED', 'ERROR'].includes(status) ? 'FAILED' : 'POSTED';
    lifecycle.post_status = lifecycle.postStatus;
  }
  if (/send|email/.test(id)) {
    const status = normalizedEmailStatus(mapped, parts);
    lifecycle.emailSendRequested = true;
    lifecycle.email_send_requested = true;
    lifecycle.emailSendStatus = status;
    lifecycle.email_send_status = status;
    lifecycle.emailSendMethod = toStringValue(step.id ?? id);
    lifecycle.email_send_method = lifecycle.emailSendMethod;
    if (status === 'FAILED') {
      lifecycle.emailErrorMessage = toStringValue(mapped.errorMessage ?? mapped.error_message, `Provider recipe email step ${id} failed.`);
      lifecycle.email_error_message = lifecycle.emailErrorMessage;
    }
  }
}

function lifecycleResume(request: IDataObject): IDataObject {
  const resume = isRecord(request.lifecycleResume) ? request.lifecycleResume : {};
  const requestMatches = !toStringValue(resume.requestId) || toStringValue(resume.requestId) === toStringValue(request.requestId);
  const providerMatches = !toStringValue(resume.providerId) || toStringValue(resume.providerId).toLowerCase() === toStringValue(request.providerId).toLowerCase();
  if (resume.approved !== true || toStringValue(resume.source).toLowerCase() !== 'status-manager' || !requestMatches || !providerMatches) return {};
  return resume;
}

function stepMatchesResume(step: IDataObject, index: number, stage: string): boolean {
  if (!stage) return true;
  const lifecycleId = stepLifecycleId(step, index).toLowerCase();
  const id = stepId(step, index).toLowerCase();
  const normalized = stage.toLowerCase();
  if (lifecycleId === normalized || id === normalized) return true;
  if (normalized === 'invoice.send_email') return /send|email/.test(`${lifecycleId} ${id}`);
  if (normalized === 'invoice.post') return /post|finalize/.test(`${lifecycleId} ${id}`);
  if (normalized === 'invoice.create') return /invoice.*create|create.*invoice/.test(`${lifecycleId} ${id}`);
  return false;
}

function lifecycleCheckpoint(input: {
  request: IDataObject;
  recipe: IDataObject;
  facts: IDataObject;
  lifecycle: IDataObject;
  completedSteps: string[];
  failedStep: string;
  nextStage: string;
  stepResults: IDataObject;
}): IDataObject {
  return {
    schemaVersion: '1.0', providerId: toStringValue(input.recipe.providerId ?? input.request.providerId),
    recipeId: toStringValue(input.recipe.recipeId), providerCustomerId: toStringValue(input.facts.providerCustomerId ?? input.facts.customerId),
    providerInvoiceId: toStringValue(input.facts.providerInvoiceId ?? input.facts.invoiceId ?? input.facts.id),
    invoiceNumber: toStringValue(input.facts.invoiceNumber), customerStatus: input.lifecycle.customerStatus,
    invoiceStatus: input.lifecycle.invoiceStatus, postStatus: input.lifecycle.postStatus,
    emailSendRequested: input.lifecycle.emailSendRequested, emailSendStatus: input.lifecycle.emailSendStatus,
    completedStages: input.completedSteps, failedStep: input.failedStep, nextStage: input.nextStage,
    retrySafe: Boolean(input.nextStage && toStringValue(input.facts.providerInvoiceId ?? input.facts.invoiceId ?? input.facts.id)),
    facts: input.facts, stepResults: input.stepResults, updatedAt: new Date().toISOString(),
  };
}

export function declarativeRecipePlan(request: IDataObject): IDataObject {
  const recipe = declarativeRecipe(request);
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const resume = lifecycleResume(request);
  const resumeStage = toStringValue(resume.stage ?? (isRecord(resume.checkpoint) ? resume.checkpoint.nextStage : ''));
  let resumeReached = !resumeStage;
  const planned = steps.map((entry, index) => {
    const step = isRecord(entry) ? entry : { id: toStringValue(entry) };
    if (!resumeReached && stepMatchesResume(step, index, resumeStage)) resumeReached = true;
    return {
      id: stepId(step, index), executable: isRecord(step.request) || Boolean(step.url),
      willRun: shouldRunStep(step, request) && resumeReached, method: toStringValue(isRecord(step.request) ? step.request.method : step.method, ''),
    };
  });
  return {
    schemaVersion: '2.0', runtime: 'declarative_provider_recipe', recipeId: toStringValue(recipe.recipeId),
    providerId: toStringValue(recipe.providerId ?? request.providerId), lifecycleMode: lifecycleMode(request),
    resumeStage, steps: planned, executable: planned.length > 0 && planned.every((step) => step.executable === true || step.willRun === false),
  };
}

export async function executeDeclarativeProviderRecipe(context: IExecuteFunctions, input: {
  request: IDataObject;
  options: IHttpRequestOptions;
  secret: DeclarativeRuntimeSecret;
  secrets: string[];
}): Promise<{ statusCode: number; headers: IDataObject; body: JsonValue }> {
  const recipe = declarativeRecipe(input.request);
  const rawSteps = Array.isArray(recipe.steps) ? recipe.steps : [];
  if (rawSteps.length === 0) throw new Error(`Provider recipe ${toStringValue(recipe.recipeId, 'unknown')} has no declarative runtime steps.`);

  const resume = lifecycleResume(input.request);
  const resumeCheckpoint = isRecord(resume.checkpoint) ? resume.checkpoint : {};
  const resumeStage = toStringValue(resume.stage ?? resumeCheckpoint.nextStage);
  const resumeFacts = isRecord(resume.facts) ? resume.facts : isRecord(resumeCheckpoint.facts) ? resumeCheckpoint.facts : {};
  const stepResults: IDataObject = {};
  const requestedSteps = lifecycleStepSet(input.request);
  const lifecycle: IDataObject = {
    customerStatus: '', customer_status: '', invoiceStatus: '', invoice_status: '',
    postStatus: requestedSteps.has('invoice.post') ? 'PENDING' : 'NOT_REQUESTED',
    post_status: requestedSteps.has('invoice.post') ? 'PENDING' : 'NOT_REQUESTED',
    emailSendRequested: requestedSteps.has('invoice.send_email'), email_send_requested: requestedSteps.has('invoice.send_email'),
    emailSendStatus: requestedSteps.has('invoice.send_email') ? 'PENDING' : 'NOT_REQUESTED',
    email_send_status: requestedSteps.has('invoice.send_email') ? 'PENDING' : 'NOT_REQUESTED',
    emailSendMethod: '', email_send_method: '', emailErrorMessage: '', email_error_message: '',
    outcome: 'PROCESSING', lifecycleOutcome: 'PROCESSING', failedStep: '', failed_step: '',
  };
  const facts: IDataObject = { ...resumeFacts };
  const baseContext: IDataObject = {
    request: input.request, invoice: isRecord(input.request.invoice) ? input.request.invoice : {},
    recipient: isRecord(input.request.recipient) ? input.request.recipient : {}, body: isRecord(input.request.body) ? input.request.body : {},
    provider: { id: input.request.providerId, accountId: input.request.accountId, profileId: input.request.profileId },
    lifecycle: { mode: lifecycleMode(input.request), steps: [...requestedSteps] }, secrets: secretVariables(input.secret),
    steps: stepResults, facts,
  };

  let finalStatusCode = 200;
  let finalHeaders: IDataObject = {};
  let failedStep = '';
  let failureMessage = '';
  let resumeReached = !resumeStage;
  const completedSteps: string[] = [];
  for (let index = 0; index < rawSteps.length; index += 1) {
    const raw = rawSteps[index];
    if (!isRecord(raw)) throw new Error(`Provider recipe step ${index + 1} must be an object with request details.`);
    const id = stepId(raw, index);
    const lifecycleId = stepLifecycleId(raw, index);
    if (!resumeReached && stepMatchesResume(raw, index, resumeStage)) resumeReached = true;
    if (!resumeReached) {
      stepResults[id] = { skipped: true, reason: `Lifecycle resume starts at ${resumeStage}.` };
      continue;
    }
    if (!shouldRunStep(raw, input.request)) {
      stepResults[id] = { skipped: true, reason: 'Lifecycle conditions did not match.' };
      continue;
    }
    if (!isRecord(raw.request) && !raw.url) throw new Error(`Provider recipe step ${id} is not executable. Add request.method, request.url, and request body/header mappings.`);
    const rendered = requestForStep(input.options, raw, baseContext);
    const startedAt = Date.now();
    let parts: ResponseParts;
    let transportError = '';
    try {
      parts = responseParts(await context.helpers.httpRequest(rendered));
    } catch (error) {
      transportError = error instanceof Error ? error.message : String(error);
      parts = { statusCode: 503, headers: {}, body: { error: { message: transportError }, syntheticStatus: true } };
    }
    finalStatusCode = parts.statusCode;
    finalHeaders = parts.headers;
    const successStatusCodes = Array.isArray(raw.successStatusCodes) ? raw.successStatusCodes.map((entry) => toFiniteNumber(entry, 0)) : [200, 201, 202, 204];
    const success = !transportError && (successStatusCodes.includes(parts.statusCode) || (successStatusCodes.length === 0 && parts.statusCode >= 200 && parts.statusCode < 300));
    const mapped: IDataObject = { statusCode: parts.statusCode, success, latencyMs: Date.now() - startedAt, body: parts.body };
    applyResponseMap(mapped, raw.responseMap ?? raw.resultMap, parts.body);
    stepResults[id] = mapped;
    applyResponseMap(facts, raw.facts ?? raw.responseMap ?? raw.resultMap, parts.body);
    if (success) {
      updateLifecycleFromSuccess(lifecycle, id, parts, raw, mapped);
      completedSteps.push(lifecycleId);
      continue;
    }
    failedStep = lifecycleId;
    failureMessage = transportError || toStringValue(mapped.errorMessage ?? mapped.error_message ?? getByPath(parts.body, 'error.message'), `Provider recipe step ${id} failed with HTTP ${parts.statusCode}.`);
    lifecycle.failedStep = failedStep;
    lifecycle.failed_step = failedStep;
    if (/post|finalize/.test(id)) {
      lifecycle.postStatus = 'FAILED';
      lifecycle.post_status = 'FAILED';
    }
    if (/send|email/.test(id)) {
      lifecycle.emailSendStatus = 'FAILED';
      lifecycle.email_send_status = 'FAILED';
      lifecycle.emailSendMethod = id;
      lifecycle.email_send_method = id;
      lifecycle.emailErrorMessage = failureMessage;
      lifecycle.email_error_message = failureMessage;
    }
    if (raw.required !== false) break;
  }

  if (!lifecycle.customerStatus) {
    lifecycle.customerStatus = requestedSteps.has('customer.create_if_missing') ? 'UNKNOWN' : 'NOT_REQUESTED';
    lifecycle.customer_status = lifecycle.customerStatus;
  }
  if (!lifecycle.invoiceStatus) {
    lifecycle.invoiceStatus = facts.providerInvoiceId || facts.invoiceId || facts.id ? 'CREATED' : failedStep ? 'FAILED' : 'UNKNOWN';
    lifecycle.invoice_status = lifecycle.invoiceStatus;
  }
  if (lifecycle.postStatus === 'PENDING') {
    lifecycle.postStatus = completedSteps.some((step) => /post|finalize/.test(step)) ? 'POSTED' : failedStep ? 'FAILED' : 'UNVERIFIED';
    lifecycle.post_status = lifecycle.postStatus;
  }
  if (lifecycle.emailSendStatus === 'PENDING') {
    lifecycle.emailSendStatus = completedSteps.some((step) => /send|email/.test(step)) ? 'UNVERIFIED' : failedStep ? 'FAILED' : 'UNVERIFIED';
    lifecycle.email_send_status = lifecycle.emailSendStatus;
  }
  const nextStage = failedStep && ['invoice.post', 'invoice.send_email'].includes(failedStep) ? failedStep : '';
  const checkpoint = lifecycleCheckpoint({ request: input.request, recipe, facts, lifecycle, completedSteps, failedStep, nextStage, stepResults });
  const emailStatus = toStringValue(lifecycle.emailSendStatus).toUpperCase();
  const outcome = failedStep ? 'FAILED'
    : lifecycle.emailSendRequested === true && emailStatus === 'SENT' ? 'COMPLETED'
      : lifecycle.emailSendRequested === true && emailStatus === 'QUEUED' ? 'PROCESSING'
        : lifecycle.emailSendRequested === true && emailStatus === 'UNVERIFIED' ? 'PARTIAL'
          : 'COMPLETED';
  lifecycle.outcome = outcome;
  lifecycle.lifecycleOutcome = outcome;
  lifecycle.checkpoint = checkpoint;
  lifecycle.lifecycleCheckpoint = checkpoint;
  if (failureMessage && !lifecycle.emailErrorMessage) {
    lifecycle.errorMessage = failureMessage;
    lifecycle.error_message = failureMessage;
  }

  const providerInvoiceId = toStringValue(facts.providerInvoiceId ?? facts.invoiceId ?? facts.id);
  const providerCustomerId = toStringValue(facts.providerCustomerId ?? facts.customerId ?? facts.customer_id);
  const state = outcome === 'FAILED' ? 'failed'
    : emailStatus === 'SENT' ? 'sent' : emailStatus === 'QUEUED' ? 'email_queued'
      : emailStatus === 'UNVERIFIED' ? 'email_unverified'
        : lifecycle.postStatus === 'POSTED' ? 'posted' : lifecycle.invoiceStatus === 'CREATED' ? 'created' : 'unknown';
  return {
    statusCode: finalStatusCode,
    headers: { 'content-type': 'application/json', ...finalHeaders },
    body: {
      result: {
        id: providerInvoiceId, customer_id: providerCustomerId, state, lifecycle, lifecycleCheckpoint: checkpoint,
        recipeRuntime: {
          schemaVersion: '2.0', strategy: 'declarative_provider_recipe', recipeId: toStringValue(recipe.recipeId),
          providerId: toStringValue(recipe.providerId ?? input.request.providerId), executedSteps: Object.keys(stepResults),
          resumeStage,
        },
        facts, steps: stepResults,
      },
    },
  };
}
