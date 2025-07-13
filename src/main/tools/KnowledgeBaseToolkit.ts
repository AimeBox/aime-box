import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { z } from 'zod';

export interface KnowledgeBaseParameters extends ToolParams {
  //providerId: string;
}

export class KnowledgeBaseSave extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_save';

  description: string = 'Save knowledge base';

  schema = z.object({
    name: z.string(),
    description: z.string(),
    content: z.string(),
  });

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseQuery extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_query';

  description: string = 'Query knowledge base';

  schema = z.object({
    name: z.string(),
  });

  protected _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseList extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_list';

  description: string = 'List knowledge base';

  schema = z.object({});

  protected _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseToolkit extends BaseToolKit {
  name: string = 'knowledge_base_toolkit';

  configSchema: FormSchema[] = [];

  constructor(params?: KnowledgeBaseParameters) {
    super(params);
    //this.apiKey = params?.apiKey;
  }

  getTools(): BaseTool[] {
    return [
      new KnowledgeBaseSave(this.params),
      new KnowledgeBaseList(this.params),
      new KnowledgeBaseQuery(this.params),
    ];
  }
}
