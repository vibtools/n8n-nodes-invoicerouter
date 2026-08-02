import type { IDataObject } from '../shared/types/N8n';
import { isRecord, toStringValue } from '../shared/utils/Helpers';

export type InvoiceLifecycleMode = 'draftOnly' | 'createOnly' | 'createAndPost' | 'createPostAndSendEmail';

export interface ProviderCapability {
  providerId: string;
  displayName: string;
  supportsCustomerLookup: boolean;
  supportsCustomerCreate: boolean;
  supportsInvoiceCreate: boolean;
  supportsInvoicePost: boolean;
  supportsInvoiceEmailSend: boolean;
  supportsInvoicePdf: boolean;
  requiredAccountFields: string[];
  recipeId: string;
}

const DEFAULT_CAPABILITY: ProviderCapability = {
  providerId: 'generic-http',
  displayName: 'Generic HTTP Provider',
  supportsCustomerLookup: false,
  supportsCustomerCreate: false,
  supportsInvoiceCreate: true,
  supportsInvoicePost: false,
  supportsInvoiceEmailSend: false,
  supportsInvoicePdf: false,
  requiredAccountFields: [],
  recipeId: 'generic-http',
};

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = {
  odoo: {
    providerId: 'odoo',
    displayName: 'Odoo',
    supportsCustomerLookup: true,
    supportsCustomerCreate: true,
    supportsInvoiceCreate: true,
    supportsInvoicePost: true,
    supportsInvoiceEmailSend: true,
    supportsInvoicePdf: true,
    requiredAccountFields: ['Database', 'Username', 'Password'],
    recipeId: 'odoo',
  },
  stripe: {
    providerId: 'stripe',
    displayName: 'Stripe',
    supportsCustomerLookup: true,
    supportsCustomerCreate: true,
    supportsInvoiceCreate: true,
    supportsInvoicePost: true,
    supportsInvoiceEmailSend: true,
    supportsInvoicePdf: true,
    requiredAccountFields: ['API Key'],
    recipeId: 'stripe',
  },
  'zoho-books': {
    providerId: 'zoho-books',
    displayName: 'Zoho Books',
    supportsCustomerLookup: true,
    supportsCustomerCreate: true,
    supportsInvoiceCreate: true,
    supportsInvoicePost: true,
    supportsInvoiceEmailSend: true,
    supportsInvoicePdf: true,
    requiredAccountFields: ['API Key', 'Extra Value'],
    recipeId: 'zoho-books',
  },
  quickbooks: {
    providerId: 'quickbooks',
    displayName: 'QuickBooks',
    supportsCustomerLookup: true,
    supportsCustomerCreate: true,
    supportsInvoiceCreate: true,
    supportsInvoicePost: true,
    supportsInvoiceEmailSend: true,
    supportsInvoicePdf: true,
    requiredAccountFields: ['API Key', 'API Secret', 'Extra Value'],
    recipeId: 'quickbooks',
  },
  custom: DEFAULT_CAPABILITY,
  'generic-http': DEFAULT_CAPABILITY,
};

function normalizedMode(value: unknown): InvoiceLifecycleMode | undefined {
  const mode = toStringValue(value).trim().replace(/[_\s-]+/g, '').toLowerCase();
  if (!mode) return undefined;
  if (['draftonly', 'draft'].includes(mode)) return 'draftOnly';
  if (['createonly', 'create'].includes(mode)) return 'createOnly';
  if (['createandpost', 'post', 'posted', 'finalize', 'finalise'].includes(mode)) return 'createAndPost';
  if (['createpostandsendemail', 'createpostsendemail', 'sendemail', 'send', 'postedandsent'].includes(mode)) return 'createPostAndSendEmail';
  return undefined;
}

function booleanFlag(value: unknown): boolean {
  return value === true || ['true', 'yes', '1', 'enabled', 'on'].includes(toStringValue(value).trim().toLowerCase());
}

export function providerCapability(providerId: string): ProviderCapability {
  return PROVIDER_CAPABILITIES[providerId] ?? DEFAULT_CAPABILITY;
}

export function lifecycleModeFromConfig(providerId: string, extraConfig: unknown): InvoiceLifecycleMode {
  const config = isRecord(extraConfig) ? extraConfig : {};
  const explicit = normalizedMode(config.invoiceLifecycle ?? config.lifecycleMode ?? config.lifecycle);
  if (explicit) return explicit;
  if (providerId === 'odoo' && booleanFlag(config.odooSendInvoiceEmail)) return 'createPostAndSendEmail';
  if (providerId === 'odoo' && booleanFlag(config.odooPostInvoice)) return 'createAndPost';
  if (booleanFlag(config.sendInvoiceEmail) || booleanFlag(config.emailSend)) return 'createPostAndSendEmail';
  if (booleanFlag(config.postInvoice) || booleanFlag(config.finalizeInvoice)) return 'createAndPost';
  return 'draftOnly';
}

