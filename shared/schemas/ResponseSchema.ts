import type { StandardInvoiceResponse } from '../types/Common';

export function isStandardInvoiceResponse(value: unknown): value is StandardInvoiceResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.success === 'boolean' &&
    typeof record.provider === 'string' &&
    typeof record.status === 'string' &&
    typeof record.message === 'string'
  );
}
