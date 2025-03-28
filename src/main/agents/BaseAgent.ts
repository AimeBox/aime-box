import { ChatOptions } from '@/entity/Chat';
import { FormSchema } from '@/types/form';
import { Tool } from '@langchain/core/tools';
import { z, ZodObject } from 'zod';
import { dbManager } from '../db';
import { Agent } from '@/entity/Agent';
import { removeEmptyValues } from '../utils/common';

export abstract class BaseAgent extends Tool {
  abstract name: string;

  abstract description: string;

  abstract tags: string[];

  declare schema;
  // declare schema: z.ZodEffects<
  //   z.ZodObject<
  //     {
  //       input: z.ZodOptional<z.ZodString>;
  //     },
  //     'strip',
  //     z.ZodTypeAny,
  //     {
  //       input?: string | undefined;
  //     },
  //     {
  //       input?: string | undefined;
  //     }
  //   >,
  //   string | undefined,
  //   {
  //     input?: string | undefined;
  //   }
  // >;

  agentOptions?: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  };

  configSchema: FormSchema[];

  config: any;

  abstract hidden: boolean;

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super();
    this.agentOptions = options;
  }

  async getConfig(): Promise<any> {
    const agentRepository = dbManager.dataSource.getRepository(Agent);
    const agent = await agentRepository.findOne({
      where: {
        id: this.name.toLowerCase(),
      },
    });

    let config = { ...(this.config || {}), ...(agent?.config || {}) };
    config = removeEmptyValues(config);
    return { ...(this.config || {}), ...config };
  }

  abstract createAgent(): Promise<any>;

  // abstract invoke(input: z.infer<typeof this.schema> | string): Promise<any>;
}
