import type { IDataObject, IExecuteFunctions, INodeExecutionData, IHttpRequestOptions, JsonValue } from '../../shared/types/N8n';
import { finalizeInvoiceSend, getSecretMaterial, reserveInvoiceSend } from '../../shared/runtime/RuntimeStore';
import { redactJson, redactString, secretValues } from '../../shared/security/Redaction';
import { isRecord, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';
import { declarativeRecipePlan, executeDeclarativeProviderRecipe } from '../../providers/DeclarativeRecipeRuntime';
import { odooCapabilityProfileByMajor, type OdooCapabilityProfile } from '../../shared/odoo/OdooCapabilityManifest';

function secretVariables(secret: { apiKey: string; apiSecret: string; extraValue: string; username?: string; password?: string; database?: string }): Record<string, string> {
  const variables: Record<string, string> = {
    API_KEY: secret.apiKey || toStringValue(secret.username), ACCESS_TOKEN: secret.apiKey || toStringValue(secret.username), API_SECRET: secret.apiSecret || toStringValue(secret.password),
    USERNAME: toStringValue(secret.username || secret.apiKey), PASSWORD: toStringValue(secret.password || secret.apiSecret), DATABASE: toStringValue(secret.database), DB: toStringValue(secret.database), EXTRA_VALUE: secret.extraValue || toStringValue(secret.database),
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


class OdooOperationError extends Error {
  readonly details: IDataObject;

  constructor(message: string, details: IDataObject = {}) {
    super(message);
    this.name = 'OdooOperationError';
    this.details = details;
  }
}

function odooStructuredClassification(message: string): string {
  const text = message.toLowerCase();
  if (/database .*does not exist|unknown database|database not found/.test(text)) return 'CONFIGURATION_ERROR';
  if (/authentication|invalid login|invalid password|access denied/.test(text)) return 'AUTHENTICATION_ERROR';
  if (/forbidden|not allowed|permission|access rights|authorization/.test(text)) return 'AUTHORIZATION_ERROR';
  if (/method .*does not exist|has no attribute|unknown field|invalid field|model .*does not exist|not found in registry|missing required fields/.test(text)) return 'CONFIGURATION_ERROR';
  if (/currency/.test(text)) return 'CONFIGURATION_ERROR';
  if (/validation|invalid value|required field|cannot create|cannot post/.test(text)) return 'VALIDATION_ERROR';
  return 'PROVIDER_ERROR';
}

function odooErrorDetails(error: unknown): IDataObject {
  return error instanceof OdooOperationError ? error.details : {};
}

function valueFromRecord(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

type OdooEmailStatus = 'NOT_REQUESTED' | 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED' | 'UNVERIFIED';


type LifecycleResumeStage = 'invoice.create' | 'invoice.post' | 'invoice.send_email';

function odooCapabilityForRequest(request: IDataObject): OdooCapabilityProfile {
  const compatibility = isRecord(request.odooCompatibility) ? request.odooCompatibility : {};
  const issuerCompatibility = isRecord(request.issuerCompatibility) ? request.issuerCompatibility : {};
  if (issuerCompatibility.compatible === false || toStringValue(issuerCompatibility.status).toUpperCase() === 'ISSUER_MISMATCH') {
    throw new OdooOperationError('Odoo legal-issuer compatibility is not verified for this provider account.', {
      provider: 'odoo', category: 'configuration', errorType: 'CONFIGURATION_ERROR', lifecycleStage: 'issuer.guard',
      definitiveNoSideEffect: true, ambiguousSideEffect: false,
    });
  }
  // Odoo version is diagnostic metadata, not a runtime allowlist. The sender
  // uses the common capability surface verified by Provider Loader preflight.
  const declaredMajor = toFiniteNumber(compatibility.majorVersion ?? request.odooMajorVersion, 0);
  return odooCapabilityProfileByMajor(declaredMajor);
}

function odooConfig(secret: { apiKey: string; apiSecret: string; username?: string; password?: string; database?: string; extraConfig?: IDataObject }): IDataObject {
  const extraConfig = isRecord(secret.extraConfig) ? secret.extraConfig : {};
  return {
    database: toStringValue(secret.database ?? extraConfig.database),
    username: toStringValue(secret.username ?? secret.apiKey ?? extraConfig.username),
    password: toStringValue(secret.password ?? secret.apiSecret ?? extraConfig.password),
    uid: toFiniteNumber(extraConfig.uid, 0),
    postInvoice: extraConfig.odooPostInvoice === true || toStringValue(extraConfig.odooPostInvoice).toLowerCase() === 'true' || ['createAndPost', 'createPostAndSendEmail'].includes(toStringValue(extraConfig.invoiceLifecycle)),
    sendInvoiceEmail: extraConfig.odooSendInvoiceEmail === true || toStringValue(extraConfig.odooSendInvoiceEmail).toLowerCase() === 'true' || toStringValue(extraConfig.invoiceLifecycle) === 'createPostAndSendEmail',
    emailForceSend: extraConfig.odooEmailForceSend !== false && toStringValue(extraConfig.odooEmailForceSend).toLowerCase() !== 'false',
  };
}

function odooPayload(id: string, service: string, method: string, args: JsonValue[]): IDataObject {
  return { jsonrpc: '2.0', method: 'call', params: { service, method, args }, id };
}

async function odooJsonRpc(
  context: IExecuteFunctions,
  url: string,
  timeout: number,
  body: IDataObject,
  secrets: string[],
  meta: IDataObject = {},
): Promise<JsonValue> {
  let response: unknown;
  try {
    response = await context.helpers.httpRequest({
      method: 'POST', url, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body,
      json: true, timeout, returnFullResponse: true, ignoreHttpStatusErrors: true,
    });
  } catch (error) {
    const message = redactString(error instanceof Error ? error.message : String(error), secrets);
    const method = toStringValue(meta.method);
    const sideEffecting = ['create', 'write', 'unlink', 'action_post', 'action_send_and_print'].includes(method);
    throw new OdooOperationError(`Odoo transport error${method ? ` during ${toStringValue(meta.model)}.${method}` : ''}: ${message}`, {
      provider: 'odoo', category: 'transport', errorType: 'NETWORK_ERROR', model: meta.model, method,
      lifecycleStage: meta.lifecycleStage, ambiguousSideEffect: sideEffecting, definitiveNoSideEffect: !sideEffecting,
    });
  }
  const parts = responseParts(response);
  if (parts.statusCode < 200 || parts.statusCode >= 300) {
    const message = `Odoo JSON-RPC HTTP ${parts.statusCode}: ${redactString(JSON.stringify(parts.body), secrets)}`;
    const method = toStringValue(meta.method);
    const sideEffecting = ['create', 'write', 'unlink', 'action_post', 'action_send_and_print'].includes(method);
    const ambiguousSideEffect = sideEffecting && (parts.statusCode === 0 || parts.statusCode >= 500);
    throw new OdooOperationError(message, {
      provider: 'odoo', category: 'http', errorType: parts.statusCode >= 500 ? 'SERVER_ERROR' : 'CONFIGURATION_ERROR',
      httpStatus: parts.statusCode, model: meta.model, method, lifecycleStage: meta.lifecycleStage,
      ambiguousSideEffect, definitiveNoSideEffect: !ambiguousSideEffect,
    });
  }
  if (isRecord(parts.body) && parts.body.error !== undefined) {
    const errorObject = isRecord(parts.body.error) ? parts.body.error : {};
    const data = isRecord(errorObject.data) ? errorObject.data : {};
    const rawMessage = toStringValue(data.message ?? errorObject.message ?? JSON.stringify(parts.body.error), 'Unknown Odoo JSON-RPC error.');
    const message = redactString(rawMessage, secrets);
    throw new OdooOperationError(`Odoo JSON-RPC error${meta.model ? ` in ${toStringValue(meta.model)}.${toStringValue(meta.method)}` : ''}: ${message}`, {
      provider: 'odoo', category: 'jsonrpc', errorType: odooStructuredClassification(message),
      rpcCode: errorObject.code, rpcName: data.name, model: meta.model, method: meta.method,
      lifecycleStage: meta.lifecycleStage, ambiguousSideEffect: false, definitiveNoSideEffect: true,
    });
  }
  return isRecord(parts.body) ? (parts.body.result ?? null) : null;
}

async function odooExecuteKw(context: IExecuteFunctions, input: {
  url: string;
  timeout: number;
  database: string;
  uid: number;
  password: string;
  model: string;
  method: string;
  args: JsonValue[];
  kwargs?: IDataObject;
  id: string;
  secrets: string[];
  lifecycleStage?: string;
}): Promise<JsonValue> {
  const positionalArgs: JsonValue[] = [input.database, input.uid, input.password, input.model, input.method, input.args];
  if (input.kwargs && Object.keys(input.kwargs).length > 0) positionalArgs.push(input.kwargs);
  return odooJsonRpc(
    context,
    input.url,
    input.timeout,
    odooPayload(input.id, 'object', 'execute_kw', positionalArgs),
    input.secrets,
    { model: input.model, method: input.method, lifecycleStage: input.lifecycleStage ?? input.id },
  );
}

async function tryOdooExecuteKw(
  context: IExecuteFunctions,
  input: {
    url: string;
    timeout: number;
    database: string;
    uid: number;
    password: string;
    model: string;
    method: string;
    args: JsonValue[];
    kwargs?: IDataObject;
    id: string;
    secrets: string[];
    lifecycleStage?: string;
  },
): Promise<{ success: boolean; result: JsonValue; errorMessage: string; errorDetails: IDataObject }> {
  try {
    return { success: true, result: await odooExecuteKw(context, input), errorMessage: '', errorDetails: {} };
  } catch (error) {
    return {
      success: false,
      result: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorDetails: odooErrorDetails(error),
    };
  }
}

function odooRecords(value: unknown): IDataObject[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function odooRelationId(value: unknown): number {
  if (Array.isArray(value)) return toFiniteNumber(value[0], 0);
  return toFiniteNumber(value, 0);
}

function odooNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toFiniteNumber(entry, 0)).filter((entry) => entry > 0);
}

function odooStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toStringValue(entry).trim()).filter(Boolean);
}

function normalizeEmailAddress(value: unknown): string {
  return toStringValue(value).trim().toLowerCase();
}

function extractEmailAddresses(value: unknown): string[] {
  const text = toStringValue(value);
  const matches = text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi) ?? [];
  return [...new Set(matches.map((entry) => normalizeEmailAddress(entry)).filter(Boolean))];
}

