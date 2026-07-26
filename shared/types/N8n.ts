export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | IDataObject | JsonValue[];

export interface IDataObject {
  [key: string]: JsonValue | undefined;
}

export interface INodeExecutionData {
  json: IDataObject;
  pairedItem?: { item: number };
}

export interface INodePropertyOption {
  name: string;
  value: string;
}

export interface INodeProperty {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'json';
  default: JsonValue;
  description?: string;
  placeholder?: string;
  options?: INodePropertyOption[];
}

export interface INodeTypeDescription {
  displayName: string;
  name: string;
  group: string[];
  version: number;
  description: string;
  defaults: { name: string };
  inputs: string[];
  outputs: string[];
  properties: INodeProperty[];
}

export interface IExecuteFunctions {
  getInputData(): INodeExecutionData[];
  getNodeParameter(name: string, itemIndex: number, fallbackValue?: unknown): unknown;
}

export interface INodeType {
  description: INodeTypeDescription;
  execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
