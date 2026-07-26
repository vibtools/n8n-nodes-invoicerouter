import type { IDataObject } from './N8n';

export interface ProviderConfig extends IDataObject {
  id: string;
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  priority?: number;
  weight?: number;
}

export interface UniversalInvoice extends IDataObject {
  customerEmail: string;
  amount: number;
  currency: string;
  lineItems: IDataObject[];
}

export interface StandardInvoiceResponse extends IDataObject {
  success: boolean;
  provider: string;
  status: string;
  message: string;
  invoiceId?: string;
  invoiceUrl?: string;
}
