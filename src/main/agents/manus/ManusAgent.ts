import { RunnableConfig } from '@langchain/core/runnables';

import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ChatOptions } from '@/entity/Chat';
import { BaseAgent } from '../BaseAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { z } from 'zod';
import { ToolsManager } from '../../tools/index';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { getProviderModel } from '@/main/utils/providerUtil';
import settingsManager from '@/main/settings';
import { getChatModel } from '@/main/llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MessagesAnnotation } from '@langchain/langgraph/dist/graph/messages_annotation';
import { Command, StateGraph } from '@langchain/langgraph';

export class ManusAgent extends BaseAgent {
  name: string = 'manus';

  description: string =
    'aime-manus, a friendly AI assistant developed by the Langmanus team. You specialize in handling greetings and small talk, while handing off complex tasks to a specialized planner';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  llm: BaseChatModel;

  configSchema: FormSchema[] = [
    {
      label: t('model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
  ];

  config: any = {};

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
  }

  async _call(
    input: z.infer<typeof this.schema> | string,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output;
  }

  async stream(
    input: z.infer<typeof this.schema> | string,
    options?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    const { provider, modelName } =
      getProviderModel(this.config.model) ??
      getProviderModel(settingsManager.getSettings().defaultLLM);
    this.llm = await getChatModel(provider, modelName, { temperature: 0 });
    const that = this;

    async function* generateStream() {}
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }

  async createAgent() {
    const config = await this.getConfig();
    const { provider, modelName } = getProviderModel(config.model);
    this.llm = await getChatModel(provider, modelName, { temperature: 0 });

    function plannerNode({ messages }: typeof MessagesAnnotation.State) {
      //return Command.from(this.llm.invoke(messages));
    }

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode('planner', plannerNode)
      .addEdge('__start__', 'planner') // __start__ is a special name for the entrypoint
      .addNode('extract', extractNode)
      .addConditionalEdges('check', shouldExtract);

    // Finally, we compile it into a LangChain Runnable.
    const app = workflow.compile();
    return app;
  }
}
