import type { StandardInvoiceResponse } from '../../shared/types/Common';
import { PROVIDER_ID } from './ProviderConstants';

export function parseProviderResponse(response: unknown): StandardInvoiceResponse {
  const record = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
  return {
    success: record.success === true,
    provider: PROVIDER_ID,
    status: typeof record.status === 'string' ? record.status : 'unknown',
    message: typeof record.message === 'string' ? record.message : 'Provider response parsed.',
    invoiceId: typeof record.invoiceId === 'string' ? record.invoiceId : undefined,
    invoiceUrl: typeof record.invoiceUrl === 'string' ? record.invoiceUrl : undefined,
  };
}
