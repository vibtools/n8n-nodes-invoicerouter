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
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return value;
  }
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
    API_KEY: secret.apiKey,
    ACCESS_TOKEN: secret.apiKey,
    API_SECRET: secret.apiSecret,
    USERNAME: toStringValue(secret.username || secret.apiKey),
    PASSWORD: toStringValue(secret.password || secret.apiSecret),
    DATABASE: toStringValue(secret.database),
    DB: toStringValue(secret.database),
    EXTRA_VALUE: secret.extraValue,
    TENANT_ID: secret.extraValue,
    ORGANIZATION_ID: secret.extraValue,
    REALM_ID: secret.extraValue,
    ACCOUNT_ID: secret.extraValue,
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
    method,
    url,
    headers,
    qs,
    body,
    json: encoding !== 'raw',
    timeout,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
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

function updateLifecycleFromStep(lifecycle: IDataObject, id: string, parts: ResponseParts, step: IDataObject): void {
  if (/customer/.test(id)) {
    lifecycle.customerStatus = toStringValue(step.successStatus, id.includes('create') ? 'CREATED' : 'FOUND');
    lifecycle.customer_status = lifecycle.customerStatus;
  }
  if (/invoice\.create|createInvoice|invoice-create/.test(id)) {
    lifecycle.invoiceStatus = 'CREATED';
    lifecycle.invoice_status = 'CREATED';
  }
  if (/invoice\.(post|finalize)|postInvoice|finalizeInvoice/.test(id)) {
    lifecycle.postStatus = 'POSTED';
    lifecycle.post_status = 'POSTED';
  }
  if (/send|email/.test(id)) {
    lifecycle.emailSendRequested = true;
    lifecycle.email_send_requested = true;
    lifecycle.emailSendStatus = parts.statusCode >= 200 && parts.statusCode < 300 ? 'SENT' : 'FAILED';
    lifecycle.email_send_status = lifecycle.emailSendStatus;
    lifecycle.emailSendMethod = toStringValue(step.id ?? id);
    lifecycle.email_send_method = lifecycle.emailSendMethod;
  }
}

