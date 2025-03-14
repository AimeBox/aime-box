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

export class PlanningAgent extends BaseAgent {
  name: string = 'planning';

  description: string =
    'An agent that creates and manages plans to solve tasks';

  tags: string[] = ['work'];

  system_prompt: string = `
  您是一位规划专家，负责通过创建和管理结构化计划来解决复杂问题。
Your job is:
1. 你将设计一系列步骤来完成任务。
2. 我将提供多个工具帮助你完成任务。
3. 请使用简洁的语言描述你的计划。
<tool>
ScriptAssistant : 创建一个python脚本来完成任务
Shell : 使用windows的cmd命令来执行任务
FileSystem: 可以对文件的读取、写入、删除, 读取文件夹等等操作
</tool>

将任务分解成合乎逻辑的、顺序的步骤。考虑依赖关系和验证方法。`;

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  llm: BaseChatModel;

  embedding: Embeddings;

  configSchema: FormSchema[] = [
    {
      label: t('model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
    {
      label: t('system_prompt'),
      field: 'system_prompt',
      component: 'InputTextArea',
    },
  ];

  config: any = {
    model: '',
    system_prompt: this.system_prompt,
  };

  constructor(options: {
    provider: string;
    model: string;
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
    const msgs = [
      new SystemMessage(this.config.system_prompt),
      new HumanMessage(input),
    ];
    async function* generateStream() {
      const response = await that.llm
        .withStructuredOutput(
          z.object({
            schemas: z.array(
              z.object({
                title: z.string(),
                steps: z.array(z.string()),
                tools: z.array(z.string()),
              }),
            ),
          }),
        )
        .invoke(msgs);
      yield JSON.stringify(response, null, 2);
    }
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
