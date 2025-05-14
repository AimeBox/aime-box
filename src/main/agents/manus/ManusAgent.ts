import { Runnable, RunnableConfig } from '@langchain/core/runnables';

import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ChatOptions, ChatStatus } from '@/entity/Chat';
import { AgentMessageEvent, BaseAgent } from '../BaseAgent';
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
import { v4 as uuidv4 } from 'uuid';

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  isToolMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';
import { createReactAgent, ToolNode } from '@langchain/langgraph/prebuilt';

import {
  Annotation,
  BaseStore,
  Command,
  END,
  InMemoryStore,
  START,
  MessagesAnnotation,
  StateGraph,
  interrupt,
} from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { dbManager } from '@/main/db';
import { PlannerPrompt, ReporterPrompt, ResearcherPrompt } from './prompt';
import { checkAndSummarize } from '@/main/utils/messages';
import dayjs from 'dayjs';
import { agentManager } from '..';
import { Repository } from 'typeorm';
import { Agent } from '@/entity/Agent';
import { message } from 'antd';
import { BaseTool } from '@/main/tools/BaseTool';
import { MessageManager } from '../message_manager';

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
  name: string = 'aime_manus';

  description: string =
    'aime-manus, a friendly AI assistant developed by the Langmanus team. You specialize in handling greetings and small talk, while handing off complex tasks to a specialized planner';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  model: BaseChatModel;

  systemPrompt: string;

  todoSystemPrompt: string;

  fixedThreadId: boolean = true;

  defaultAgents: string[] = [];

  agentRepository: Repository<Agent>;

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
    {
      label: t('agents.prompt'),
      field: 'systemPrompt',
      component: 'InputTextArea',
    },
    {
      label: t('agents.todo_system_prompt'),
      field: 'todoSystemPrompt',
      component: 'InputTextArea',
    },
    {
      label: t('agents.agents'),
      field: 'defaultAgents',
      component: 'AgentSelect',
    },
  ];

  config: any = {};

  messageManager?: MessageManager;

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
    this.agentRepository = dbManager.dataSource.getRepository(Agent);
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

  async createAgent(
    store?: BaseStore,
    model?: BaseChatModel,
    messageEvent?: AgentMessageEvent,
    chatOptions?: ChatOptions,
    signal?: AbortSignal,
    state?: any,
  ) {
    const StateAnnotation = Annotation.Root({
      task: Annotation<BaseMessage>,
      todoList: Annotation<string>,
      logList: Annotation<string>,
      // plans: Annotation<Plans[]>,
      // current_step: Annotation<PlanStep>,
      memory: Annotation<string>,
      messages: Annotation<BaseMessage[]>,
      // ({
      //   reducer: (x, y) => x.concat(y),
      // }),
    });

    const config = await this.getConfig();
    const { provider, modelName } = getProviderModel(config.model);
    this.model =
      model || (await getChatModel(provider, modelName, { temperature: 0 }));
    this.systemPrompt = config.systemPrompt;
    this.todoSystemPrompt = config.todoSystemPrompt;
    this.defaultAgents = config.defaultAgents;
    let agentNames = chatOptions?.agentNames || [];
    agentNames.push(...this.defaultAgents);
    agentNames = [...new Set(agentNames)];

    this.messageManager = new MessageManager({
      llm: this.model,
    });

    this.messageManager?.addMessage(
      new SystemMessage(this.systemPrompt),
      undefined,
      'init',
    );

    this.messageManager?.addMessage(
      new HumanMessage('Example Output:'),
      undefined,
      'init',
    );

    this.messageManager?.addMessage(
      new AIMessage({
        content: '',
        tool_calls: [
          { id: this.messageManager.toolId, name: 'AgentOutput', args: {} },
        ],
      }),
      undefined,
      'init',
    );

    this.messageManager?.addToolMessage('', 'init');

    const that = this;

    const agents = [];
    let agentDescription = '';
    for (const agentName of agentNames) {
      const _agent = await agentManager.getAgent(agentName);
      const agent = await agentManager.buildAgent({
        agent: _agent,
        store: store,
        signal: signal,
        responseFormat: z.object({
          summary: z
            .string()
            .describe(
              '任务的详细总结,若有文件则在全文最后使用<file>[文件名](文件路径)</file>输出文件',
            ),
          fail_reason: z.string().describe('任务失败的原因').optional(),
        }),
      });
      agentDescription += `- [${_agent.name}]: ${_agent.description}\n`;
      agents.push(agent);
    }

    const complete = tool(
      async (input) => {
        return 'complete';
      },
      {
        name: 'complete',
        description: 'complete the task',
        schema: z.object({}),
      },
    );
    const ask = tool(
      async (input) => {
        return '';
      },
      {
        name: 'ask',
        description: 'ask human for help',
        schema: z.object({
          question: z.string().describe('询问用户的问题,也可以提供合适的建议'),
        }),
      },
    );
    const todoTool = tool(
      async (
        input: {
          task: string;
          todoList: string;
          logList: string;
        },
        config: RunnableConfig,
      ) => {
        const { workspace } = config.configurable;
        const promptMessages = [
          new SystemMessage(that.todoSystemPrompt),
          new HumanMessage(
            `当前任务: ${input.task}\n
            待办事项: \n\`\`\`\n${input.todoList || '未创建任何待办事项'}\n\`\`\`\n`,
          ),
        ];

        if (input.logList) {
          promptMessages.push(
            new HumanMessage(`历史执行日志: \n${input.logList}`),
          );
        }

        promptMessages.push(
          new HumanMessage(`根据以上信息,更新待办事项,并返回更新后的待办事项`),
        );

        const promptTemplate = ChatPromptTemplate.fromMessages(promptMessages);

        const res = await promptTemplate.pipe(that.model).invoke(input, {
          tags: ['ignore'],
        });

        return res.content;
      },
      {
        name: 'todo',
        description: 'plan a todo list',
        schema: z.object({
          task: z.string(),
          todoList: z.string().optional(),
          logList: z.string().optional(),
        }),
      },
    );

    function humanNode(state: typeof StateAnnotation.State) {
      const value = interrupt({
        text_to_revise: state.messages[state.messages.length - 1].text,
      });
      return new Command({
        update: {
          messages: [...state.messages, value],
        },
        goto: 'manus',
      });
    }

    const todoNode = async ({
      messages,
      todoList,
      logList,
      task,
    }: typeof StateAnnotation.State) => {
      const lastMessage = messages.pop();
      if (isAIMessage(lastMessage) && lastMessage.tool_calls) {
        const tool_call = lastMessage.tool_calls[0];
        if (tool_call.name == 'todo') {
          const tool_message = new ToolMessage('', tool_call.id);
          tool_message.id = uuidv4();
          tool_message.additional_kwargs = {};
          tool_message.additional_kwargs['model'] = 'todo';
          tool_message.response_metadata;
          await messageEvent.created([tool_message]);
          const updatedTodo = await todoTool.invoke(
            {
              task: task.text,
              todoList,
              logList,
            },
            { tags: ['ignore'] },
          );
          tool_message.content = updatedTodo;
          tool_message.status = ChatStatus.SUCCESS;

          await messageEvent.finished([tool_message]);

          return new Command({
            update: {
              todoList: updatedTodo,
              messages: [...messages],
            },
            goto: 'manus',
          });
        } else {
          return {};
        }
      }
      return new Command({
        update: { todoList: '' },
        goto: 'manus',
      });
    };

    const toolNode = async (tools: BaseTool[]) => {
      const cb = async (state: typeof StateAnnotation.State) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (
          isAIMessage(lastMessage) &&
          lastMessage.tool_calls &&
          lastMessage.tool_calls.length > 0
        ) {
          const results = await Promise.all(
            lastMessage.tool_calls.map(async (tool_call) => {
              const tool_message = new ToolMessage('', tool_call.id);
              tool_message.id = uuidv4();
              tool_message.additional_kwargs = {};
              tool_message.additional_kwargs['model'] = tool_call.name;
              await messageEvent.created([tool_message]);
              const tool = tools.find((x) => x.name == tool_call.name);
              if (tool) {
                try {
                  const res = await tool?.invoke(tool_call.args);
                  tool_message.content = res;
                  tool_message.status = ChatStatus.SUCCESS;
                } catch (err) {
                  tool_message.content = err.message;
                  tool_message.status = ChatStatus.ERROR;
                }
                await messageEvent.finished([tool_message]);
              } else {
                tool_message.content = `${tool_call.name} tool not find`;
                tool_message.status = ChatStatus.ERROR;
                await messageEvent.finished([tool_message]);
                throw new Error(`${tool_call.name} tool not find`);
              }

              //tool_message.status =

              return tool_message;
            }),
          );
          return new Command({
            update: {
              messages: [...state.messages, ...results],
            },
            goto: 'manus',
          });
        }
        return new Command({
          goto: 'manus',
        });
      };
      return await cb;
    };

    const createAgentNode = async (agent: any) => {
      const agentNode = async (
        { messages, todoList, task, logList }: typeof StateAnnotation.State,
        config: RunnableConfig,
      ) => {
        const lastMessage = messages.pop();
        const inputMessage = new HumanMessage('');
        inputMessage.id = lastMessage.id;
        inputMessage.name = lastMessage.name;
        inputMessage.content = lastMessage.content;
        // if (!isToolMessage(lastMessage)) {
        //   throw new Error('last message is not a tool message');
        // }
        const result = await agent.invoke(
          {
            messages: [inputMessage],
            task: task,
            todoList: todoList,
            logList: logList,
          },
          {
            configurable: {
              name: agent.name,
              signal: signal,
              thread_id: uuidv4(),
            },
          },
        );
        const lastResultMessage: AIMessage =
          result.messages[result.messages.length - 1];
        lastResultMessage.name = agent.name;
        lastResultMessage.content = `> @aime-mas 我已收集了信息\n${lastResultMessage.text}`;

        const tudoMessage: AIMessage = new AIMessage('');
        tudoMessage.id = uuidv4();
        tudoMessage.name = agent.name;
        tudoMessage.additional_kwargs.model = 'todo';
        tudoMessage.tool_calls = [
          {
            name: 'todo',
            args: {},
            id: uuidv4(),
          },
        ];
        await messageEvent.created([tudoMessage]);
        await messageEvent.finished([tudoMessage]);

        // const askMessage = new AIMessage('');
        // askMessage.id = uuidv4();
        // askMessage.additional_kwargs = {};
        // askMessage.additional_kwargs['model'] = agent.name;
        // await messageEvent.created([askMessage]);
        // askMessage.content = result.content;
        // await messageEvent.finished([askMessage]);

        return new Command({
          update: {
            messages: [
              ...messages,
              inputMessage,
              lastResultMessage,
              tudoMessage,
            ],
            logList: `${logList || ''}\n> @${agent.name} 执行状态: ${result.structuredResponse.result}\n 执行日志:\n${result.structuredResponse.logs}\n\n---\n`,
          },
          goto: 'todo',
        });
      };
      return agentNode;
    };
    const commonTools = await toolsManager.buildTools([
      'terminal',
      'python_interpreter',
      'file_to_text',
      'move_file',
      'read_file',
      'write_file',
      'create_directory',
      'search_files',
      'list_directory',
    ]);

    const manusAgent = async (
      { messages, todoList, task, logList }: typeof StateAnnotation.State,
      config: RunnableConfig,
    ) => {
      if (!that.messageManager?.task && task) {
        that.messageManager?.addTaskMessage(task.text);
      }

      const _messages = that.messageManager?.getMessages();

      // const resmsg = await that.model.invoke(messages);
      // return { messages: [resmsg] };

      const lastMessage = messages[messages.length - 1];

      // if (isToolMessage(lastMessage)) {
      //   return new Command({
      //     goto: END,
      //   });
      // }
      const tools: BaseTool[] = [];
      let todoPrompt = ``;
      if (task && todoList) {
        todoPrompt =
          '- 根据当前的todo.md来决定之后的执行,其中标记为 [x] 的为已完成的任务,标记为 [ ] 是未执行的任务';
        // hand_off
        if (agents.length > 0) {
          tools.push(
            tool(
              async (input): Promise<string> => {
                return ``;
              },
              {
                name: 'handoff',
                description:
                  'hand off the task to the agent,must provide task details and background',
                schema: z.object({
                  agent_name: z.enum([...agents.map((x) => x.name)] as [
                    string,
                    ...string[],
                  ]),
                  task: z.string().describe('任务详情'),
                  background: z.string().describe('任务背景'),
                  result: z.string().describe('需要返回的成果'),
                }),
              },
            ),
          );
        }

        // complete
        tools.push(complete);
      } else {
        todoPrompt =
          '- 如果用户的任务比较复杂,需要使用`todo`工具来维护一个任务执行计划,根据**执行日志**或**用户的需要**来更新该计划,其中标记为 [x] 的为已完成的任务,标记为 [ ] 是未执行的任务';
        // todo
        tools.push(
          tool(
            async (input): Promise<string> => {
              return ``;
            },
            {
              name: 'todo',
              description: 'plan a todo list',
              schema: z.object({}),
            },
          ),
        );
      }

      //ask
      tools.push(ask);

      tools.push(...commonTools);

      const modelWithTools = that.model.bindTools(tools);
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

      if (isAIMessage(lastMessage)) {
        messages.push(
          new HumanMessage(
            `## 当前任务列表\n=== todo START ===\n${todoList}\n=== todo END ===\n根据以上任务列表接续任务`,
          ),
        );
      }

      const response = await prompt.pipe(modelWithTools).invoke(
        {
          messages: messages,
          now: now,
          todoPrompt,
          agentDescription: agentDescription,
          task: task || '用户输入主要任务',
          todoList: todoList || '没创建任何待办事项',
          workspace: config.configurable.workspace,
          tools: commonTools
            .map((x) => `- [${x.name}]: ${x.description}`)
            .join('\n'),
        },
        { tags: ['ignore'] },
      );
      response.name = 'aime-mas';
      response.additional_kwargs.model = 'aime-mas';
      response.additional_kwargs.history = messages.map((x) => x.toJSON());

      if (response.tool_calls && response.tool_calls.length == 1) {
        if (response.tool_calls[0].name == 'complete') {
          return new Command({
            //update: { messages: [...messages] },
            goto: END,
          });
        } else if (response.tool_calls[0].name == 'todo') {
          response.additional_kwargs.model = 'todo';
          await messageEvent.created([response]);
          await messageEvent.finished([response]);
          return new Command({
            update: {
              messages: [...messages, response],
              task: task || lastMessage,
            },
            goto: 'todo',
          });
        } else if (response.tool_calls[0].name == 'ask') {
          const askMessage = new AIMessage('');
          askMessage.id = uuidv4();
          askMessage.additional_kwargs = {};
          askMessage.additional_kwargs['model'] = 'ask';
          await messageEvent.created([askMessage]);
          askMessage.content = response.tool_calls[0].args.question;
          await messageEvent.finished([askMessage]);
          return new Command({
            update: {
              messages: [...messages, askMessage],
            },
            goto: 'human',
          });
        } else if (response.tool_calls[0].name == 'handoff') {
          const { agent_name, task, background, result } =
            response.tool_calls[0].args;
          const handOffMessage = new AIMessage('');
          handOffMessage.id = uuidv4();
          handOffMessage.additional_kwargs = {};
          handOffMessage.additional_kwargs['model'] = 'aime-mas';
          handOffMessage.name = 'aime-mas';
          await messageEvent.created([handOffMessage]);
          handOffMessage.content = `> @${agent_name}请帮我完成以下任务\n### 背景:\n${background}\n### 任务详情:\n${task}\n### 需要返回:\n${result}`;
          //handOffMessage.status = ChatStatus.SUCCESS;
          await messageEvent.finished([handOffMessage]);
          return new Command({
            update: {
              messages: [...messages, handOffMessage],
            },
            goto: `handoff_to_${agent_name}`,
          });
        } else {
          // const handOffMessage = new AIMessage('');
          // handOffMessage.id = uuidv4();
          // handOffMessage.additional_kwargs = {};
          // handOffMessage.additional_kwargs['model'] =
          //   ``;
          await messageEvent.created([response]);
          //handOffMessage.content = `> @${agent_name}请帮我完成以下任务\n### 背景:\n${background}\n### 任务详情:\n${task}\n### 需要返回:\n${result}`;
          //handOffMessage.status = ChatStatus.SUCCESS;
          await messageEvent.finished([response]);
          return new Command({
            update: {
              messages: [...messages, response],
            },
            goto: 'tool',
          });
        }
      }

      await messageEvent.created([response]);
      await messageEvent.finished([response]);

      return new Command({
        update: { messages: [...messages, response], task: lastMessage },
        goto: END,
      });
    };

    const shouldContinue = (state: typeof StateAnnotation.State) => {
      const { messages } = state;
      if (messages.length > 6) {
        return 'summarize_conversation';
      }
      const lastMessage = messages[messages.length - 1];
      if (
        isAIMessage(lastMessage) &&
        (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)
      ) {
        return END;
      } else {
        if (
          isAIMessage(lastMessage) &&
          lastMessage.tool_calls &&
          lastMessage.tool_calls.length === 1 &&
          lastMessage.tool_calls[0].name == 'todo'
        ) {
          return 'todo';
        }
        return END;
      }
    };

    const summarizeConversationNode = async ({
      messages,
    }: typeof StateAnnotation.State) => {
      return { messages: [new AIMessage('任务总结')] };
    };

    const workflow = new StateGraph(StateAnnotation)
      .addNode('manus', manusAgent, {
        ends: [
          END,
          'todo',
          'tool',
          'human',
          ...agents.map((x) => x.name).map((x) => `handoff_to_${x}`),
        ],
      })
      .addNode('todo', todoNode, {
        ends: ['manus'],
      })
      .addNode('human', humanNode, {
        ends: ['manus'],
      })
      .addNode('tool', await toolNode(commonTools), {
        ends: ['manus'],
      })
      //.addNode('deleteMessages', deleteMessages, { ends: ['manus'] })

      // .addNode('todo', todoNode, {
      //   ends: ['manus'],
      // })
      // .addNode('summarize_conversation', summarizeConversationNode, {
      //   ends: ['manus'],
      // })
      // .addConditionalEdges('manus', shouldContinue, {
      //   todo: 'todo',
      //   summarize_conversation: 'summarize_conversation',
      //   [END]: END,
      // })

      .addEdge(START, 'manus');

    for (const agentName of agentNames) {
      const _agent = await that.agentRepository.findOne({
        where: { id: agentName },
      });
      const agent = await agentManager.buildAgent({
        agent: _agent,
        store: store,
        signal: signal,
        responseFormat: z.object({
          logs: z.string().describe('执行日志'),
          result: z.enum(['success', 'fail', 'skip']),
        }),
      });
      workflow.addNode(
        `handoff_to_${_agent.name}`,
        await createAgentNode(agent),
        {
          ends: ['todo'],
        },
      );
    }

    // Finally, we compile it into a LangChain Runnable.
    const app = workflow.compile({
      store: store,
      checkpointer: dbManager.langgraphSaver,
      // interruptAfter: ['ask'],
    });

    return app;
  }
}
