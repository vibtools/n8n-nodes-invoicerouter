import type { ProviderConfig, StandardInvoiceResponse, UniversalInvoice } from '../types/Common';
import type { IDataObject } from '../types/N8n';

export interface PreparedProviderRequest {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  body: IDataObject;
}

export abstract class BaseProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;

  abstract validateConfig(config: ProviderConfig): string[];
  abstract prepareInvoiceRequest(invoice: UniversalInvoice, config: ProviderConfig): PreparedProviderRequest;
  abstract parseInvoiceResponse(response: unknown): StandardInvoiceResponse;
}
