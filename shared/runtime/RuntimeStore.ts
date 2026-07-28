import type { IDataObject, IExecuteFunctions } from '../types/N8n';
import { cloneJson, isRecord, nowIso, toFiniteNumber, toStringValue } from '../utils/Helpers';

export type AccountState = 'AVAILABLE' | 'LOCKED' | 'IN_USE' | 'COOLDOWN' | 'ERROR' | 'DISABLED';
export type AllocationStrategy = 'firstAvailable' | 'roundRobin' | 'leastRecentlyUsed' | 'leastBusy' | 'highestHealth' | 'weighted';

export interface SecretMaterial {
  apiKey: string;
  apiSecret: string;
  extraValue: string;
  headerName: string;
  headerValue: string;
  authType: string;
}

interface LockOwner {
  workflowId: string;
  executionId: string;
  workerId: string;
  lockedAt: number;
}

interface RuntimeAccount {
  profile: IDataObject;
  state: AccountState;
  lock?: LockOwner;
  cooldownUntil: number;
  lastUsedAt: number;
  activeRequests: number;
  requestTimes: number[];
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  retryCount: number;
  latencyTotal: number;
  healthScore: number;
  weight: number;
  priority: number;
}

interface Pool {
  accounts: Map<string, RuntimeAccount>;
  cursor: number;
  processedFeedbackIds: Set<string>;
  lastTouchedAt: number;
}

const pools = new Map<string, Pool>();
const vault = new Map<string, SecretMaterial>();
const usedRecipients = new Map<string, Set<string>>();

export function executionIdentity(context: IExecuteFunctions, batchId = 'default'): {
  workflowId: string;
  executionId: string;
  batchId: string;
  scopeKey: string;
} {
  const workflow = context.getWorkflow?.();
  const workflowId = toStringValue(workflow?.id ?? workflow?.name, 'invoice-router');
  const executionId = toStringValue(context.getExecutionId?.(), `local-${Date.now()}`);
  const safeBatchId = batchId.trim() || 'default';
  return { workflowId, executionId, batchId: safeBatchId, scopeKey: `${workflowId}:${safeBatchId}` };
}

export function registerProviderProfiles(scopeKey: string, profiles: IDataObject[], secrets: Map<string, SecretMaterial>): void {
  const pool = pools.get(scopeKey) ?? { accounts: new Map<string, RuntimeAccount>(), cursor: 0, processedFeedbackIds: new Set<string>(), lastTouchedAt: Date.now() };
  pool.lastTouchedAt = Date.now();
  const seen = new Set<string>();
  for (const profile of profiles) {
    const id = toStringValue(profile.id);
    if (!id) continue;
    seen.add(id);
    const enabled = profile.enabled !== false;
    const existing = pool.accounts.get(id);
    const account: RuntimeAccount = existing ?? {
      profile: cloneJson(profile),
      state: enabled ? 'AVAILABLE' : 'DISABLED',
      cooldownUntil: 0,
      lastUsedAt: 0,
      activeRequests: 0,
      requestTimes: [],
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      retryCount: 0,
      latencyTotal: 0,
      healthScore: 100,
      weight: Math.max(1, toFiniteNumber(profile.weight, 1)),
      priority: toFiniteNumber(profile.priority, 0),
    };
    account.profile = cloneJson(profile);
    if (!enabled) account.state = 'DISABLED';
    else if (account.state === 'DISABLED') account.state = 'AVAILABLE';
    pool.accounts.set(id, account);
    const secret = secrets.get(id);
    if (secret) vault.set(`${scopeKey}::${id}`, secret);
  }
  for (const [id, account] of pool.accounts.entries()) {
    if (!seen.has(id)) account.state = 'DISABLED';
  }
  pools.set(scopeKey, pool);
}

function recover(account: RuntimeAccount, now: number, lockTimeoutMs: number): void {
  if ((account.state === 'COOLDOWN' || account.state === 'ERROR') && account.cooldownUntil <= now) {
    account.state = 'AVAILABLE';
    account.cooldownUntil = 0;
  }
  if ((account.state === 'LOCKED' || account.state === 'IN_USE') && account.lock && now - account.lock.lockedAt >= lockTimeoutMs) {
    account.state = 'AVAILABLE';
    account.lock = undefined;
    account.activeRequests = Math.max(0, account.activeRequests - 1);
  }
}