export function declarativeRecipePlan(request: IDataObject): IDataObject {
  const recipe = declarativeRecipe(request);
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const planned = steps.map((entry, index) => {
    const step = isRecord(entry) ? entry : { id: toStringValue(entry) };
    return {
      id: stepId(step, index),
      executable: isRecord(step.request) || Boolean(step.url),
      willRun: shouldRunStep(step, request),
      method: toStringValue(isRecord(step.request) ? step.request.method : step.method, ''),
    };
  });
  return {
    schemaVersion: '2.0',
    runtime: 'declarative_provider_recipe',
    recipeId: toStringValue(recipe.recipeId),
    providerId: toStringValue(recipe.providerId ?? request.providerId),
    lifecycleMode: lifecycleMode(request),
    steps: planned,
    executable: planned.length > 0 && planned.every((step) => step.executable === true || step.willRun === false),
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

  const stepResults: IDataObject = {};
  const lifecycle: IDataObject = {
    customerStatus: '', customer_status: '', invoiceStatus: '', invoice_status: '',
    postStatus: lifecycleStepSet(input.request).has('invoice.post') ? 'PENDING' : 'NOT_REQUESTED', post_status: lifecycleStepSet(input.request).has('invoice.post') ? 'PENDING' : 'NOT_REQUESTED',
    emailSendRequested: lifecycleStepSet(input.request).has('invoice.send_email'), email_send_requested: lifecycleStepSet(input.request).has('invoice.send_email'),
    emailSendStatus: lifecycleStepSet(input.request).has('invoice.send_email') ? 'PENDING' : 'NOT_REQUESTED', email_send_status: lifecycleStepSet(input.request).has('invoice.send_email') ? 'PENDING' : 'NOT_REQUESTED',
    emailSendMethod: '', email_send_method: '', emailErrorMessage: '', email_error_message: '',
  };
  const facts: IDataObject = {};
  const baseContext: IDataObject = {
    request: input.request,
    invoice: isRecord(input.request.invoice) ? input.request.invoice : {},
    recipient: isRecord(input.request.recipient) ? input.request.recipient : {},
    body: isRecord(input.request.body) ? input.request.body : {},
    provider: { id: input.request.providerId, accountId: input.request.accountId, profileId: input.request.profileId },
    lifecycle: { mode: lifecycleMode(input.request), steps: [...lifecycleStepSet(input.request)] },
    secrets: secretVariables(input.secret),
    steps: stepResults,
    facts,
  };

  let finalStatusCode = 200;
  let finalHeaders: IDataObject = {};
  for (let index = 0; index < rawSteps.length; index += 1) {
    const raw = rawSteps[index];
    if (!isRecord(raw)) throw new Error(`Provider recipe step ${index + 1} must be an object with request details.`);
    const id = stepId(raw, index);
    if (!shouldRunStep(raw, input.request)) {
      stepResults[id] = { skipped: true, reason: 'Lifecycle conditions did not match.' };
      continue;
    }
    if (!isRecord(raw.request) && !raw.url) throw new Error(`Provider recipe step ${id} is not executable. Add request.method, request.url, and request body/header mappings.`);
    const rendered = requestForStep(input.options, raw, baseContext);
    const startedAt = Date.now();
    const response = await context.helpers.httpRequest(rendered);
    const parts = responseParts(response);
    finalStatusCode = parts.statusCode;
    finalHeaders = parts.headers;
    const successStatusCodes = Array.isArray(raw.successStatusCodes) ? raw.successStatusCodes.map((entry) => toFiniteNumber(entry, 0)) : [200, 201, 202, 204];
    const success = successStatusCodes.includes(parts.statusCode) || (successStatusCodes.length === 0 && parts.statusCode >= 200 && parts.statusCode < 300);
    const mapped: IDataObject = { statusCode: parts.statusCode, success, latencyMs: Date.now() - startedAt, body: parts.body };
    applyResponseMap(mapped, raw.responseMap ?? raw.resultMap, parts.body);
    stepResults[id] = mapped;
    applyResponseMap(facts, raw.facts ?? raw.responseMap ?? raw.resultMap, parts.body);
    updateLifecycleFromStep(lifecycle, id, parts, raw);
    if (!success) {
      const required = raw.required !== false;
      const message = `Provider recipe step ${id} failed with HTTP ${parts.statusCode}.`;
      if (required) throw new Error(message);
      lifecycle.emailErrorMessage = message;
      lifecycle.email_error_message = message;
    }
  }

  if (!lifecycle.customerStatus) {
    lifecycle.customerStatus = lifecycleStepSet(input.request).has('customer.create_if_missing') ? 'UNKNOWN' : 'NOT_REQUESTED';
    lifecycle.customer_status = lifecycle.customerStatus;
  }
  if (!lifecycle.invoiceStatus) {
    lifecycle.invoiceStatus = facts.providerInvoiceId || facts.invoiceId ? 'CREATED' : 'UNKNOWN';
    lifecycle.invoice_status = lifecycle.invoiceStatus;
  }
  if (lifecycle.postStatus === 'PENDING') {
    lifecycle.postStatus = 'POSTED';
    lifecycle.post_status = 'POSTED';
  }
  if (lifecycle.emailSendStatus === 'PENDING') {
    lifecycle.emailSendStatus = 'SENT';
    lifecycle.email_send_status = 'SENT';
  }

  const providerInvoiceId = toStringValue(facts.providerInvoiceId ?? facts.invoiceId ?? facts.id);
  const providerCustomerId = toStringValue(facts.providerCustomerId ?? facts.customerId ?? facts.customer_id);
  return {
    statusCode: finalStatusCode,
    headers: { 'content-type': 'application/json', ...finalHeaders },
    body: {
      result: {
        id: providerInvoiceId,
        customer_id: providerCustomerId,
        state: lifecycle.emailSendStatus === 'SENT' ? 'sent' : lifecycle.postStatus === 'POSTED' ? 'posted' : lifecycle.invoiceStatus === 'CREATED' ? 'created' : 'unknown',
        lifecycle,
        recipeRuntime: {
          schemaVersion: '2.0',
          strategy: 'declarative_provider_recipe',
          recipeId: toStringValue(recipe.recipeId),
          providerId: toStringValue(recipe.providerId ?? input.request.providerId),
          executedSteps: Object.keys(stepResults),
        },
        facts,
        steps: stepResults,
      },
    },
  };
}
