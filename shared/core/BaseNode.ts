import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from '../types/N8n';

export abstract class BaseNode implements INodeType {
  abstract description: INodeTypeDescription;
  abstract execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