function matches(account: RuntimeAccount, filters: IDataObject): boolean {
  const profile = account.profile;
  const pairs: Array<[string, unknown]> = [
    ['providerId', filters.providerId],
    ['actionId', filters.actionId],
    ['environment', filters.environment],
  ];
  return pairs.every(([key, expected]) => !expected || toStringValue(profile[key]).toLowerCase() === toStringValue(expected).toLowerCase());
}

export interface AllocationOptions {
  strategy: AllocationStrategy;
  filters: IDataObject;
  workerId: string;
  workflowId: string;
  executionId: string;
  lockTimeoutMs: number;
  maxRequestsPerMinute: number;
  circuitBreakerThreshold: number;
  holdLock: boolean;
}

export function allocateProvider(scopeKey: string, options: AllocationOptions): IDataObject | undefined {
  const pool = pools.get(scopeKey);
  if (!pool) return undefined;
  const now = Date.now();
  const candidates = [...pool.accounts.values()].filter((account) => {
    recover(account, now, options.lockTimeoutMs);
    account.requestTimes = account.requestTimes.filter((time) => now - time < 60_000);
    if (account.consecutiveFailures >= options.circuitBreakerThreshold) {
      account.state = 'COOLDOWN';
      account.cooldownUntil = Math.max(account.cooldownUntil, now + 60_000);
    }
    return account.state === 'AVAILABLE' && account.requestTimes.length < options.maxRequestsPerMinute && matches(account, options.filters);
  });
  if (candidates.length === 0) return undefined;

  let selected: RuntimeAccount;
  if (options.strategy === 'roundRobin') {
    selected = candidates[pool.cursor % candidates.length];
    pool.cursor = (pool.cursor + 1) % Math.max(1, candidates.length);
  } else if (options.strategy === 'leastRecentlyUsed') {
    selected = candidates.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
  } else if (options.strategy === 'leastBusy') {
    selected = candidates.sort((a, b) => a.activeRequests - b.activeRequests || b.healthScore - a.healthScore)[0];
  } else if (options.strategy === 'highestHealth') {
    selected = candidates.sort((a, b) => b.healthScore - a.healthScore || a.lastUsedAt - b.lastUsedAt)[0];
  } else if (options.strategy === 'weighted') {
    selected = candidates.sort((a, b) => b.weight * b.healthScore - a.weight * a.healthScore)[0];
  } else {
    selected = candidates.sort((a, b) => a.priority - b.priority || a.lastUsedAt - b.lastUsedAt)[0];
  }

  selected.state = 'LOCKED';
  selected.lock = {
    workflowId: options.workflowId,
    executionId: options.executionId,
    workerId: options.workerId,
    lockedAt: now,
  };
  selected.lastUsedAt = now;
  selected.activeRequests += 1;
  selected.requestTimes.push(now);

  const profileId = toStringValue(selected.profile.id);
  const allocation: IDataObject = {
    ...cloneJson(selected.profile),
    credentialRef: `${scopeKey}::${profileId}`,
    runtime: {
      state: options.holdLock ? selected.state : 'RESERVED_SEQUENTIAL',
      healthScore: Math.round(selected.healthScore * 100) / 100,
      retryCount: selected.retryCount,
      cooldownUntil: selected.cooldownUntil ? new Date(selected.cooldownUntil).toISOString() : null,
      lock: {
        workflowId: options.workflowId,
        executionId: options.executionId,
        workerId: options.workerId,
        lockedAt: nowIso(),
      },
    },
  };
  if (!options.holdLock) {
    selected.state = 'AVAILABLE';
    selected.lock = undefined;
    selected.activeRequests = Math.max(0, selected.activeRequests - 1);
  }
  return allocation;
}

export function getSecretMaterial(credentialRef: string): SecretMaterial | undefined {
  return vault.get(credentialRef);
}

export interface ProviderFeedback {
  feedbackId?: string;
  profileId: string;
  workerId?: string;
  status: string;
  result: string;
  errorType?: string;
  httpStatus?: number;
  latencyMs?: number;
  retryCount?: number;
  cooldownSeconds?: number;
  recommendation?: string;
}

