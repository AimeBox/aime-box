import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { z } from 'zod';
import { kbManager } from '../knowledgebase';
import { dbManager } from '../db';
import { Repository } from 'typeorm';
import { KnowledgeBase } from '@/entity/KnowledgeBase';

export interface KnowledgeBaseParameters extends ToolParams {
  //providerId: string;
}

export class KnowledgeBaseSave extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_save';

  description: string = 'Save knowledge base item';

  schema = z.object({
    kbNameOrId: z.string(),
    content: z.string(),
  });

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
export class KnowledgeBaseUpdate extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_update';

  description: string = 'Update knowledge base item';

  schema = z.object({
    kbNameOrId: z.string(),
    kbItemId: z.string(),
    content: z.string(),
  });

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseDelete extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_delete';

  description: string = 'Delete knowledge base';

  schema = z.object({
    kbNameOrId: z.string(),
    kbItemId: z.string(),
  });

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseQuery extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_query';

  description: string = 'Query knowledge base';

  schema = z.object({
    kbNameOrId: z.string(),
    query: z.string(),
  });

  protected _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    throw new Error('Method not implemented.');
  }
}

export class KnowledgeBaseList extends BaseTool {
  toolKitName: string = 'knowledge_base_toolkit';

  name: string = 'knowledge_base_list';

  description: string = 'List All Knowledge Bases';

  schema = z.object({});

  kbRepository: Repository<KnowledgeBase>;

  constructor(params?: KnowledgeBaseParameters) {
    super(params);
    this.kbRepository = dbManager.dataSource.getRepository(KnowledgeBase);
  }

  async _call(
    arg: any,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const kbs = await this.kbRepository.find();
    const res = kbs.map((x) => ({
      id: x.id,
      name: x.name,
      description: x.description,
    }));
    return JSON.stringify(res, null, 2);
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
