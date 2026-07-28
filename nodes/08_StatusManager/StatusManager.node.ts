import type { IExecuteFunctions, INodeExecutionData, INodeType } from '../../shared/types/N8n';
import { description } from './StatusManager.description';
import { execute } from './StatusManager.execute';
export class StatusManager implements INodeType {
  description = description;
  execute = execute as (this: IExecuteFunctions) => Promise<INodeExecutionData[][]>;
}