function matchingOdooPartners(records: IDataObject[], recipientEmail: string): IDataObject[] {
  const normalizedRecipient = normalizeEmailAddress(extractEmailAddresses(recipientEmail)[0] ?? recipientEmail);
  return records.filter((record) => extractEmailAddresses(record.email).includes(normalizedRecipient));
}

function assertUniqueOdooPartner(records: IDataObject[], recipientEmail: string, details: IDataObject): IDataObject | undefined {
  const matches = matchingOdooPartners(records, recipientEmail);
  if (records.length > 1 || matches.length > 1) {
    throw new OdooOperationError(`Odoo partner lookup found multiple contacts for recipient email ${recipientEmail}. Automatic customer selection was blocked.`, {
      provider: 'odoo', category: 'reconciliation', errorType: 'AMBIGUOUS_PROVIDER_RESULT',
      model: 'res.partner', method: 'search_read', lifecycleStage: 'customer.lookup',
      definitiveNoSideEffect: details.definitiveNoSideEffect ?? true,
      ambiguousSideEffect: details.ambiguousSideEffect ?? false,
      reconciliation: 'multiple_partner_email_matches', matchCount: Math.max(records.length, matches.length),
    });
  }
  if (matches.length === 1) return matches[0];
  if (records.length === 1) {
    throw new OdooOperationError(`Odoo partner lookup returned a contact whose email did not exactly match ${recipientEmail}. Automatic customer selection was blocked.`, {
      provider: 'odoo', category: 'reconciliation', errorType: 'AMBIGUOUS_PROVIDER_RESULT',
      model: 'res.partner', method: 'search_read', lifecycleStage: 'customer.lookup',
      definitiveNoSideEffect: details.definitiveNoSideEffect ?? true,
      ambiguousSideEffect: details.ambiguousSideEffect ?? false,
      reconciliation: 'partner_email_exact_match_failed', matchCount: 1,
    });
  }
  return undefined;
}

function odooEmailFailureText(records: IDataObject[]): string {
  const messages = records.flatMap((record) => [toStringValue(record.failure_reason), toStringValue(record.failure_type)]).filter(Boolean);
  return [...new Set(messages)].join('; ');
}

function odooEmailEvidence(input: {
  wizardCompleted: boolean;
  wizardError: string;
  wizardErrorDetails: IDataObject;
  messages: IDataObject[];
  notifications: IDataObject[];
  mails: IDataObject[];
  verificationErrors: string[];
}): { status: OdooEmailStatus; errorMessage: string; evidence: IDataObject } {
  const notificationStatuses = input.notifications.map((record) => toStringValue(record.notification_status).trim().toLowerCase()).filter(Boolean);
  const mailStates = input.mails.map((record) => toStringValue(record.state).trim().toLowerCase()).filter(Boolean);
  const failureStatuses = new Set(['bounce', 'exception', 'canceled', 'cancel']);
  const failed = notificationStatuses.some((status) => failureStatuses.has(status)) || mailStates.some((status) => failureStatuses.has(status));
  const sent = notificationStatuses.includes('sent') || mailStates.includes('sent');
  const queued = notificationStatuses.some((status) => ['ready', 'process', 'pending'].includes(status)) || mailStates.includes('outgoing');
  const failureText = odooEmailFailureText([...input.notifications, ...input.mails]);
  const verificationText = input.verificationErrors.filter(Boolean).join('; ');
  const ambiguousWizardTransport = input.wizardErrorDetails.ambiguousSideEffect === true &&
    toStringValue(input.wizardErrorDetails.method) === 'action_send_and_print';
  const evidence: IDataObject = {
    schemaVersion: '1.0',
    wizardCompleted: input.wizardCompleted,
    wizardError: input.wizardError,
    wizardErrorDetails: input.wizardErrorDetails,
    ambiguousWizardTransport,
    messageIds: input.messages.map((record) => toFiniteNumber(record.id, 0)).filter((id) => id > 0),
    notificationIds: input.notifications.map((record) => toFiniteNumber(record.id, 0)).filter((id) => id > 0),
    notificationStatuses,
    notificationFailureTypes: input.notifications.map((record) => toStringValue(record.failure_type)).filter(Boolean),
    mailIds: input.mails.map((record) => toFiniteNumber(record.id, 0)).filter((id) => id > 0),
    mailStates,
    mailFailureTypes: input.mails.map((record) => toStringValue(record.failure_type)).filter(Boolean),
    verificationErrors: input.verificationErrors,
  };
  if (sent) return { status: 'SENT', errorMessage: '', evidence };
  if (queued) return { status: 'QUEUED', errorMessage: '', evidence };
  if (failed) return { status: 'FAILED', errorMessage: failureText || 'Odoo reported an email notification or outgoing-mail failure.', evidence };
  if (!input.wizardCompleted) {
    if (ambiguousWizardTransport) {
      return {
        status: 'UNVERIFIED',
        errorMessage: [input.wizardError, 'No attempt-bound terminal Odoo mail evidence was found after the ambiguous send operation.', verificationText].filter(Boolean).join('; '),
        evidence,
      };
    }
    return { status: 'FAILED', errorMessage: input.wizardError || 'Odoo invoice send wizard did not complete.', evidence };
  }
  return {
    status: 'UNVERIFIED',
    errorMessage: verificationText || 'Odoo send wizard completed, but no readable mail.notification or mail.mail terminal evidence was found.',
    evidence,
  };
}

