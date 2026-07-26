import type { IDataObject, IExecuteFunctions, INodeExecutionData, JsonValue } from '../../shared/types/N8n';
import { toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';
import { parseArray, parseObject } from '../../shared/utils/JsonPath';

function parameter(context: IExecuteFunctions, name: string, itemIndex: number, fallback: string): string {
  return String(context.getNodeParameter(name, itemIndex, fallback));
}

function read(item: IDataObject, field: string): JsonValue | undefined {
  return item[field];
}

function toBoolean(value: JsonValue | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'send'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0', ''].includes(normalized)) return false;
  }
  return fallback;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();

  return [
    items.map((item, itemIndex) => {
      const requestIdField = parameter(this, 'requestIdField', itemIndex, 'request_id');
      const providerField = parameter(this, 'providerField', itemIndex, 'provider');
      const customerNameField = parameter(this, 'customerNameField', itemIndex, 'customer_name');
      const customerEmailField = parameter(this, 'customerEmailField', itemIndex, 'customer_email');
      const amountField = parameter(this, 'amountField', itemIndex, 'amount');
      const currencyField = parameter(this, 'currencyField', itemIndex, 'currency');
      const defaultCurrency = parameter(this, 'defaultCurrency', itemIndex, 'USD').toUpperCase();
      const dueDateField = parameter(this, 'dueDateField', itemIndex, 'due_date');
      const descriptionField = parameter(this, 'descriptionField', itemIndex, 'description');
      const lineItemsField = parameter(this, 'lineItemsField', itemIndex, 'line_items_json');
      const metadataField = parameter(this, 'metadataField', itemIndex, 'metadata_json');
      const sendEmailField = parameter(this, 'sendEmailField', itemIndex, 'send_email');
      const strictValidation = Boolean(this.getNodeParameter('strictValidation', itemIndex, true));

      const requestId = toStringValue(read(item.json, requestIdField), `item-${itemIndex + 1}`).trim();
      const provider = toStringValue(read(item.json, providerField), 'custom').trim().toLowerCase();
      const customerName = toStringValue(read(item.json, customerNameField)).trim();
      const customerEmail = toStringValue(read(item.json, customerEmailField)).trim();
      const amount = toFiniteNumber(read(item.json, amountField));
      const currency = toStringValue(read(item.json, currencyField), defaultCurrency).trim().toUpperCase();
      const dueDate = toStringValue(read(item.json, dueDateField)).trim();
      const description = toStringValue(read(item.json, descriptionField), 'Invoice').trim();
      const sendEmail = toBoolean(read(item.json, sendEmailField), true);

      let lineItems = parseArray(read(item.json, lineItemsField), 'Line Items');
      if (lineItems.length === 0 && amount > 0) {
        lineItems = [{ description, quantity: 1, unitPrice: amount, amount }];
      }
      const metadata = parseObject(read(item.json, metadataField), 'Metadata');

      if (strictValidation) {
        if (!requestId) throw new Error(`Item ${itemIndex}: request ID is required.`);
        if (!customerEmail || !validEmail(customerEmail)) {
          throw new Error(`Item ${itemIndex}: customer email is invalid.`);
        }
        if (!(amount > 0)) throw new Error(`Item ${itemIndex}: amount must be greater than zero.`);
        if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Item ${itemIndex}: currency must be a 3-letter ISO code.`);
      }

      const invoice: IDataObject = {
        requestId,
        provider,
        customerName,
        customerEmail,
        amount,
        currency,
        dueDate: dueDate || undefined,
        description,
        sendEmail,
        lineItems,
        metadata,
      };

      return {
        json: { ...item.json, invoice },
        pairedItem: { item: itemIndex },
      };
    }),
  ];
}
