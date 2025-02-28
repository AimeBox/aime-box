import { StructuredTool } from '@langchain/core/tools';
import { FormSchema } from '@/types/form';

export abstract class BaseTool extends StructuredTool {
  output?: string;

  configSchema?: FormSchema[] = [];
}