function calculateHealth(account: RuntimeAccount): number {
  const total = account.successCount + account.failureCount;
  if (total === 0) return 100;
  const successRate = account.successCount / total;
  const averageLatency = account.successCount > 0 ? account.latencyTotal / account.successCount : 0;
  const latencyPenalty = Math.min(20, averageLatency / 500);
  const failurePenalty = Math.min(30, account.consecutiveFailures * 8);
  return Math.max(0, Math.min(100, successRate * 100 - latencyPenalty - failurePenalty));
}

export function applyProviderFeedback(scopeKey: string, feedback: ProviderFeedback): void {
  const pool = pools.get(scopeKey);
  const account = pool?.accounts.get(feedback.profileId);
  if (!pool || !account) return;
  const feedbackId = toStringValue(feedback.feedbackId).trim();
  if (feedbackId && pool.processedFeedbackIds.has(feedbackId)) return;
  if (feedbackId) {
    pool.processedFeedbackIds.add(feedbackId);
    if (pool.processedFeedbackIds.size > 500) {
      const oldest = pool.processedFeedbackIds.values().next().value;
      if (oldest) pool.processedFeedbackIds.delete(oldest);
    }
  }
  pool.lastTouchedAt = Date.now();
  const result = feedback.result.toUpperCase();
  const recommendation = toStringValue(feedback.recommendation).toUpperCase();
  account.activeRequests = Math.max(0, account.activeRequests - 1);
  account.lock = undefined;
  if (result === 'SUCCESS') {
    account.successCount += 1;
    account.consecutiveFailures = 0;
    account.retryCount = 0;
    account.latencyTotal += Math.max(0, feedback.latencyMs ?? 0);
    account.state = 'AVAILABLE';
  } else {
    account.failureCount += 1;
    account.consecutiveFailures += 1;
    account.retryCount = Math.max(account.retryCount + 1, feedback.retryCount ?? 0);
    if (recommendation === 'DISABLE') account.state = 'DISABLED';
    else {
      const seconds = Math.max(1, feedback.cooldownSeconds ?? (feedback.httpStatus === 429 ? 60 : 15));
      account.state = 'COOLDOWN';
      account.cooldownUntil = Date.now() + seconds * 1000;
    }
  }
  account.healthScore = calculateHealth(account);
}

export function reserveRecipient(scopeKey: string, email: string): boolean {
  const key = email.trim().toLowerCase();
  const set = usedRecipients.get(scopeKey) ?? new Set<string>();
  if (set.has(key)) return false;
  set.add(key);
  usedRecipients.set(scopeKey, set);
  return true;
}

export function publicPoolSnapshot(scopeKey: string): IDataObject[] {
  const pool = pools.get(scopeKey);
  if (!pool) return [];
  return [...pool.accounts.values()].map((account) => ({
    id: toStringValue(account.profile.id),
    state: account.state,
    healthScore: Math.round(account.healthScore * 100) / 100,
    retryCount: account.retryCount,
    activeRequests: account.activeRequests,
    cooldownUntil: account.cooldownUntil ? new Date(account.cooldownUntil).toISOString() : null,
    lock: account.lock
      ? {
          workflowId: account.lock.workflowId,
          executionId: account.lock.executionId,
          workerId: account.lock.workerId,
          lockedAt: new Date(account.lock.lockedAt).toISOString(),
        }
      : null,
  }));
}

export function readPersistedFeedback(context: IExecuteFunctions): IDataObject[] {
  try {
    const data = context.getWorkflowStaticData?.('global');
    const value = data?.invoiceRouterFeedback;
    return Array.isArray(value) ? value.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function persistFeedback(context: IExecuteFunctions, feedback: IDataObject): void {
  try {
    const data = context.getWorkflowStaticData?.('global');
    if (!data) return;
    const previous = Array.isArray(data.invoiceRouterFeedback) ? data.invoiceRouterFeedback.filter(isRecord) : [];
    data.invoiceRouterFeedback = [...previous.slice(-199), feedback];
  } catch {
    // Workflow static data is best-effort. Runtime state remains active in the current process.
  }
}
