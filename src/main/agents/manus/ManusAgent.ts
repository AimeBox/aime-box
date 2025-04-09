import { RunnableConfig } from '@langchain/core/runnables';

import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ChatOptions } from '@/entity/Chat';
import { BaseAgent } from '../BaseAgent';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { z } from 'zod';
import { toolsManager, ToolsManager } from '../../tools/index';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { getProviderModel } from '@/main/utils/providerUtil';
import settingsManager from '@/main/settings';
import { getChatModel } from '@/main/llm';

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MessagesAnnotation } from '@langchain/langgraph/dist/graph/messages_annotation';
import {
  Annotation,
  BaseStore,
  Command,
  CompiledStateGraph,
  InMemoryStore,
  StateGraph,
} from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { dbManager } from '@/main/db';
import { PlannerPrompt, ReporterPrompt, ResearcherPrompt } from './prompt';
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch';

export type PlanStep = {
  id: string;
  agent: string;
  description: string;
  note: string;
  status: 'not_started' | 'in_progress' | 'done' | 'failed' | 'skip';
};

export type Plans = {
  title: string;
  steps: PlanStep[];
};

export class ManusAgent extends BaseAgent {
  name: string = 'aime-manus';

  description: string =
    'aime-manus, a friendly AI assistant developed by the Langmanus team. You specialize in handling greetings and small talk, while handing off complex tasks to a specialized planner';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  model: BaseChatModel;

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
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
    const { provider, modelName } = getProviderModel(this.config.model);
    this.model = await getChatModel(provider, modelName, { temperature: 0 });
    const that = this;

