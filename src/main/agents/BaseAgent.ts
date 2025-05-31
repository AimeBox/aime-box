import { ChatOptions } from '@/entity/Chat';
import { FormSchema } from '@/types/form';
import { Tool } from '@langchain/core/tools';
import { z, ZodObject } from 'zod';
import { dbManager } from '../db';
import { Agent } from '@/entity/Agent';
import { removeEmptyValues } from '../utils/common';
import { BaseStore, Annotation } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';


export interface AgentMessageEvent {
  created?: (msg: BaseMessage[]) => Promise<void>;
  updated?: (msg: BaseMessage[]) => Promise<void>;
  finished?: (msg: BaseMessage[]) => Promise<void>;
  deleted?: (msg: BaseMessage[]) => Promise<void>;
}

export const BaseAnnotation = {
  waitHumanAsk: Annotation<boolean>,
};





export abstract class BaseAgent extends Tool {
  abstract name: string;

  abstract description: string;

  abstract tags: string[];

  declare schema;

  declare opener?: string;

  declare fixedThreadId?: boolean;

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

  abstract createAgent(params: {
    store?: BaseStore;
    model?: BaseChatModel;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    configurable?: Record<string, any>;
  }): Promise<any>;

  // abstract invoke(input: z.infer<typeof this.schema> | string): Promise<any>;
}
