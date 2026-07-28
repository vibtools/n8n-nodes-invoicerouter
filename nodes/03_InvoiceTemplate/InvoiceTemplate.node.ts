import type { IExecuteFunctions, INodeExecutionData, INodeType } from '../../shared/types/N8n';
import { description } from './InvoiceTemplate.description';
import { execute } from './InvoiceTemplate.execute';
export class InvoiceTemplate implements INodeType {
  description = description;
  execute = execute as (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
}