function normalizeResumeStage(value: unknown): LifecycleResumeStage | '' {
  const text = toStringValue(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['create', 'invoice_create', 'invoice.create'].includes(text)) return 'invoice.create';
  if (['post', 'finalize', 'invoice_post', 'invoice.post'].includes(text)) return 'invoice.post';
  if (['email', 'send_email', 'invoice_send_email', 'invoice.send_email'].includes(text)) return 'invoice.send_email';
  return '';
}

function approvedLifecycleResume(request: IDataObject): IDataObject {
  const resume = isRecord(request.lifecycleResume) ? request.lifecycleResume : {};
  const checkpoint = isRecord(resume.checkpoint) ? resume.checkpoint : {};
  const stage = normalizeResumeStage(resume.stage ?? resume.resumeStage ?? checkpoint.nextStage);
  const requestMatches = !toStringValue(resume.requestId) || toStringValue(resume.requestId) === toStringValue(request.requestId);
  const providerMatches = !toStringValue(resume.providerId) || toStringValue(resume.providerId).toLowerCase() === toStringValue(request.providerId).toLowerCase();
  const approved = resume.approved === true && toStringValue(resume.source).toLowerCase() === 'status-manager' && requestMatches && providerMatches && Boolean(stage);
  if (!approved) return {};
  return { ...resume, stage, checkpoint };
}

function responseLifecycle(value: unknown): IDataObject {
  if (!isRecord(value)) return {};
  const result = isRecord(value.result) ? value.result : {};
  return isRecord(result.lifecycle) ? result.lifecycle : {};
}

function responseProviderInvoiceId(value: unknown): string {
  if (!isRecord(value)) return '';
  const result = isRecord(value.result) ? value.result : {};
  return toStringValue(result.id ?? result.providerInvoiceId ?? value.id);
}

function buildOdooCheckpoint(input: {
  partnerId: number;
  partnerCreated: boolean;
  invoiceId: number;
  invoiceNumber: string;
  invoiceReused: boolean;
  posted: boolean;
  emailRequested: boolean;
  emailStatus: OdooEmailStatus;
  failedStep: string;
  errorMessage: string;
  emailEvidence: IDataObject;
}): IDataObject {
  const completedStages = ['customer.resolve'];
  if (input.partnerCreated) completedStages.push('customer.create_if_missing');
  if (input.invoiceId > 0) completedStages.push('invoice.create');
  if (input.posted) completedStages.push('invoice.post');
  if (input.emailStatus === 'SENT') completedStages.push('invoice.send_email');
  const nextStage = input.failedStep === 'invoice.post' || input.failedStep === 'invoice.send_email' ? input.failedStep : '';
  return {
    schemaVersion: '1.0', providerId: 'odoo', providerCustomerId: input.partnerId > 0 ? String(input.partnerId) : '',
    providerInvoiceId: input.invoiceId > 0 ? String(input.invoiceId) : '', invoiceNumber: input.invoiceNumber,
    customerStatus: input.partnerCreated ? 'CREATED' : 'FOUND', invoiceStatus: input.invoiceId > 0 ? 'CREATED' : 'FAILED',
    postStatus: input.posted ? 'POSTED' : input.failedStep === 'invoice.post' ? 'FAILED' : 'DRAFT',
    emailSendRequested: input.emailRequested, emailSendStatus: input.emailRequested ? input.emailStatus : 'NOT_REQUESTED',
    completedStages, failedStep: input.failedStep, nextStage, retrySafe: Boolean(nextStage), invoiceReused: input.invoiceReused,
    errorMessage: input.errorMessage, emailEvidence: input.emailEvidence,
    facts: {
      providerCustomerId: input.partnerId > 0 ? String(input.partnerId) : '',
      providerInvoiceId: input.invoiceId > 0 ? String(input.invoiceId) : '',
      invoiceNumber: input.invoiceNumber,
    },
    updatedAt: new Date().toISOString(),
  };
}

function lifecycleResult(input: {
  partnerCreated: boolean;
  posted: boolean;
  emailRequested: boolean;
  emailStatus: OdooEmailStatus;
  emailMethod: string;
  emailError: string;
  emailEvidence: IDataObject;
  outcome: string;
  failedStep: string;
  checkpoint: IDataObject;
}): IDataObject {
  return {
    customer_status: input.partnerCreated ? 'CREATED' : 'FOUND',
    customerStatus: input.partnerCreated ? 'CREATED' : 'FOUND',
    invoice_status: 'CREATED',
    invoiceStatus: 'CREATED',
    post_status: input.posted ? 'POSTED' : input.failedStep === 'invoice.post' ? 'FAILED' : 'DRAFT',
    postStatus: input.posted ? 'POSTED' : input.failedStep === 'invoice.post' ? 'FAILED' : 'DRAFT',
    email_send_requested: input.emailRequested,
    emailSendRequested: input.emailRequested,
    email_send_status: input.emailRequested ? input.emailStatus : 'NOT_REQUESTED',
    emailSendStatus: input.emailRequested ? input.emailStatus : 'NOT_REQUESTED',
    email_send_method: input.emailMethod,
    emailSendMethod: input.emailMethod,
    email_error_message: input.emailError,
    emailErrorMessage: input.emailError,
    email_evidence: input.emailEvidence,
    emailEvidence: input.emailEvidence,
    outcome: input.outcome,
    lifecycleOutcome: input.outcome,
    failed_step: input.failedStep,
    failedStep: input.failedStep,
    checkpoint: input.checkpoint,
    lifecycleCheckpoint: input.checkpoint,
  };
}

