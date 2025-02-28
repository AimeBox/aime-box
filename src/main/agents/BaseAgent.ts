import { ChatOptions } from '@/entity/Chat';
import { FormSchema } from '@/types/form';
import { Tool } from '@langchain/core/tools';
import { z, ZodObject } from 'zod';

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
    model: string;
    options: ChatOptions;
  }) {
    super();
    this.agentOptions = options;
  }

  // abstract invoke(input: z.infer<typeof this.schema> | string): Promise<any>;
}
