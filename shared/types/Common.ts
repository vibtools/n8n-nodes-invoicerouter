import type { IDataObject } from './N8n';

export interface ProviderConfig extends IDataObject {
  id: string;
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  priority?: number;
  weight?: number;
  createEndpoint?: string;
  sendEndpoint?: string;
  statusEndpoint?: string;
}

export interface UniversalInvoice extends IDataObject {
  requestId: string;
  provider: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  dueDate?: string;
  description?: string;
  sendEmail: boolean;
  lineItems: IDataObject[];
  metadata: IDataObject;
}

export interface StandardInvoiceResponse extends IDataObject {
  success: boolean;
  provider: string;
  operation?: string;
  status: string;
  message: string;
  invoiceId?: string;
  invoiceUrl?: string;
  pdfUrl?: string;
  requestId?: string;
  createdAt?: string;
  sentAt?: string;
  rawResponse?: IDataObject;
}
