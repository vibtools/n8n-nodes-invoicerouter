import type { UniversalInvoice } from '../../shared/types/Common';
import type { IDataObject } from '../../shared/types/N8n';

export function buildProviderPayload(invoice: UniversalInvoice): IDataObject {
  return { ...invoice };
}
