import type { IDataObject, JsonValue } from '../types/N8n';

export function isRecord(value: unknown): value is IDataObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toFiniteNumber(value: JsonValue | undefined, fallback = 0): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function toStringValue(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}