    async function* generateStream() {}
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }

  browserAgent = async (store: BaseStore) => {
    const tools = await toolsManager.buildTools(['browser_use', 'terminate']);
    return createReactAgent({
      llm: this.model,
      tools: tools,
      name: 'browser',
      store: new InMemoryStore(),
      prompt: 'A browser agent that can control a browser to accomplish tasks',
    });
  };

  coderAgent = async (store: BaseStore) => {
    const tools = await toolsManager.buildTools([
      'python_interpreter',
      'terminate',
      'list_directory',
      'search_files',
      'move_file',
      'read_file',
      'write_file',
      'create_directory',
    ]);
    return createReactAgent({
      llm: this.model,
      tools: tools,
      name: 'coder',
      store: new InMemoryStore(),
      prompt:
        'You are a ai coder, you can use the tools to help you complete the task.',
    });
  };

  reporterAgent = async (store: BaseStore) => {
    const tools = await toolsManager.buildTools([
      'python_interpreter',
      'terminate',
    ]);
    return createReactAgent({
      llm: this.model,
      tools: tools,
      name: 'reporter',
      store: new InMemoryStore(),
      prompt: ReporterPrompt,
    });
  };

  researcherAgent = async (store: BaseStore) => {
    const tools = await toolsManager.buildTools([
      'web_search',
      'web_loader',
      'terminate',
      'write_file',
    ]);

    return createReactAgent({
      llm: this.model,
      tools: tools,
      name: 'researcher',
      store: new InMemoryStore(),
      prompt: ResearcherPrompt,
    });
  };

  async createAgent(store?: BaseStore, model?: BaseChatModel) {
    const StateAnnotation = Annotation.Root({
      task: Annotation<string>,
      plans: Annotation<Plans[]>,
      current_step: Annotation<PlanStep>,
      memory: Annotation<string>,
      messages: Annotation<BaseMessage[]>,
    });

    const config = await this.getConfig();
    const { provider, modelName } = getProviderModel(config.model);
    this.model =
      model || (await getChatModel(provider, modelName, { temperature: 0 }));
    const that = this;
    const agentMap = {
      browser: {
        agent: this.browserAgent,
        description:
          '你是一个 ai browser, 你可以使用browser_use工具来帮助用户自动化操作浏览器',
      },
      coder: {
        agent: this.coderAgent,
        description:
          '你是一个 ai coder, 你可以使用python_interpreter,或命令行工具来帮助编写代码或执行命令',
      },
      reporter: {
        agent: this.reporterAgent,
        description:
          '你是一个 ai reporter, 你可以使用python_interpreter工具来帮助用户生成报告',
      },
      researcher: {
        agent: this.researcherAgent,
        description:
          '你是一个 ai researcher, 你可以使用web_search和web_loader工具来帮助用户搜索信息',
      },
    };
    async function plannerNode({
      messages,
      plans,
      task,
    }: typeof StateAnnotation.State) {
      const promptTemplate = PromptTemplate.fromTemplate(PlannerPrompt);
      const prompt = await promptTemplate.format({
        current_time: new Date().toISOString(),
        team_members: 'researcher, coder, browser, reporter',
      });
      const promptTemplate2 = ChatPromptTemplate.fromMessages([
        ['system', prompt],
        new MessagesPlaceholder('messages'),
      ]);
      const llmWithStructured = that.model.withStructuredOutput(
        z.object({
          plans: z.array(
            z.object({
              title: z.string().describe('任务大纲的标题'),
              steps: z.array(z.string()).describe('任务大纲的步骤'),
              //thought: z.string(),
            }),
          ),
        }),
      );

      const chain = promptTemplate2.pipe(llmWithStructured);
      const response = await chain.invoke(
        { messages: messages },
        { tags: ['ignore'] },
      );

      if (response.plans) {
        await dispatchCustomEvent('plans_updated', { plans: response.plans });
      }
      let index = 0;
      return new Command({
        update: {
          messages: [...messages],
          plans: response.plans.map((plan) => {
            return {
              title: plan.title,
              steps: plan.steps.map((step) => {
                return {
                  id: index++,
                  description: step,
                  note: '',
                  status: 'not_started',
                };
              }),
            };
          }),
        },
        goto: '__end__',
      });
    }

    async function receptionistNode({
      messages,
      plans,
      task,
    }: typeof StateAnnotation.State) {
      let goto;
      if (!plans) {
        const promptTemplate = ChatPromptTemplate.fromMessages([
          [
            'system',
            [
              '你是前台接待员，请根据用户的需求给出相应的回复',
              '- 把复杂的任务交给专门的任务规划师`handoff_to_planner`,必须提供`task`的用户任务描述',
              '- 如果用户需要更改任务的规划,则把任务交给专门的任务规划师`handoff_to_replanner`重新规划,必须提供`task`的用户任务描述',
              '- 如果是非任务相关的问题,则回复用户的问题`response`',
              '- `task`你将保留一切的细节,不能遗漏信息',
            ].join('\n'),
          ],
          new MessagesPlaceholder('messages'),
        ]);
        const llmWithStructuredOutput = that.model.withStructuredOutput(
          z.object({
            action: z.enum([
              'response',
              'handoff_to_planner',
              'handoff_to_replanner',
            ]),
            response: z.string().describe('回复用户的问题').optional(),
            task: z.string().describe('用户任务').optional(),
          }),
        );
        //const prompt = await promptTemplate.invoke({ messages: state.messages });
        // const llmWithTool = this.llm.bindTools([responseTool]);

        const response = await promptTemplate
          .pipe(llmWithStructuredOutput)
          .invoke({ messages: messages }, { tags: ['ignore'] });

        if (response.action == 'response') {
          goto = '__end__';
        } else if (response.action == 'handoff_to_planner') {
          goto = 'planner';
        } else if (response.action == 'handoff_to_replanner') {
          goto = 'planner';
        }

        if (response.task) {
          await dispatchCustomEvent('task_updated', { task: response.task });
        }

        return new Command({
          update: {
            messages: messages,
            plans:
              response.action == 'handoff_to_replanner' ? plans : undefined,
            task: response.task,
          },
          goto,
        });
      } else {
        const promptTemplate = ChatPromptTemplate.fromMessages([
          [
            'system',
            [
              '你是前台接待员，请根据用户的需求给出相应的回复',
              '- 如果用户需要更改任务的规划',
              '- 如果用户要开始任务,则把任务交给专门的任务执行师`handoff_to_execute`处理',
              '- 如果是非任务相关的问题,则回复用户的问题`response`',
            ].join('\n'),
          ],
          new MessagesPlaceholder('messages'),
        ]);
        const llmWithStructuredOutput = that.model.withStructuredOutput(
          z.object({
            action: z.enum(['response', 'handoff_to_execute']),
            response: z.string().describe('回复用户的问题').optional(),
          }),
        );
        //const prompt = await promptTemplate.invoke({ messages: state.messages });
        // const llmWithTool = this.llm.bindTools([responseTool]);

        const response = await promptTemplate
          .pipe(llmWithStructuredOutput)
          .invoke({ messages: messages });

        if (response.action == 'response') {
          goto = '__end__';
        } else if (response.action == 'handoff_to_execute') {
          goto = 'execute';
        }

        return new Command({
          update: {
            messages: messages,
          },
          goto,
        });
      }
    }

    async function agentNode({
      messages,
      plans,
      current_step,
      task,
    }: typeof StateAnnotation.State) {
      const agentFunction = agentMap[current_step.agent];
      const agentInstance = await agentFunction.agent(store);
      const input_msg = [
        new HumanMessage(
          [`[当前任务]\n${current_step.description}`].join('\n'),
        ),
      ];
      try {
        const stream = await agentInstance.invoke(
          { messages: input_msg },
          {
            streamMode: 'values',
            signal: undefined,
          },
        );
      } catch (err) {
        console.error(err);
      }

      const llmWithStructuredOutput = that.model.withStructuredOutput(
        z.object({
          action: z.enum(['replan', 'handoff_to_human', 'next']),
          ask_human: z.string().optional(),
          current_step_status: z.enum(['done', 'failed']),
        }),
      );

      const chain = ChatPromptTemplate.fromMessages([
        ['system', '你是一个任务执行员，请根据用户的需求给出相应的回复'],
        new MessagesPlaceholder('messages'),
      ]).pipe(llmWithStructuredOutput);

      const response = await chain.invoke({ messages: agentResult.messages });

      return new Command({
        update: { messages: agentResult.messages },
        goto: 'execute',
      });
    }

    const executeNode = async ({
      messages,
      plans,
      task,
    }: typeof StateAnnotation.State) => {
      let plan_step: PlanStep | undefined;
      for (const plan of plans) {
        for (const step of plan.steps) {
          if (step.status == 'not_started') {
            plan_step = step;
            break;
          }
        }
      }
      if (plan_step) {
        const agents = Object.keys(agentMap).map((x) => `handoff_to_${x}`);
        agents.push('handoff_to_human');
        const llmWithStructuredOutput = that.model.withStructuredOutput(
          z.object({
            action: z.enum(agents as [string, ...string[]]),
            ask_human: z.string().describe('询问用户的问题').optional(),
          }),
        );
        const promptTemplate = ChatPromptTemplate.fromMessages([
          [
            'system',
            [
              '## 任务',
              '你是任务执行员，请根据用户的需求给出相应的回复',
              '你可以选择一个符合当前任务的agent来完成任务',
              '[Agent]:',
              Object.keys(agentMap)
                .map((x) => `${x}: ${agentMap[x].description}`)
                .join('\n'),
              '[当前任务]:',
              plan_step.description,
            ].join('\n'),
          ],
          new MessagesPlaceholder('messages'),
        ]);
        const response = await promptTemplate
          .pipe(llmWithStructuredOutput)
          .invoke({ messages: messages }, { tags: ['ignore'] });
        if (response.action == 'handoff_to_human') {
          messages.push(new AIMessage(response.ask_human));
          return new Command({
            update: { messages: messages, current_step: plan_step },
            goto: '__end__',
          });
        } else {
          const agent = response.action.split('_')[2];
          plan_step.agent = agent;
          plan_step.status = 'in_progress';
          return new Command({
            update: { messages: messages, current_step: plan_step },
            goto: 'agent',
          });
        }
      } else {
        return new Command({
          update: { messages: messages, current_step: plan_step },
          goto: '__end__',
        });
      }
    };

    const workflow = new StateGraph(StateAnnotation)
      .addNode('agent', agentNode, {
        ends: ['__end__', 'execute'],
      })
      .addNode('execute', executeNode, {
        ends: ['__end__', 'agent'],
      })
      .addNode('planner', plannerNode, {
        ends: ['__end__', 'execute'],
      })
      .addNode('receptionist', receptionistNode, {
        ends: ['planner', 'execute', '__end__'],
      })
      .addEdge('__start__', 'receptionist');

    // Finally, we compile it into a LangChain Runnable.
    const app = workflow.compile({
      store: store,
      checkpointer: dbManager.langgraphSaver,
    });

    return app;
  }
}
