import type { IExecuteFunctions, INodeExecutionData } from '../../shared/types/N8n';
import { isRecord, toFiniteNumber, toStringValue } from '../../shared/utils/Helpers';

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  return [
    items.map((item, itemIndex) => {
      const emailField = String(this.getNodeParameter('customerEmailField', itemIndex, 'email'));
      const amountField = String(this.getNodeParameter('amountField', itemIndex, 'amount'));
      const currency = String(this.getNodeParameter('currency', itemIndex, 'USD'));
      const invoice = {
        customerEmail: toStringValue(item.json[emailField]),
        amount: toFiniteNumber(item.json[amountField]),
        currency,
        lineItems: Array.isArray(item.json.lineItems) ? item.json.lineItems.filter(isRecord) : [],
      };
      return { json: { ...item.json, invoice }, pairedItem: { item: itemIndex } };
    }),
  ];
}