async function executeOdooInvoiceEmail(context: IExecuteFunctions, input: {
  capabilityProfile: OdooCapabilityProfile;
  url: string;
  timeout: number;
  database: string;
  uid: number;
  password: string;
  invoiceId: number;
  partnerId: number;
  recipientEmail: string;
  transactionId: string;
  emailForceSend: boolean;
  secrets: string[];
}): Promise<{ status: OdooEmailStatus; method: string; errorMessage: string; evidence: IDataObject; wizardId: number }> {
  const sendContext: IDataObject = {
    active_model: 'account.move', active_id: input.invoiceId, active_ids: [input.invoiceId], default_move_id: input.invoiceId,
    mail_notify_force_send: input.emailForceSend,
  };
  const beforeMessages = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'mail.message', method: 'search', args: [[['model', '=', 'account.move'], ['res_id', '=', input.invoiceId]] as unknown as JsonValue],
    kwargs: { order: 'id desc', limit: 100 }, id: `${input.transactionId}-mail-message-before`, secrets: input.secrets,
  });
  const baselineReadable = beforeMessages.success;
  const beforeMessageIds = baselineReadable ? odooNumberList(beforeMessages.result) : [];
  const verificationErrors: string[] = baselineReadable ? [] : [beforeMessages.errorMessage || 'Odoo mail.message baseline could not be read.'];
  const wizardCreate = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'account.move.send.wizard', method: input.capabilityProfile.senderMethods.wizardCreate, args: [{
      move_id: input.invoiceId,
      sending_method_checkboxes: { email: { checked: true, label: 'Email' } },
      mail_partner_ids: [[6, 0, [input.partnerId]]],
    }],
    kwargs: { context: sendContext }, id: `${input.transactionId}-invoice-send-wizard-create`, secrets: input.secrets,
  });
  const wizardId = wizardCreate.success ? toFiniteNumber(wizardCreate.result, 0) : 0;
  let wizardCompleted = false;
  let wizardError = wizardCreate.errorMessage;
  let wizardErrorDetails = wizardCreate.errorDetails;
  if (wizardId > 0) {
    const wizardRead = await tryOdooExecuteKw(context, {
      url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
      model: 'account.move.send.wizard', method: input.capabilityProfile.senderMethods.wizardRead,
      args: [[wizardId] as unknown as JsonValue, input.capabilityProfile.senderFields.wizardRead],
      kwargs: { context: sendContext }, id: `${input.transactionId}-invoice-send-wizard-read`, secrets: input.secrets,
    });
    const wizard = odooRecords(wizardRead.result)[0];
    const sendingMethods = odooStringList(wizard?.sending_methods);
    const mailPartnerIds = odooNumberList(wizard?.mail_partner_ids);
    if (!wizardRead.success) {
      wizardError = wizardRead.errorMessage;
      wizardErrorDetails = wizardRead.errorDetails;
    }
    else if (!sendingMethods.includes('email')) wizardError = 'Odoo invoice send wizard did not select the email sending method.';
    else if (mailPartnerIds.length === 0) wizardError = 'Odoo invoice send wizard did not resolve an email recipient.';
    else {
      const wizardSend = await tryOdooExecuteKw(context, {
        url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
        model: 'account.move.send.wizard', method: input.capabilityProfile.senderMethods.wizardSend, args: [[wizardId] as unknown as JsonValue],
        kwargs: { context: sendContext }, id: `${input.transactionId}-invoice-send-wizard-execute`, secrets: input.secrets,
      });
      wizardCompleted = wizardSend.success;
      wizardError = wizardSend.errorMessage;
      wizardErrorDetails = wizardSend.errorDetails;
    }
  }
  const afterMessages = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'mail.message', method: input.capabilityProfile.senderMethods.messageSearch, args: [[['model', '=', 'account.move'], ['res_id', '=', input.invoiceId]] as unknown as JsonValue],
    kwargs: { fields: input.capabilityProfile.senderFields.messageRead, order: 'id desc', limit: 100 },
    id: `${input.transactionId}-mail-message-after`, secrets: input.secrets,
  });
  if (!afterMessages.success) verificationErrors.push(afterMessages.errorMessage);
  const allNewMessages = baselineReadable && afterMessages.success ? odooRecords(afterMessages.result).filter((record) => {
    const id = toFiniteNumber(record.id, 0);
    return id > 0 && !beforeMessageIds.includes(id);
  }) : [];
  const newMessages = allNewMessages.filter((record) => odooNumberList(record.partner_ids).includes(input.partnerId));
  const newMessageIds = newMessages.map((record) => toFiniteNumber(record.id, 0)).filter((id) => id > 0);
  const attemptEvidenceBound = baselineReadable && afterMessages.success && newMessageIds.length > 0;
  if (baselineReadable && afterMessages.success && newMessageIds.length === 0) {
    verificationErrors.push('Odoo send wizard completed without a new attempt-bound mail.message addressed to the intended partner. Historical or other-recipient evidence was not accepted.');
  }
  const notificationDomain = attemptEvidenceBound
    ? [['mail_message_id', 'in', newMessageIds], ['notification_type', '=', 'email']]
    : [['id', '=', 0]];
  const mailDomain = attemptEvidenceBound
    ? [['mail_message_id', 'in', newMessageIds]]
    : [['id', '=', 0]];
  const notifications = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'mail.notification', method: input.capabilityProfile.senderMethods.notificationSearch, args: [notificationDomain as unknown as JsonValue],
    kwargs: { fields: input.capabilityProfile.senderFields.notificationRead, order: 'id desc', limit: 100 },
    id: `${input.transactionId}-mail-notification-after`, secrets: input.secrets,
  });
  if (!notifications.success) verificationErrors.push(notifications.errorMessage);
  const mails = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'mail.mail', method: input.capabilityProfile.senderMethods.mailSearch, args: [mailDomain as unknown as JsonValue],
    kwargs: { fields: input.capabilityProfile.senderFields.mailRead, order: 'id desc', limit: 100 },
    id: `${input.transactionId}-mail-mail-after`, secrets: input.secrets,
  });
  if (!mails.success) verificationErrors.push(mails.errorMessage);
  const intendedNotifications = attemptEvidenceBound ? odooRecords(notifications.result).filter((record) => odooRelationId(record.res_partner_id) === input.partnerId) : [];
  const normalizedRecipientEmail = normalizeEmailAddress(extractEmailAddresses(input.recipientEmail)[0] ?? input.recipientEmail);
  const intendedMails = attemptEvidenceBound ? odooRecords(mails.result).filter((record) => {
    const partnerMatch = odooNumberList(record.recipient_ids).includes(input.partnerId);
    const emailMatch = normalizedRecipientEmail && extractEmailAddresses(record.email_to).includes(normalizedRecipientEmail);
    return partnerMatch || Boolean(emailMatch);
  }) : [];
  if (attemptEvidenceBound && intendedNotifications.length === 0 && intendedMails.length === 0) {
    verificationErrors.push('Attempt-bound Odoo email evidence did not match the intended partner or recipient email.');
  }
  const recipientEvidenceBound = attemptEvidenceBound && (intendedNotifications.length > 0 || intendedMails.length > 0);
  const evaluated = odooEmailEvidence({
    wizardCompleted, wizardError, wizardErrorDetails, messages: newMessages,
    notifications: recipientEvidenceBound ? intendedNotifications : [],
    mails: recipientEvidenceBound ? intendedMails : [],
    verificationErrors,
  });
  return {
    status: evaluated.status,
    method: 'account.move.send.wizard.action_send_and_print',
    errorMessage: evaluated.errorMessage,
    evidence: {
      ...evaluated.evidence,
      wizardId,
      recipientPartnerIds: [input.partnerId],
      baselineReadable,
      afterMessageReadSucceeded: afterMessages.success,
      beforeMessageCount: beforeMessageIds.length,
      newMessageCount: newMessageIds.length,
      attemptAttachmentIds: [...new Set(newMessages.flatMap((record) => odooNumberList(record.attachment_ids)))],
      rejectedOtherRecipientMessageCount: Math.max(0, allNewMessages.length - newMessages.length),
      intendedNotificationCount: intendedNotifications.length,
      intendedMailCount: intendedMails.length,
      attemptEvidenceBound,
      recipientEvidenceBound,
    },
    wizardId,
  };
}

