import type { UniversalInvoice } from '../types/Common';

export function validateInvoice(invoice: UniversalInvoice): string[] {
  const errors: string[] = [];
  if (!invoice.customerEmail) errors.push('customerEmail is required');
  if (!Number.isFinite(invoice.amount) || invoice.amount < 0) errors.push('amount must be non-negative');
  if (!invoice.currency) errors.push('currency is required');
  return errors;
}
