import type { IDataObject, IExecuteFunctions } from '../types/N8n';
import { cloneJson, isRecord, nowIso, toFiniteNumber, toStringValue } from '../utils/Helpers';

interface CampaignState {
  key: string;
  scopeKey: string;
  campaignId: string;
  enabled: boolean;
  totalItems: number;
  maxItems: number;
  maxFailures: number;
  delayBetweenSendsMs: number;
  stopOnCriticalError: boolean;
  admittedJobIds: string[];
  terminalJobIds: string[];
  lastAttemptAt: number;
  sent: number;
  queued: number;
  failed: number;
  manualReview: number;
  duplicate: number;
  completed: number;
  retrying: number;
  failover: number;
  paused: boolean;
  pauseReason: string;
  runState: string;
  runId: string;
  lockAcquiredAt: string;
  lockExpiresAt: string;
  revision: number;
  writerRunId: string;
  aggregateSource: string;
  leaseDurationMs: number;
  updatedAt: string;
}

interface ResolveInput {
  scopeKey: string;
  campaignId: string;
  enabled: boolean;
  totalItems: number;
  maxItems: number;
  maxFailures: number;
  delayBetweenSendsMs: number;
  stopOnCriticalError: boolean;
  seed?: IDataObject;
  runId?: string;
  requireRunLease?: boolean;
  leaseDurationMs?: number;
}

const memory = new Map<string, CampaignState>();

function campaignKey(scopeKey: string, campaignId: string): string {
  return `${scopeKey.trim() || 'invoice-router'}:${campaignId.trim() || 'default-campaign'}`;
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map((entry) => toStringValue(entry)).filter(Boolean))] : [];
}

function timestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const parsed = Date.parse(toStringValue(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function readPersisted(context: IExecuteFunctions): IDataObject[] {
  try {
    const data = context.getWorkflowStaticData?.('global');
    return Array.isArray(data?.invoiceRouterCampaignStates) ? data.invoiceRouterCampaignStates.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function persist(context: IExecuteFunctions, state: CampaignState): void {
  memory.set(state.key, state);
  try {
    const data = context.getWorkflowStaticData?.('global');
    if (!data) return;
    const previous = readPersisted(context).filter((entry) => toStringValue(entry.key) !== state.key);
    data.invoiceRouterCampaignStates = [...previous.slice(-99), cloneJson(state as unknown as IDataObject)];
  } catch {
    // Sheet-derived state remains the correctness source when static-data persistence is unavailable.
  }
}

function stateFromRecord(record: IDataObject, fallback: Partial<CampaignState> = {}): CampaignState {
  const scopeKey = toStringValue(record.scopeKey, fallback.scopeKey ?? 'invoice-router');
  const campaignId = toStringValue(record.campaignId, fallback.campaignId ?? 'default-campaign');
  const key = toStringValue(record.key, fallback.key ?? campaignKey(scopeKey, campaignId));
  const lastAttemptAt = timestamp(record.lastAttemptAt ?? record.Last_Attempt_At);
  return {
    key,
    scopeKey,
    campaignId,
    enabled: record.enabled === undefined ? fallback.enabled !== false : record.enabled !== false,
    totalItems: Math.max(0, toFiniteNumber(record.totalItems, fallback.totalItems ?? 0)),
    maxItems: Math.max(1, toFiniteNumber(record.maxItems, fallback.maxItems ?? 100)),
    maxFailures: Math.max(0, toFiniteNumber(record.maxFailures, fallback.maxFailures ?? 5)),
    delayBetweenSendsMs: Math.max(0, toFiniteNumber(record.delayBetweenSendsMs, fallback.delayBetweenSendsMs ?? 0)),
    stopOnCriticalError: record.stopOnCriticalError === undefined ? fallback.stopOnCriticalError !== false : record.stopOnCriticalError !== false,
    admittedJobIds: uniqueStrings(record.admittedJobIds),
    terminalJobIds: uniqueStrings(record.terminalJobIds),
    lastAttemptAt,
    sent: Math.max(0, toFiniteNumber(record.sent, fallback.sent ?? 0)),
    queued: Math.max(0, toFiniteNumber(record.queued, fallback.queued ?? 0)),
    failed: Math.max(0, toFiniteNumber(record.failed, fallback.failed ?? 0)),
    manualReview: Math.max(0, toFiniteNumber(record.manualReview, fallback.manualReview ?? 0)),
    duplicate: Math.max(0, toFiniteNumber(record.duplicate, fallback.duplicate ?? 0)),
    completed: Math.max(0, toFiniteNumber(record.completed, fallback.completed ?? 0)),
    retrying: Math.max(0, toFiniteNumber(record.retrying ?? record.Retrying, fallback.retrying ?? 0)),
    failover: Math.max(0, toFiniteNumber(record.failover ?? record.Failover, fallback.failover ?? 0)),
    paused: record.paused === true || toStringValue(record.Status).toUpperCase() === 'PAUSED',
    pauseReason: toStringValue(record.pauseReason ?? record.Pause_Reason, fallback.pauseReason ?? ''),
    runState: toStringValue(record.runState ?? record.Run_State, fallback.runState ?? '').toUpperCase(),
    runId: toStringValue(record.runId ?? record.Run_ID, fallback.runId ?? ''),
    lockAcquiredAt: toStringValue(record.lockAcquiredAt ?? record.Lock_Acquired_At, fallback.lockAcquiredAt ?? ''),
    lockExpiresAt: toStringValue(record.lockExpiresAt ?? record.Lock_Expires_At, fallback.lockExpiresAt ?? ''),
    revision: Math.max(0, toFiniteNumber(record.revision ?? record.Revision, fallback.revision ?? 0)),
    writerRunId: toStringValue(record.writerRunId ?? record.Writer_Run_ID, fallback.writerRunId ?? ''),
    aggregateSource: toStringValue(record.aggregateSource ?? record.Aggregate_Source, fallback.aggregateSource ?? ''),
    leaseDurationMs: Math.max(0, toFiniteNumber(record.leaseDurationMs, fallback.leaseDurationMs ?? 0)),
    updatedAt: toStringValue(record.updatedAt ?? record.Updated_At, fallback.updatedAt ?? nowIso()),
  };
}

function mergeDurableState(target: CampaignState, source: CampaignState): CampaignState {
  target.admittedJobIds = [...new Set([...target.admittedJobIds, ...source.admittedJobIds])];
  target.terminalJobIds = [...new Set([...target.terminalJobIds, ...source.terminalJobIds])];
  target.totalItems = Math.max(target.totalItems, source.totalItems);
  target.lastAttemptAt = Math.max(target.lastAttemptAt, source.lastAttemptAt);
  target.sent = Math.max(target.sent, source.sent);
  target.queued = Math.max(target.queued, source.queued);
  target.failed = Math.max(target.failed, source.failed);
  target.manualReview = Math.max(target.manualReview, source.manualReview);
  target.duplicate = Math.max(target.duplicate, source.duplicate);
  target.completed = Math.max(target.completed, source.completed);
  target.retrying = Math.max(target.retrying, source.retrying);
  target.failover = Math.max(target.failover, source.failover);
  if (source.paused) {
    target.paused = true;
    target.pauseReason = source.pauseReason || target.pauseReason;
  }
  if (source.revision > target.revision) {
    target.revision = source.revision;
    target.runState = source.runState;
    target.runId = source.runId;
    target.lockAcquiredAt = source.lockAcquiredAt;
    target.lockExpiresAt = source.lockExpiresAt;
    target.writerRunId = source.writerRunId;
    target.aggregateSource = source.aggregateSource;
    target.updatedAt = source.updatedAt;
  }
  return target;
}

function resolveState(context: IExecuteFunctions, input: ResolveInput): CampaignState {
  const key = campaignKey(input.scopeKey, input.campaignId);
  const fallback: Partial<CampaignState> = {
    key,
    scopeKey: input.scopeKey,
    campaignId: input.campaignId,
    enabled: input.enabled,
    totalItems: input.totalItems,
    maxItems: input.maxItems,
    maxFailures: input.maxFailures,
    delayBetweenSendsMs: input.delayBetweenSendsMs,
    stopOnCriticalError: input.stopOnCriticalError,
    admittedJobIds: [],
    terminalJobIds: [],
    lastAttemptAt: 0,
    sent: 0,
    queued: 0,
    failed: 0,
    manualReview: 0,
    duplicate: 0,
    completed: 0,
    retrying: 0,
    failover: 0,
    paused: false,
    pauseReason: '',
    runState: '',
    runId: '',
    lockAcquiredAt: '',
    lockExpiresAt: '',
    revision: 0,
    writerRunId: input.runId ?? '',
    aggregateSource: '',
    leaseDurationMs: input.leaseDurationMs ?? 0,
    updatedAt: nowIso(),
  };
  const seedState = input.seed ? stateFromRecord(input.seed, fallback) : undefined;
  const inMemory = memory.get(key);
  const persisted = readPersisted(context).find((entry) => toStringValue(entry.key) === key);
  const persistedState = persisted ? stateFromRecord(persisted, fallback) : undefined;

  let state: CampaignState;
  if (seedState) {
    const sameRunMemory = inMemory && (!seedState.runId || !inMemory.runId || seedState.runId === inMemory.runId);
    state = sameRunMemory && inMemory.revision >= seedState.revision ? inMemory : seedState;
    if (state === inMemory) mergeDurableState(state, seedState);
  } else {
    state = inMemory ?? persistedState ?? stateFromRecord({}, fallback);
  }
  if (!seedState && inMemory && persistedState && persistedState.updatedAt > inMemory.updatedAt) mergeDurableState(state, persistedState);

  state.enabled = input.enabled;
  state.totalItems = Math.max(state.totalItems, input.totalItems);
  state.maxItems = input.maxItems;
  state.maxFailures = input.maxFailures;
  state.delayBetweenSendsMs = input.delayBetweenSendsMs;
  state.stopOnCriticalError = input.stopOnCriticalError;
  state.leaseDurationMs = Math.max(state.leaseDurationMs, input.leaseDurationMs ?? 0);
  if (input.runId && !state.runId) state.runId = input.runId;
  return state;
}

function snapshot(state: CampaignState, extra: IDataObject = {}): IDataObject {
  const terminalCount = state.terminalJobIds.length;
  return {
    schemaVersion: '2.0',
    key: state.key,
    scopeKey: state.scopeKey,
    campaignId: state.campaignId,
    enabled: state.enabled,
    totalItems: state.totalItems,
    maxItems: state.maxItems,
    maxFailures: state.maxFailures,
    delayBetweenSendsMs: state.delayBetweenSendsMs,
    admitted: state.admittedJobIds.length,
    admittedJobIds: [...state.admittedJobIds],
    terminal: terminalCount,
    terminalJobIds: [...state.terminalJobIds],
    pending: Math.max(0, state.totalItems - terminalCount),
    sent: state.sent,
    queued: state.queued,
    failed: state.failed,
    manualReview: state.manualReview,
    duplicate: state.duplicate,
    completed: state.completed,
    retrying: state.retrying,
    failover: state.failover,
    paused: state.paused,
    pauseReason: state.pauseReason,
    runState: state.runState,
    runId: state.runId,
    lockAcquiredAt: state.lockAcquiredAt,
    lockExpiresAt: state.lockExpiresAt,
    revision: state.revision,
    writerRunId: state.writerRunId,
    aggregateSource: state.aggregateSource,
    lastAttemptAt: state.lastAttemptAt > 0 ? new Date(state.lastAttemptAt).toISOString() : '',
    updatedAt: state.updatedAt,
    ...extra,
  };
}

function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function touch(state: CampaignState, refreshLease = true): void {
  const now = Date.now();
  state.updatedAt = new Date(now).toISOString();
  state.revision += 1;
  state.writerRunId = state.runId || state.writerRunId;
  state.aggregateSource = 'DURABLE_SHEET_REBUILD_PLUS_RUNTIME_EVENT';
  if (refreshLease && state.runState === 'ACTIVE' && state.leaseDurationMs > 0) {
    state.lockExpiresAt = new Date(now + state.leaseDurationMs).toISOString();
  }
}

function leaseBlockReason(state: CampaignState, expectedRunId: string): string {
  if (state.runState !== 'ACTIVE') return `Campaign ${state.campaignId} does not have an ACTIVE run lease.`;
  if (!state.runId) return `Campaign ${state.campaignId} run lease has no Run_ID.`;
  if (expectedRunId && state.runId !== expectedRunId) return `Campaign ${state.campaignId} is leased by another execution (${state.runId}).`;
  const expiresAt = timestamp(state.lockExpiresAt);
  if (!expiresAt || expiresAt <= Date.now()) return `Campaign ${state.campaignId} run lease is expired.`;
  return '';
}

export async function admitCampaignJob(context: IExecuteFunctions, input: {
  scopeKey: string;
  campaignId: string;
  jobId: string;
  config: IDataObject;
}): Promise<IDataObject> {
  const enabled = input.config.enabled === true;
  const totalItems = Math.max(0, toFiniteNumber(input.config.totalItems, 0));
  const maxItems = Math.max(1, toFiniteNumber(input.config.maxItems, 100));
  const maxFailures = Math.max(0, toFiniteNumber(input.config.maxFailures, 5));
  const delayBetweenSendsMs = Math.max(0, toFiniteNumber(input.config.delayBetweenSendsMs, 0));
  const stopOnCriticalError = input.config.stopOnCriticalError !== false;
  const seed = isRecord(input.config.seed) ? input.config.seed : undefined;
  const runId = toStringValue(input.config.runId);
  const leaseDurationMs = Math.max(0, toFiniteNumber(input.config.leaseDurationMs, 0));
  const state = resolveState(context, {
    scopeKey: input.scopeKey,
    campaignId: input.campaignId,
    enabled,
    totalItems,
    maxItems,
    maxFailures,
    delayBetweenSendsMs,
    stopOnCriticalError,
    seed,
    runId,
    requireRunLease: input.config.requireRunLease === true,
    leaseDurationMs,
  });

  if (input.config.requireRunLease === true) {
    const reason = leaseBlockReason(state, runId);
    if (reason) return snapshot(state, { approved: false, status: 'BLOCKED', reason, waitMs: 0 });
  }
  const configuredBlock = toStringValue(input.config.blockReason).trim();
  if (configuredBlock) {
    state.paused = true;
    state.pauseReason = configuredBlock;
    touch(state);
    persist(context, state);
    return snapshot(state, { approved: false, status: 'BLOCKED', reason: configuredBlock, waitMs: 0 });
  }
  if (enabled && totalItems > maxItems) {
    const reason = `Campaign ${input.campaignId} contains ${totalItems} eligible jobs, exceeding Max Invoices Per Execution ${maxItems}.`;
    state.paused = true;
    state.pauseReason = reason;
    touch(state);
    persist(context, state);
    return snapshot(state, { approved: false, status: 'BLOCKED', reason, waitMs: 0 });
  }
  if (state.paused) {
    return snapshot(state, { approved: false, status: 'QUEUED', reason: state.pauseReason || 'Campaign is paused.', waitMs: 0 });
  }
  if (state.terminalJobIds.includes(input.jobId)) {
    return snapshot(state, { approved: false, status: 'BLOCKED', reason: `Job ${input.jobId} is already terminal in this campaign.`, waitMs: 0 });
  }

  const now = Date.now();
  const dueAt = state.lastAttemptAt + delayBetweenSendsMs;
  const waitMs = enabled && state.lastAttemptAt > 0 ? Math.max(0, dueAt - now) : 0;
  await wait(waitMs);
  state.lastAttemptAt = Date.now();
  if (input.jobId && !state.admittedJobIds.includes(input.jobId)) state.admittedJobIds.push(input.jobId);
  touch(state);
  persist(context, state);
  return snapshot(state, { approved: true, status: 'APPROVED', reason: '', waitMs });
}

export function recordCampaignOutcome(context: IExecuteFunctions, input: {
  scopeKey: string;
  campaignId: string;
  jobId: string;
  config: IDataObject;
  recipientStatus: string;
  terminal: boolean;
  critical: boolean;
  errorMessage?: string;
  retryingIncrement?: number;
  failoverIncrement?: number;
}): IDataObject {
  const state = resolveState(context, {
    scopeKey: input.scopeKey,
    campaignId: input.campaignId,
    enabled: input.config.enabled === true,
    totalItems: Math.max(0, toFiniteNumber(input.config.totalItems, 0)),
    maxItems: Math.max(1, toFiniteNumber(input.config.maxItems, 100)),
    maxFailures: Math.max(0, toFiniteNumber(input.config.maxFailures, 5)),
    delayBetweenSendsMs: Math.max(0, toFiniteNumber(input.config.delayBetweenSendsMs, 0)),
    stopOnCriticalError: input.config.stopOnCriticalError !== false,
    seed: isRecord(input.config.seed) ? input.config.seed : undefined,
    runId: toStringValue(input.config.runId),
    requireRunLease: input.config.requireRunLease === true,
    leaseDurationMs: Math.max(0, toFiniteNumber(input.config.leaseDurationMs, 0)),
  });
  const status = input.recipientStatus.trim().toUpperCase();
  if (input.terminal && input.jobId && !state.terminalJobIds.includes(input.jobId)) {
    state.terminalJobIds.push(input.jobId);
    if (status === 'SENT') state.sent += 1;
    else if (status === 'QUEUED') state.queued += 1;
    else if (status === 'FAILED') state.failed += 1;
    else if (status === 'MANUAL_REVIEW') state.manualReview += 1;
    else if (status === 'DUPLICATE') state.duplicate += 1;
    else if (status === 'COMPLETED') state.completed += 1;
  }
  state.retrying += Math.max(0, toFiniteNumber(input.retryingIncrement, 0));
  state.failover += Math.max(0, toFiniteNumber(input.failoverIncrement, 0));
  const failureTotal = state.failed + state.manualReview;
  if (state.maxFailures > 0 && failureTotal >= state.maxFailures) {
    state.paused = true;
    state.pauseReason = `Campaign paused after ${failureTotal} terminal failed/manual-review jobs reached the configured threshold ${state.maxFailures}.`;
  }
  if (input.terminal && input.critical && state.stopOnCriticalError) {
    state.paused = true;
    state.pauseReason = input.errorMessage?.trim() || 'Campaign paused after a critical terminal error.';
  }
  touch(state);
  persist(context, state);
  return snapshot(state);
}

export function pauseCampaign(context: IExecuteFunctions, input: {
  scopeKey: string;
  campaignId: string;
  config: IDataObject;
  reason: string;
}): IDataObject {
  const state = resolveState(context, {
    scopeKey: input.scopeKey,
    campaignId: input.campaignId,
    enabled: input.config.enabled === true,
    totalItems: Math.max(0, toFiniteNumber(input.config.totalItems, 0)),
    maxItems: Math.max(1, toFiniteNumber(input.config.maxItems, 100)),
    maxFailures: Math.max(0, toFiniteNumber(input.config.maxFailures, 5)),
    delayBetweenSendsMs: Math.max(0, toFiniteNumber(input.config.delayBetweenSendsMs, 0)),
    stopOnCriticalError: input.config.stopOnCriticalError !== false,
    seed: isRecord(input.config.seed) ? input.config.seed : undefined,
    runId: toStringValue(input.config.runId),
    requireRunLease: input.config.requireRunLease === true,
    leaseDurationMs: Math.max(0, toFiniteNumber(input.config.leaseDurationMs, 0)),
  });
  state.paused = true;
  state.pauseReason = input.reason.trim() || 'Campaign paused.';
  touch(state);
  persist(context, state);
  return snapshot(state);
}