async function validateOdooPdfEvidence(context: IExecuteFunctions, input: {
  capabilityProfile: OdooCapabilityProfile;
  url: string;
  timeout: number;
  database: string;
  uid: number;
  password: string;
  invoiceId: number;
  expectedAttachmentId: number;
  attemptAttachmentIds: number[];
  transactionId: string;
  secrets: string[];
}): Promise<IDataObject> {
  const attemptAttachmentIds = [...new Set(input.attemptAttachmentIds.filter((id) => id > 0))];
  const candidateIds = [...new Set([...attemptAttachmentIds, input.expectedAttachmentId].filter((id) => id > 0))];
  const base: IDataObject = {
    schemaVersion: '1.0', expectedAttachmentId: input.expectedAttachmentId,
    attemptAttachmentIds, candidateAttachmentIds: candidateIds,
  };
  if (attemptAttachmentIds.length === 0) {
    return { ...base, status: 'MISSING_ATTEMPT_ATTACHMENT', readSucceeded: false, expectedReportBound: false, validPdfAttachmentIds: [] };
  }
  const attachments = await tryOdooExecuteKw(context, {
    url: input.url, timeout: input.timeout, database: input.database, uid: input.uid, password: input.password,
    model: 'ir.attachment', method: input.capabilityProfile.senderMethods.attachmentRead,
    args: [candidateIds as unknown as JsonValue, input.capabilityProfile.senderFields.attachmentRead],
    id: `${input.transactionId}-invoice-pdf-attachment-read`, secrets: input.secrets,
  });
  if (!attachments.success) {
    return { ...base, status: 'UNREADABLE', readSucceeded: false, expectedReportBound: false, validPdfAttachmentIds: [], errorMessage: attachments.errorMessage, errorDetails: attachments.errorDetails };
  }
  const records = odooRecords(attachments.result);
  const summaries = records.map((record) => {
    const id = toFiniteNumber(record.id, 0);
    const mimetype = toStringValue(record.mimetype).trim().toLowerCase();
    const resModel = toStringValue(record.res_model).trim();
    const resId = toFiniteNumber(record.res_id, 0);
    const name = toStringValue(record.name).trim();
    const valid = id > 0 && mimetype === 'application/pdf' && resModel === 'account.move' && resId === input.invoiceId;
    return { id, name, mimetype, resModel, resId, valid };
  });
  const validPdfAttachmentIds = summaries.filter((record) => record.valid === true).map((record) => toFiniteNumber(record.id, 0));
  const expectedReportBound = input.expectedAttachmentId > 0 &&
    attemptAttachmentIds.includes(input.expectedAttachmentId) && validPdfAttachmentIds.includes(input.expectedAttachmentId);
  const status = expectedReportBound ? 'VALID'
    : input.expectedAttachmentId <= 0 ? 'MISSING_EXPECTED_REPORT_BINDING'
      : !attemptAttachmentIds.includes(input.expectedAttachmentId) ? 'EXPECTED_REPORT_NOT_ATTEMPT_BOUND'
        : 'INVALID_ATTACHMENT';
  return { ...base, status, readSucceeded: true, expectedReportBound, validPdfAttachmentIds, attachments: summaries };
}

