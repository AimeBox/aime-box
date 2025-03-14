import { StructuredTool } from '@langchain/core/tools';
import { FormSchema } from '@/types/form';

export abstract class BaseTool extends StructuredTool {
  static lc_name() {
    return this.name;
  }

  toolKitName?: string;

  output?: string;

  outputFormat?: 'json' | 'markdown' = 'markdown';

  configSchema?: FormSchema[] = [];
}
