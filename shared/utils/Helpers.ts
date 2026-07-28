import type { IDataObject, JsonValue } from '../types/N8n';

export function isRecord(value: unknown): value is IDataObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toStringValue(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value : String(value);
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = toStringValue(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'enabled', 'on'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'disabled', 'off', ''].includes(normalized)) return false;
  return fallback;
}

export function slug(value: unknown): string {
  return toStringValue(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizedKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseJsonObject(value: unknown, label: string): IDataObject {
  if (isRecord(value)) return value;
  const text = toStringValue(value, '{}').trim() || '{}';
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error('must be an object');
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} JSON is invalid: ${message}`);
  }
}

export function parseJsonArray(value: unknown, label: string): JsonValue[] {
  if (Array.isArray(value)) return value as JsonValue[];
  const text = toStringValue(value, '[]').trim() || '[]';
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('must be an array');
    return parsed as JsonValue[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} JSON is invalid: ${message}`);
  }
}

export function getByPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let current: unknown = value;
  for (const part of path.split('.').filter(Boolean)) {
    if (Array.isArray(current) && /^\d+$/.test(part)) current = current[Number(part)];
    else if (isRecord(current)) current = current[part];
    else return undefined;
  }
  return current;
}

export function setIfDefined(target: IDataObject, key: string, value: JsonValue | undefined): void {
  if (value !== undefined && value !== '') target[key] = value;
}

export function nowIso(): string {
  return new Date().toISOString();
}