async function executeOdooAutoCustomerInvoice(context: IExecuteFunctions, request: IDataObject, options: IHttpRequestOptions, secret: { apiKey: string; apiSecret: string; username?: string; password?: string; database?: string; extraConfig?: IDataObject }, secrets: string[]): Promise<{ statusCode: number; headers: IDataObject; body: JsonValue }> {
  const config = odooConfig(secret);
  const capabilityProfile = odooCapabilityForRequest(request);
  const database = toStringValue(config.database).trim();
  const username = toStringValue(config.username).trim();
  const password = toStringValue(config.password).trim();
  if (!database) throw new Error('Odoo provider Database is missing in the provider sheet.');
  if (!username) throw new Error('Odoo provider Username is missing in the provider sheet.');
  if (!password) throw new Error('Odoo provider Password/API key is missing in the provider sheet.');

  const timeout = Math.max(1, toFiniteNumber(options.timeout, 60_000));
  const url = toStringValue(options.url);
  const transactionId = toStringValue(request.transactionId);
  const recipient = isRecord(request.recipient) ? request.recipient : {};
  const invoice = isRecord(request.invoice) ? request.invoice : {};
  const body = isRecord(request.body) ? request.body : {};
  const invoiceBody = isRecord(body.invoice) ? body.invoice : {};
  const recipientName = toStringValue(recipient.name || valueFromRecord(body.customer, 'name') || recipient.email, 'Customer');
  const recipientEmail = toStringValue(recipient.email || valueFromRecord(body.customer, 'email')).trim().toLowerCase();
  const recipientAddress = toStringValue(recipient.address || valueFromRecord(body.customer, 'address'));
  if (!recipientEmail) throw new Error('Odoo auto customer flow requires recipient email.');

  const resume = approvedLifecycleResume(request);
  const resumeCheckpoint = isRecord(resume.checkpoint) ? resume.checkpoint : {};
  const resumeStage = normalizeResumeStage(resume.stage);
  let partnerId = toFiniteNumber(resume.providerCustomerId ?? resumeCheckpoint.providerCustomerId, 0);
  let numericInvoiceId = toFiniteNumber(resume.providerInvoiceId ?? resumeCheckpoint.providerInvoiceId, 0);
  let invoiceReused = numericInvoiceId > 0;
  const incomingFailoverState = isRecord(request.failoverState) ? request.failoverState : {};
  const recoveryQueueStatus = toStringValue(incomingFailoverState.queueStatus).trim().toUpperCase();
  const recoveryRun = Boolean(resumeStage || toFiniteNumber(request.retryCount, 0) > 0 || ['PENDING', 'RETRY_WAIT', 'FAILOVER_READY', 'PROVIDER_PENDING'].includes(recoveryQueueStatus));
  let recoveredExistingInvoice = false;
  let recoveredExistingWasPosted = false;
  if (resumeStage && resumeStage !== 'invoice.create' && numericInvoiceId <= 0) throw new Error(`Lifecycle resume stage ${resumeStage} requires an existing provider invoice id.`);

  let uid = toFiniteNumber(config.uid, 0);
  if (uid <= 0) {
    const authResult = await odooJsonRpc(context, url, timeout, odooPayload(`${transactionId}-auth`, 'common', 'authenticate', [database, username, password, {}]), secrets);
    uid = toFiniteNumber(authResult, 0);
  }
  if (uid <= 0) throw new Error('Odoo authentication failed or returned an empty UID.');

  let initialMove: IDataObject = {};
  if (numericInvoiceId > 0) {
    const existingMove = await odooExecuteKw(context, {
      url, timeout, database, uid, password, model: 'account.move', method: capabilityProfile.senderMethods.invoiceRead,
      args: [[numericInvoiceId] as unknown as JsonValue, capabilityProfile.senderFields.moveResume],
      id: `${transactionId}-resume-invoice-read`, secrets,
    });
    initialMove = odooRecords(existingMove)[0] ?? {};
    if (toFiniteNumber(initialMove.id, 0) <= 0) throw new Error(`Odoo lifecycle resume invoice ${numericInvoiceId} was not found.`);
    const invoicePartnerId = odooRelationId(initialMove.partner_id);
    if (partnerId > 0 && invoicePartnerId > 0 && partnerId !== invoicePartnerId) throw new Error('Odoo lifecycle resume customer does not match the existing invoice customer.');
    if (partnerId <= 0) partnerId = invoicePartnerId;
  }

  let partnerCreated = false;
  if (partnerId <= 0) {
    const existingPartners = await odooExecuteKw(context, {
      url, timeout, database, uid, password, model: 'res.partner', method: capabilityProfile.senderMethods.partnerSearch,
      args: [[['email', '=ilike', recipientEmail]] as unknown as JsonValue],
      kwargs: { fields: capabilityProfile.senderFields.partnerSearch, limit: 2 }, id: `${transactionId}-partner-search`, secrets,
    });
    const found = assertUniqueOdooPartner(odooRecords(existingPartners), recipientEmail, { definitiveNoSideEffect: true, ambiguousSideEffect: false });
    partnerId = toFiniteNumber(found?.id, 0);
    if (partnerId <= 0) {
      const partnerPayload: IDataObject = { name: recipientName, email: recipientEmail };
      if (recipientAddress) partnerPayload.street = recipientAddress;
      try {
        const created = await odooExecuteKw(context, {
          url, timeout, database, uid, password, model: 'res.partner', method: capabilityProfile.senderMethods.partnerCreate, args: [partnerPayload],
          id: `${transactionId}-partner-create`, secrets, lifecycleStage: 'customer.create_if_missing',
        });
        partnerId = toFiniteNumber(created, 0);
        partnerCreated = true;
      } catch (error) {
        const details = odooErrorDetails(error);
        if (details.ambiguousSideEffect !== true) throw error;
        const reconcile = await tryOdooExecuteKw(context, {
          url, timeout, database, uid, password, model: 'res.partner', method: capabilityProfile.senderMethods.partnerSearch,
          args: [[['email', '=ilike', recipientEmail]] as unknown as JsonValue],
          kwargs: { fields: capabilityProfile.senderFields.partnerSearch, limit: 2 }, id: `${transactionId}-partner-reconcile`, secrets,
        });
        const reconciled = reconcile.success
          ? assertUniqueOdooPartner(odooRecords(reconcile.result), recipientEmail, { definitiveNoSideEffect: false, ambiguousSideEffect: true })
          : undefined;
        partnerId = toFiniteNumber(reconciled?.id, 0);
        if (partnerId <= 0) {
          if (reconcile.success) {
            throw new OdooOperationError(error instanceof Error ? error.message : String(error), {
              ...details, definitiveNoSideEffect: true, ambiguousSideEffect: false, reconciliation: 'partner_not_found_after_transport_error',
            });
          }
          throw new OdooOperationError(error instanceof Error ? error.message : String(error), {
            ...details, definitiveNoSideEffect: false, ambiguousSideEffect: true, reconciliation: 'partner_lookup_failed', reconciliationError: reconcile.errorMessage,
          });
        }
      }
    }
  }
  if (partnerId <= 0) throw new Error('Odoo partner lookup/create did not return a valid partner id.');

  const requestedInvoiceNumber = toStringValue(invoice.invoiceNumber || invoiceBody.invoice_number).trim();
  if (numericInvoiceId <= 0 && recoveryRun && requestedInvoiceNumber) {
    const recoveryLookup = await tryOdooExecuteKw(context, {
      url, timeout, database, uid, password, model: 'account.move', method: capabilityProfile.senderMethods.invoiceSearch,
      args: [[['move_type', '=', 'out_invoice'], ['partner_id', '=', partnerId], ['ref', '=', requestedInvoiceNumber]] as unknown as JsonValue],
      kwargs: { fields: capabilityProfile.senderFields.moveRecovery, order: 'id desc', limit: 2 },
      id: `${transactionId}-invoice-recovery-lookup`, secrets,
    });
    if (!recoveryLookup.success) {
      throw new OdooOperationError('Odoo recovery lookup failed before invoice creation; duplicate safety requires manual review.', {
        provider: 'odoo', category: 'reconciliation', errorType: 'AMBIGUOUS_PROVIDER_RESULT',
        model: 'account.move', method: capabilityProfile.senderMethods.invoiceSearch, lifecycleStage: 'invoice.recovery_lookup',
        definitiveNoSideEffect: false, ambiguousSideEffect: true, reconciliation: 'invoice_recovery_lookup_failed',
        reconciliationError: recoveryLookup.errorMessage,
      });
    }
    const matches = odooRecords(recoveryLookup.result);
    if (matches.length > 1) {
      throw new OdooOperationError(`Odoo recovery found multiple invoices with stable reference ${requestedInvoiceNumber}.`, {
        provider: 'odoo', category: 'reconciliation', errorType: 'AMBIGUOUS_PROVIDER_RESULT',
        model: 'account.move', method: capabilityProfile.senderMethods.invoiceSearch, lifecycleStage: 'invoice.recovery_lookup',
        definitiveNoSideEffect: false, ambiguousSideEffect: true, reconciliation: 'multiple_invoices_found',
      });
    }
    const recovered = matches[0];
    numericInvoiceId = toFiniteNumber(recovered?.id, 0);
    if (numericInvoiceId > 0) {
      initialMove = recovered ?? {};
      invoiceReused = true;
      recoveredExistingInvoice = true;
      recoveredExistingWasPosted = toStringValue(initialMove.state).toLowerCase() === 'posted';
    }
  }

  if (numericInvoiceId <= 0) {
    const rawLineItems = Array.isArray(invoiceBody.line_items) ? invoiceBody.line_items : [];
    const invoiceLineIds = rawLineItems.map((line) => {
      const record = isRecord(line) ? line : {};
      const values: IDataObject = {
        name: toStringValue(record.description || record.name, 'Service'),
        quantity: Math.max(1, toFiniteNumber(record.quantity, 1)),
        price_unit: Math.max(0, toFiniteNumber(record.price_unit ?? record.unit_price, 0)),
      };
      const discount = toFiniteNumber(record.discount, 0);
      if (discount > 0) values.discount = Math.min(100, discount);
      return [0, 0, values];
    });
    if (invoiceLineIds.length === 0) throw new Error('Odoo invoice requires at least one line item.');
    const movePayload: IDataObject = {
      move_type: 'out_invoice', partner_id: partnerId,
      invoice_date: toStringValue(invoice.invoiceDate || invoiceBody.invoice_date),
      invoice_line_ids: invoiceLineIds as unknown as JsonValue,
    };
    const dueDate = toStringValue(invoice.dueDate || invoiceBody.due_date);
    if (dueDate) movePayload.invoice_date_due = dueDate;
    if (requestedInvoiceNumber) movePayload.ref = requestedInvoiceNumber;
    const notes = toStringValue(invoice.notes || invoiceBody.notes).trim();
    if (notes) movePayload.narration = notes;
    const currencyCode = toStringValue(invoice.currency || invoiceBody.currency).trim().toUpperCase();
    if (currencyCode) {
      const currencies = await odooExecuteKw(context, {
        url, timeout, database, uid, password, model: 'res.currency', method: capabilityProfile.senderMethods.currencySearch,
        args: [[['name', '=', currencyCode]] as unknown as JsonValue],
        kwargs: { fields: capabilityProfile.senderFields.currencySearch, limit: 1 }, id: `${transactionId}-currency-search`, secrets,
      });
      const currencyId = toFiniteNumber(odooRecords(currencies)[0]?.id, 0);
      if (currencyId <= 0) throw new Error(`Odoo currency ${currencyCode} was not found.`);
      movePayload.currency_id = currencyId;
    }
    try {
      const invoiceId = await odooExecuteKw(context, {
        url, timeout, database, uid, password, model: 'account.move', method: capabilityProfile.senderMethods.invoiceCreate, args: [movePayload],
        id: `${transactionId}-invoice-create`, secrets, lifecycleStage: 'invoice.create',
      });
      numericInvoiceId = toFiniteNumber(invoiceId, 0);
    } catch (error) {
      const details = odooErrorDetails(error);
      if (details.ambiguousSideEffect !== true) throw error;
      const reconciliationDomain: JsonValue[] = [
        ['move_type', '=', 'out_invoice'] as unknown as JsonValue,
        ['partner_id', '=', partnerId] as unknown as JsonValue,
      ];
      if (requestedInvoiceNumber) reconciliationDomain.push(['ref', '=', requestedInvoiceNumber] as unknown as JsonValue);
      const reconcile = await tryOdooExecuteKw(context, {
        url, timeout, database, uid, password, model: 'account.move', method: capabilityProfile.senderMethods.invoiceSearch,
        args: [reconciliationDomain as unknown as JsonValue],
        kwargs: { fields: ['id', 'name', 'state', 'ref', 'partner_id'], order: 'id desc', limit: 2 },
        id: `${transactionId}-invoice-reconcile`, secrets,
      });
      const reconciledMatches = reconcile.success ? odooRecords(reconcile.result) : [];
      if (reconciledMatches.length > 1) {
        throw new OdooOperationError(`Odoo reconciliation found multiple invoices with stable reference ${requestedInvoiceNumber || '[missing]'}.`, {
          ...details, errorType: 'AMBIGUOUS_PROVIDER_RESULT', definitiveNoSideEffect: false, ambiguousSideEffect: true,
          reconciliation: 'multiple_invoices_found_after_transport_error',
        });
      }
      const reconciled = reconciledMatches[0];
      numericInvoiceId = toFiniteNumber(reconciled?.id, 0);
      if (numericInvoiceId > 0) invoiceReused = true;
      else if (reconcile.success) {
        throw new OdooOperationError(error instanceof Error ? error.message : String(error), {
          ...details, definitiveNoSideEffect: true, ambiguousSideEffect: false, reconciliation: 'invoice_not_found_after_transport_error',
        });
      } else {
        throw new OdooOperationError(error instanceof Error ? error.message : String(error), {
          ...details, definitiveNoSideEffect: false, ambiguousSideEffect: true, reconciliation: 'invoice_lookup_failed', reconciliationError: reconcile.errorMessage,
        });
      }
    }
    if (numericInvoiceId <= 0) throw new Error('Odoo invoice create did not return a valid invoice id.');
  }

  const emailRequested = config.sendInvoiceEmail === true;
  const postRequested = config.postInvoice === true || emailRequested;
  let posted = toStringValue(initialMove.state).toLowerCase() === 'posted';
  let postError = '';
  if (postRequested && !posted) {
    const post = await tryOdooExecuteKw(context, {
      url, timeout, database, uid, password, model: 'account.move', method: capabilityProfile.senderMethods.invoicePost, args: [[numericInvoiceId] as unknown as JsonValue],
      id: `${transactionId}-invoice-post`, secrets, lifecycleStage: 'invoice.post',
    });
    posted = post.success;
    postError = post.errorMessage;
    if (!post.success) {
      const reconcilePost = await tryOdooExecuteKw(context, {
        url, timeout, database, uid, password, model: 'account.move', method: 'read',
        args: [[numericInvoiceId] as unknown as JsonValue, capabilityProfile.senderFields.movePostReconcile], id: `${transactionId}-invoice-post-reconcile`, secrets,
      });
      const reconciledState = toStringValue(odooRecords(reconcilePost.result)[0]?.state).toLowerCase();
      if (reconcilePost.success && reconciledState === 'posted') {
        posted = true;
        postError = '';
      }
    }
  }

  let wizardId = 0;
  let emailStatus: OdooEmailStatus = emailRequested ? 'PENDING' : 'NOT_REQUESTED';
  let emailMethod = '';
  let emailError = postError;
  let emailEvidence: IDataObject = { schemaVersion: '1.0', wizardCompleted: false, blockedByPostFailure: Boolean(postError) };
  if (emailRequested && posted && recoveredExistingInvoice && recoveredExistingWasPosted && !resumeStage) {
    emailStatus = 'UNVERIFIED';
    emailMethod = 'recovery.manual_review';
    emailError = 'A posted invoice with the stable Campaign/Job reference already exists, but no trusted lifecycle checkpoint proves whether its email was previously sent. Automatic resend was blocked.';
    emailEvidence = {
      schemaVersion: '1.0', recoveryRun: true, recoveredExistingInvoice: true,
      recoveredExistingWasPosted: true, providerInvoiceId: numericInvoiceId,
      attemptEvidenceBound: false, recipientEvidenceBound: false, automaticResendBlocked: true,
    };
  } else if (emailRequested && posted) {
    const email = await executeOdooInvoiceEmail(context, {
      capabilityProfile, url, timeout, database, uid, password, invoiceId: numericInvoiceId, partnerId, recipientEmail, transactionId,
      emailForceSend: config.emailForceSend === true, secrets,
    });
    wizardId = email.wizardId;
    emailStatus = email.status;
    emailMethod = email.method;
    emailError = email.errorMessage;
    emailEvidence = email.evidence;
  }

  const moveRead = await tryOdooExecuteKw(context, {
    url, timeout, database, uid, password, model: 'account.move', method: 'read',
    args: [[numericInvoiceId] as unknown as JsonValue, capabilityProfile.senderFields.moveRead],
    id: `${transactionId}-invoice-read`, secrets,
  });
  const move = odooRecords(moveRead.result)[0] ?? initialMove;
  const actualInvoiceNumber = toStringValue(move.name ?? resume.invoiceNumber ?? resumeCheckpoint.invoiceNumber);
  const actualState = toStringValue(move.state, posted ? 'posted' : 'draft');
  posted = actualState.toLowerCase() === 'posted' || posted;
  const pdfAttachmentId = odooRelationId(move.invoice_pdf_report_id);
  if (!moveRead.success) {
    const readError = moveRead.errorMessage;
    emailError = emailError ? `${emailError}; ${readError}` : readError;
  }
  if (emailRequested && isRecord(emailEvidence) && emailEvidence.attemptEvidenceBound === true) {
    const pdfEvidence = await validateOdooPdfEvidence(context, {
      capabilityProfile, url, timeout, database, uid, password, invoiceId: numericInvoiceId,
      expectedAttachmentId: pdfAttachmentId,
      attemptAttachmentIds: odooNumberList(emailEvidence.attemptAttachmentIds),
      transactionId, secrets,
    });
    emailEvidence = { ...emailEvidence, pdfEvidence };
  }

  const failedStep = postError ? 'invoice.post' : emailRequested && emailStatus === 'FAILED' ? 'invoice.send_email' : '';
  const outcome = failedStep ? 'FAILED'
    : emailRequested && emailStatus === 'SENT' ? 'COMPLETED'
      : emailRequested && emailStatus === 'QUEUED' ? 'PROCESSING'
        : emailRequested && emailStatus === 'UNVERIFIED' ? 'PARTIAL'
          : emailRequested && emailStatus === 'PENDING' ? 'FAILED'
            : postRequested && !posted ? 'FAILED'
              : 'COMPLETED';
  const checkpoint = buildOdooCheckpoint({
    partnerId, partnerCreated, invoiceId: numericInvoiceId, invoiceNumber: actualInvoiceNumber, invoiceReused,
    posted, emailRequested, emailStatus, failedStep, errorMessage: emailError, emailEvidence,
  });
  const lifecycle = lifecycleResult({
    partnerCreated, posted, emailRequested, emailStatus, emailMethod, emailError, emailEvidence,
    outcome, failedStep, checkpoint,
  });
  const state = emailRequested
    ? emailStatus === 'SENT' ? 'sent'
      : emailStatus === 'QUEUED' ? 'email_queued'
        : emailStatus === 'FAILED' || emailStatus === 'PENDING' ? 'email_failed'
          : 'email_unverified'
    : actualState;
  const statusCode = outcome === 'COMPLETED' ? 201 : outcome === 'PROCESSING' || outcome === 'PARTIAL' ? 202 : 207;
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: {
      result: {
        id: numericInvoiceId, name: actualInvoiceNumber, partner_id: partnerId, partner_created: partnerCreated,
        state, provider_state: actualState, pdf_attachment_id: pdfAttachmentId, lifecycle, lifecycleCheckpoint: checkpoint,
      },
      odoo: {
        uid, database: '[REDACTED]', strategy: 'auto_customer_then_invoice', post_invoice: posted,
        send_invoice_email: emailRequested, email_sent: emailStatus === 'SENT', email_queued: emailStatus === 'QUEUED',
        email_status: emailStatus, email_method: emailMethod, email_error_message: emailError,
        email_evidence: emailEvidence, wizard_id: wizardId, invoice_number: actualInvoiceNumber,
        compatibility: { profileId: capabilityProfile.id, majorVersion: capabilityProfile.majorVersion, supported: true },
        issuer: request.issuerCompatibility ?? null,
        pdf_attachment_id: pdfAttachmentId, lifecycle_resume: Object.keys(resume).length > 0 ? resume : null,
      },
    },
  };
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
  return active.find((entry) => entry.scopeKey === scopeKey && entry.key === key && ['RESERVED', 'SENT', 'MANUAL_REVIEW'].includes(toStringValue(entry.status)));
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
    requestMapping: request.requestMapping, lifecycleResume: request.lifecycleResume ?? null, runtime: request.runtime ?? { scopeKey: allocation.scopeKey },
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
      const lifecycleResume = approvedLifecycleResume(request);
      const lifecycleResumeApproved = Object.keys(lifecycleResume).length > 0;
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
          requestPreview: { method: options.method, url: redactString(options.url, secrets), headerNames: Object.keys(headers), queryNames: Object.keys(query), contentType, unresolvedTokens, declarativeRecipePlan: toStringValue(isRecord(request.requestMapping) ? request.requestMapping.transportStrategy : '') === 'declarative_provider_recipe' ? declarativeRecipePlan(request) : null },
          idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null, lifecycleResume: request.lifecycleResume ?? null,
          startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), runtime: request.runtime,
        } }, pairedItem: { item: itemIndex } });
        continue;
      }
      if (preventDuplicateSends && !lifecycleResumeApproved) {
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
      } else if (preventDuplicateSends && lifecycleResumeApproved) {
        request.duplicatePrevention = {
          enabled: true, resumeBypass: true, source: 'status-manager', stage: lifecycleResume.stage,
          providerInvoiceId: lifecycleResume.providerInvoiceId ?? (isRecord(lifecycleResume.checkpoint) ? lifecycleResume.checkpoint.providerInvoiceId : ''),
        };
      }
      const strategy = toStringValue(isRecord(request.requestMapping) ? request.requestMapping.transportStrategy : '', 'single_http_request');
      const response = strategy === 'odoo_auto_customer_invoice'
        ? await executeOdooAutoCustomerInvoice(this, request, options, secret, secrets)
        : strategy === 'declarative_provider_recipe'
          ? await executeDeclarativeProviderRecipe(this, { request, options, secret, secrets })
          : await this.helpers.httpRequest(options);
      const parts = responseParts(response);
      const finishedAt = new Date();
      const safeBody = includeResponseBody ? redactJson(parts.body, secrets) : null;
      const successStatusCodes = numericList(isRecord(request.responsePolicy) ? request.responsePolicy.successStatusCodes : []);
      const transportSuccess = successStatusCodes.length > 0 ? successStatusCodes.includes(parts.statusCode) : parts.statusCode >= 200 && parts.statusCode < 300;
      if (preventDuplicateSends && reservedDuplicateKey && reservedDuplicateScope) {
        const ttlMs = duplicateTtlHours * 60 * 60 * 1000;
        const lifecycle = responseLifecycle(parts.body);
        const providerInvoiceId = responseProviderInvoiceId(parts.body);
        const invoiceCheckpointCreated = Boolean(providerInvoiceId || toStringValue(isRecord(lifecycle.checkpoint) ? lifecycle.checkpoint.providerInvoiceId : ''));
        const reservationStatus = invoiceCheckpointCreated || transportSuccess ? 'SENT' : 'FAILED';
        const reservationMessage = invoiceCheckpointCreated
          ? `Provider invoice checkpoint ${providerInvoiceId || 'created'} retained; lifecycle retries must resume the existing invoice.`
          : transportSuccess ? 'Provider transport completed successfully.' : `Provider transport failed with HTTP ${parts.statusCode}.`;
        const record = idempotencyRecord(request, reservedDuplicateScope, reservedDuplicateKey, reservationStatus, ttlMs, reservationMessage);
        finalizeInvoiceSend(reservedDuplicateScope, reservedDuplicateKey, reservationStatus, {
          httpStatus: parts.statusCode, providerInvoiceId, lifecycleOutcome: lifecycle.outcome ?? lifecycle.lifecycleOutcome,
          emailSendStatus: lifecycle.emailSendStatus ?? lifecycle.email_send_status, finishedAt: finishedAt.toISOString(),
        });
        persistIdempotency(this, record);
      }
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: transportSuccess, transportStatus: 'COMPLETED',
        requestId: request.requestId, transactionId: request.transactionId, providerId: request.providerId, profileId: request.profileId,
        accountId: request.accountId, workerId: request.workerId, actionId: request.actionId, httpStatus: parts.statusCode,
        responseHeaders: redactJson(parts.headers, secrets), responseBody: safeBody, latencyMs: Date.now() - started,
        responseSizeBytes: byteSize(parts.body), idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, duplicatePrevention: request.duplicatePrevention ?? null, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        responsePaths: request.responsePaths, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null, lifecycleResume: request.lifecycleResume ?? null, runtime: request.runtime,
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
      const providerError = odooErrorDetails(error);
      if (preventDuplicateSends && reservedDuplicateKey && reservedDuplicateScope) {
        const ttlMs = duplicateTtlHours * 60 * 60 * 1000;
        const ambiguous = providerError.ambiguousSideEffect === true;
        const reservationStatus = ambiguous ? 'MANUAL_REVIEW' : 'FAILED';
        const record = idempotencyRecord(request, reservedDuplicateScope, reservedDuplicateKey, reservationStatus, ttlMs, message);
        finalizeInvoiceSend(reservedDuplicateScope, reservedDuplicateKey, reservationStatus, { errorMessage: message, ambiguousSideEffect: ambiguous, finishedAt: new Date().toISOString() });
        persistIdempotency(this, record);
      }
      if (stopOnTransportError && !this.continueOnFail()) throw new Error(`${this.getNode().name} item ${itemIndex}: ${message}`);
      output.push({ json: { ...item.json, rawExecution: {
        schemaVersion: '1.0', success: false, transportStatus: /timeout/i.test(message) ? 'TIMEOUT' : 'ERROR',
        requestId: request.requestId, providerId: request.providerId, profileId: request.profileId, accountId: request.accountId,
        workerId: request.workerId, actionId: request.actionId, httpStatus: 0, responseHeaders: {}, responseBody: null,
        latencyMs: Date.now() - started, responseSizeBytes: 0, error: { message, ...providerError }, idempotency: request.idempotency ?? null, activationSafety: activationSafety ?? null, bulkSafety: bulkSafetyBase, presetSelfCheck, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
        responsePaths: request.responsePaths, responsePolicy: request.responsePolicy ?? null, requestMapping: request.requestMapping ?? null, lifecycleResume: request.lifecycleResume ?? null, runtime: request.runtime,
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
