import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { isRecord, nowIso, parseJsonArray, parseJsonObject, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

function manualTemplate(context: IExecuteFunctions, itemIndex: number): IDataObject {
  return {
    invoiceId: toStringValue(context.getNodeParameter('invoiceId', itemIndex, '#INV#')),
    invoiceNumber: toStringValue(context.getNodeParameter('invoiceNumber', itemIndex, 'INV-#INV#')),
    invoiceDate: toStringValue(context.getNodeParameter('invoiceDate', itemIndex, new Date().toISOString().slice(0, 10))),
    dueDate: toStringValue(context.getNodeParameter('dueDate', itemIndex, '')),
    currency: toStringValue(context.getNodeParameter('currency', itemIndex, 'USD')).toUpperCase(),
    lineItems: parseJsonArray(context.getNodeParameter('lineItemsJson', itemIndex, '[]'), 'Line Items'),
    tax: toFiniteNumber(context.getNodeParameter('tax', itemIndex, 0)),
    discount: toFiniteNumber(context.getNodeParameter('discount', itemIndex, 0)),
    shipping: toFiniteNumber(context.getNodeParameter('shipping', itemIndex, 0)),
    paymentTerms: toStringValue(context.getNodeParameter('paymentTerms', itemIndex, 'Due on receipt')),
    notes: toStringValue(context.getNodeParameter('notes', itemIndex, '')),
    customFields: parseJsonObject(context.getNodeParameter('customFieldsJson', itemIndex, '{}'), 'Custom Fields'),
  };
}

function normalizeItems(value: unknown, strict: boolean): IDataObject[] {
  const source = Array.isArray(value) ? value : [];
  const output: IDataObject[] = [];
  source.forEach((entry, index) => {
    if (!isRecord(entry)) {
      if (strict) throw new Error(`Line item ${index + 1} must be an object.`);
      return;
    }
    const name = toStringValue(entry.name ?? entry.item_name ?? entry.description, `Item ${index + 1}`);
    const description = toStringValue(entry.description ?? entry.item_description);
    const quantity = toFiniteNumber(entry.quantity, 1);
    const unitPrice = toFiniteNumber(entry.unitPrice ?? entry.unit_price ?? entry.price ?? entry.amount, 0);
    if (!(quantity > 0)) throw new Error(`Line item ${index + 1} quantity must be greater than zero.`);
    if (!Number.isFinite(unitPrice)) throw new Error(`Line item ${index + 1} unit price is invalid.`);
    output.push({ name, description, quantity, unitPrice, lineTotal: Math.round(quantity * unitPrice * 100) / 100 });
  });
  if (strict && output.length === 0) throw new Error('At least one valid line item is required.');
  return output;
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const input = this.getInputData();
  const items = input.length > 0 ? input : [{ json: {} }];
  const output: INodeExecutionData[] = [];
  items.forEach((item, itemIndex) => {
    const mode = toStringValue(this.getNodeParameter('templateMode', itemIndex, 'manual'));
    const strict = Boolean(this.getNodeParameter('strictValidation', itemIndex, true));
    const field = toStringValue(this.getNodeParameter('inputTemplateField', itemIndex, 'invoice_template'));
    const inputTemplate = isRecord(item.json[field]) ? item.json[field] as IDataObject : isRecord(item.json.invoiceTemplate) ? item.json.invoiceTemplate as IDataObject : {};
    const manual = manualTemplate(this, itemIndex);
    const source: IDataObject = mode === 'input' ? inputTemplate : mode === 'merge' ? { ...manual, ...inputTemplate } : manual;
    const lineItems = normalizeItems(source.lineItems, strict);
    const subtotal = Math.round(lineItems.reduce((sum, line) => sum + toFiniteNumber(line.lineTotal), 0) * 100) / 100;
    const tax = toFiniteNumber(source.tax ?? (isRecord(source.totals) ? source.totals.tax : 0), 0);
    const discount = toFiniteNumber(source.discount ?? (isRecord(source.totals) ? source.totals.discount : 0), 0);
    const shipping = toFiniteNumber(source.shipping ?? (isRecord(source.totals) ? source.totals.shippingCharge : 0), 0);
    const grandTotal = Math.round((subtotal + tax + shipping - discount) * 100) / 100;
    const currency = toStringValue(source.currency, 'USD').toUpperCase();
    if (strict && !/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter code such as USD.');
    const customFields = isRecord(source.customFields) ? source.customFields : {};
    const template: IDataObject = {
      schemaVersion: '1.0',
      invoiceId: toStringValue(source.invoiceId, '#INV#'),
      invoiceNumber: toStringValue(source.invoiceNumber, 'INV-#INV#'),
      transactionId: toStringValue(source.transactionId, '#TRX#'),
      randomCode: toStringValue(source.randomCode, '#RANDOM#'),
      invoiceDate: toStringValue(source.invoiceDate, new Date().toISOString().slice(0, 10)),
      dueDate: toStringValue(source.dueDate),
      currency,
      lineItems,
      totals: { subtotal, tax, discount, shippingCharge: shipping, grandTotal },
      payment: { terms: toStringValue(source.paymentTerms ?? (isRecord(source.payment) ? source.payment.terms : 'Due on receipt')), notes: toStringValue(source.notes ?? (isRecord(source.payment) ? source.payment.notes : '')) },
      notes: toStringValue(source.notes),
      customFields,
      fieldSchema: [
        { key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true, system: true },
        { key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true, system: true },
        { key: 'due_date', label: 'Due Date', type: 'date', required: false, system: true },
        { key: 'currency', label: 'Currency', type: 'currency', required: true, system: true },
        { key: 'line_items', label: 'Line Items', type: 'collection', required: true, system: true },
      ] as unknown as JsonValue,
      dynamicTags: ['#INV#', '#TRX#', '#RANDOM#', '#EMAIL#', '#NAME#', '#PROVIDER#', '#ACCOUNT#'],
      generatedAt: nowIso(),
    };
    output.push({ json: { ...item.json, invoiceTemplate: template }, pairedItem: { item: itemIndex } });
  });
  return [output];
}
