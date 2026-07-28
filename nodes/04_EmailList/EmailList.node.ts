import type { IExecuteFunctions, INodeExecutionData, INodeType } from '../../shared/types/N8n';
import { description } from './EmailList.description';
import { execute } from './EmailList.execute';
export class EmailList implements INodeType {
  description = description;
  execute = execute as (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
}
