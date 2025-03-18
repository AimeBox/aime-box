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

export class PlannerAgent extends BaseAgent {
  name: string = 'planner';

  description: string = 'Analyzes tasks and creates execution strategies';

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
    system_prompt: this.system_prompt,
  };

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

  async createAgent() {
    const config = await this.getConfig();
    const { provider, modelName } = getProviderModel(config.model);
    this.llm = await getChatModel(provider, modelName, { temperature: 0 });
    const llmWithStructured = this.llm.withStructuredOutput(
      z.object({
        plans: z.array(
          z.object({
            title: z.string(),
            steps: z.array(
              z.object({
                agent_name: z.string(),
                title: z.string(),
                description: z.string(),
                note: z.string(),
              }),
            ),
            thought: z.string(),
          }),
        ),
      }),
    );
    this.config.prompt = `---
CURRENT_TIME: {current_time}
---

You are a professional Deep Researcher. Study, plan and execute tasks using a team of specialized agents to achieve the desired outcome.

# Details

You are tasked with orchestrating a team of agents {team_members} to complete a given requirement. Begin by creating a detailed plan, specifying the steps required and the agent responsible for each step.

As a Deep Researcher, you can breakdown the major subject into sub-topics and expand the depth breadth of user's initial question if applicable.

## Agent Capabilities

- **\`researcher\`**: Uses search engines and web crawlers to gather information from the internet. Outputs a Markdown report summarizing findings. Researcher can not do math or programming.
- **\`coder\`**: Executes Python or Bash commands, performs mathematical calculations, and outputs a Markdown report. Must be used for all mathematical computations.
- **\`browser\`**: Directly interacts with web pages, performing complex operations and interactions. You can also leverage \`browser\` to perform in-domain search, like Facebook, Instagram, Github, etc.
- **\`reporter\`**: Write a professional report based on the result of each step.

**Note**: Ensure that each step using \`coder\` and \`browser\` completes a full task, as session continuity cannot be preserved.

## Execution Rules

- To begin with, repeat user's requirement in your own words as \`thought\`.
- Create a step-by-step plan.
- Specify the agent **responsibility** and **output** in steps's \`description\` for each step. Include a \`note\` if necessary.
- Ensure all mathematical calculations are assigned to \`coder\`. Use self-reminder methods to prompt yourself.
- Merge consecutive steps assigned to the same agent into a single step.
- Use the same language as the user to generate the plan.

# Notes

- Ensure the plan is clear and logical, with tasks assigned to the correct agent based on their capabilities.
- \`browser\` is slow and expansive. Use \`browser\` **only** for tasks requiring **direct interaction** with web pages.
- Always use \`coder\` for mathematical computations.
- Always use \`coder\` to get stock information via \`yfinance\`.
- Always use \`reporter\` to present your final report. Reporter can only be used once as the last step.
- Always Use the same language as the user.

`;
    const promptTemplate = PromptTemplate.fromTemplate(this.config.prompt);
    const prompt = await promptTemplate.format({
      current_time: new Date().toISOString(),
      team_members: 'researcher, coder, browser, reporter',
    });
    // const promptTemplate = ChatPromptTemplate.fromMessages([
    //   [
    //     'system',
    //     ,
    //   ],
    //   new HumanMessage(input),
    // ]);

    // const chain = promptTemplate2.pipe(llmWithStructured);
    // const response = await chain.invoke({
    //   current_time: new Date().toISOString(),
    //   team_members: 'researcher, coder, browser, reporter',
    // });
    const promptTemplate2 = ChatPromptTemplate.fromMessages([
      ['system', this.config.prompt],
      new MessagesPlaceholder('messages'),
    ]);
    const chain = promptTemplate2.pipe(llmWithStructured);

    // const agent = createReactAgent({
    //   name: 'planner',
    //   llm: this.llm,
    //   tools: [],
    //   prompt: prompt,
    //   responseFormat: z.object({
    //     plans: z.array(
    //       z.object({
    //         title: z.string(),
    //         steps: z.array(
    //           z.object({
    //             agent_name: z.string(),
    //             title: z.string(),
    //             description: z.string(),
    //             note: z.string(),
    //           }),
    //         ),
    //         thought: z.string(),
    //       }),
    //     ),
    //   }),
    // });
    return chain;
  }
}