export function lifecycleSteps(mode: InvoiceLifecycleMode): string[] {
  if (mode === 'draftOnly' || mode === 'createOnly') return ['customer.resolve', 'customer.create_if_missing', 'invoice.create'];
  if (mode === 'createAndPost') return ['customer.resolve', 'customer.create_if_missing', 'invoice.create', 'invoice.post'];
  return ['customer.resolve', 'customer.create_if_missing', 'invoice.create', 'invoice.post', 'invoice.send_email'];
}


export interface ProviderRecipeReadiness extends IDataObject {
  source: string;
  executable: boolean;
  runtime: string;
  missing: string[];
}

function recipeRuntime(value: IDataObject): string {
  const runtime = isRecord(value.runtime) ? value.runtime : {};
  return toStringValue(runtime.type ?? value.runtimeType ?? value.transportStrategy ?? value.strategy, '').trim() || 'metadata_only';
}

function runtimeStepObjects(value: IDataObject): IDataObject[] {
  return Array.isArray(value.steps) ? value.steps.filter(isRecord) : [];
}

function recipeReadiness(recipe: IDataObject | undefined): ProviderRecipeReadiness {
  if (!recipe) return { source: 'built-in-capability', executable: false, runtime: 'metadata_only', missing: ['declarativeRecipe'] };
  const missing: string[] = [];
  const runtime = recipeRuntime(recipe);
  if (!toStringValue(recipe.providerId)) missing.push('providerId');
  if (!toStringValue(recipe.recipeId)) missing.push('recipeId');
  const steps = runtimeStepObjects(recipe);
  if (steps.length === 0) missing.push('steps[] objects');
  for (const [index, step] of steps.entries()) {
    const request = isRecord(step.request) ? step.request : step;
    if (!toStringValue(step.id ?? step.name ?? step.lifecycleStep)) missing.push(`steps[${index}].id`);
    if (!toStringValue(request.method)) missing.push(`steps[${index}].request.method`);
    if (!toStringValue(request.url)) missing.push(`steps[${index}].request.url`);
  }
  return { source: 'extra-config', executable: missing.length === 0 && runtime === 'declarative_http', runtime, missing };
}

function normalizeDeclarativeRecipe(providerId: string, extraConfig: IDataObject): IDataObject | undefined {
  const raw = extraConfig.providerRecipe ?? extraConfig.declarativeRecipe ?? extraConfig.invoiceRouterRecipe;
  if (!isRecord(raw)) return undefined;
  const recipeId = toStringValue(raw.recipeId, `${providerId}-custom`);
  return {
    schemaVersion: toStringValue(raw.schemaVersion, '2.0'),
    providerId: toStringValue(raw.providerId, providerId),
    recipeId,
    displayName: toStringValue(raw.displayName, `${providerId} Declarative Recipe`),
    runtime: isRecord(raw.runtime) ? raw.runtime : { type: toStringValue(raw.runtimeType ?? raw.transportStrategy, 'declarative_http') },
    lifecycleModes: Array.isArray(raw.lifecycleModes) ? raw.lifecycleModes : ['createOnly', 'createAndPost', 'createPostAndSendEmail'],
    requiredAccountFields: Array.isArray(raw.requiredAccountFields) ? raw.requiredAccountFields : [],
    capabilities: isRecord(raw.capabilities) ? raw.capabilities : {},
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    responseMap: isRecord(raw.responseMap) ? raw.responseMap : {},
    errorMap: isRecord(raw.errorMap) ? raw.errorMap : {},
  };
}

export function lifecycleMetadata(providerId: string, extraConfig: unknown): IDataObject {
  const config = isRecord(extraConfig) ? extraConfig : {};
  const capability = providerCapability(providerId);
  const mode = lifecycleModeFromConfig(providerId, config);
  const declarativeRecipe = normalizeDeclarativeRecipe(providerId, config);
  const readiness = recipeReadiness(declarativeRecipe);
  return {
    schemaVersion: '2.0',
    providerId,
    recipeId: toStringValue(declarativeRecipe?.recipeId, capability.recipeId),
    mode,
    steps: lifecycleSteps(mode),
    capability: {
      supportsCustomerLookup: capability.supportsCustomerLookup,
      supportsCustomerCreate: capability.supportsCustomerCreate,
      supportsInvoiceCreate: capability.supportsInvoiceCreate,
      supportsInvoicePost: capability.supportsInvoicePost,
      supportsInvoiceEmailSend: capability.supportsInvoiceEmailSend,
      supportsInvoicePdf: capability.supportsInvoicePdf,
      requiredAccountFields: capability.requiredAccountFields,
    },
    declarativeRecipe: declarativeRecipe ?? null,
    recipeReadiness: readiness,
  };
}
