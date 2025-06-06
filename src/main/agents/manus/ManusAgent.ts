import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ChatOptions, ChatStatus } from '@/entity/Chat';
import { AgentMessageEvent, BaseAgent, BaseAnnotation } from '../BaseAgent';
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
import { renderTextDescription } from 'langchain/tools/render';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
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
import { checkAndSummarize, removeThinkTags } from '@/main/utils/messages';
import dayjs from 'dayjs';
import { agentManager } from '..';
import { Repository } from 'typeorm';
import { Agent } from '@/entity/Agent';
import { message } from 'antd';
import { BaseTool } from '@/main/tools/BaseTool';
import { MessageHistory, MessageManager } from '../message_manager';
import {
  BaseAction,
  DoneAction,
  GetMemoryAction,
  HandoffAction,
  HumanFeedbackAction,
  LockedTaskAction,
  PlanAction,
  SaveMemoryAction,
  SearchMemoryAction,
} from './Actions';
import { getAssetPath } from '@/main/utils/path';
import fs from 'fs';
import { isArray } from '@/main/utils/is';
import { PlannerAnnotation, PlannerNode } from '../nodes/PlannerNode';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { Memory, MemoryItem } from './Memory';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { getDefaultEmbeddingModel } from '@/main/embeddings';
import path from 'path';

export class ManusAgent extends BaseAgent {
  name: string = 'aime_manus';

  description: string =
    'aime-manus, a friendly AI assistant developed by the Langmanus team. You specialize in handling greetings and small talk, while handing off complex tasks to a specialized planner';

  tags: string[] = ['work'];

  hidden: boolean = false;

  schema = z.object({
    task: z.string().describe('用户的任务'),
  });

  // model: BaseChatModel;

  systemPrompt: string;

  plannerSystemPrompt: string;

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
      field: 'plannerSystemPrompt',
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

  memoryManager?: Memory;

  maxFailTimes: number;

  workspace?:string;

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
    this.agentRepository = dbManager.dataSource.getRepository(Agent);
  }

  current_state = z.object({
    thought: z.string(),
    action: z.string(),
    action_description: z.string(),
    action_args: z.any(),
    // evaluation_previous_goal: z.string(),
    // memory: z.string().optional(),
    // next_goal: z.string().describe('Your next goal'),
    // reply: z.string().optional().nullable(),
  });

  

  createAgentOutput = (actions: (BaseAction | BaseTool)[]) => {
    if (actions.length > 1) {
      return z.object({
        current_state: this.current_state,
        action: z.union([
          ...actions.map((x) => z.object({ [x.name]: x.schema })),
        ]),
      });
    } else {
      return z.object({
        current_state: this.current_state,
        action: actions[0].schema as z.ZodObject<any>,
      });
    }
  };

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

  initMessage = async (state?: any) => {
    this.messageManager = new MessageManager({
      llm: this.model,
      task: state?.task,
      history: state?.history,
    });
    if (!state?.history) {
      await this.messageManager?.addMessage(
        new SystemMessage(this.systemPrompt),
        undefined,
        'init',
      );
      if (state?.task) {
        await this.messageManager?.addTaskMessage(
          `Your new ultimate task is: "${state.task}" . Take the previous context into account and finish your new ultimate task. `,
        );
      } else {
        // await this.messageManager?.addTaskMessage(
        //   `Currently, you do not have any ultimate task.`,
        // );
      }
      // await this.messageManager?.addMessage(
      //   new HumanMessage('Example Output:'),
      //   undefined,
      //   'init',
      // );

      // await this.messageManager?.addMessage(
      //   new AIMessage({
      //     content: '',
      //     tool_calls: [
      //       {
      //         id: this.messageManager.toolId,
      //         name: 'AgentOutput',
      //         args: {
      //           current_state: {
      //             thought: '',
      //             evaluation_previous_goal: '',
      //             // memory: '',
      //             next_goal: '',
      //           },
      //           action: {
      //             human_feedback: {
      //               question: 'hello, how are you?',
      //             },
      //           },
      //         },

      //         type: 'tool_call',
      //       },
      //     ],
      //   }),
      //   undefined,
      //   'init',
      // );

      // await this.messageManager?.addToolMessage('', 'init');
    }

    // await this.messageManager?.addMessage(
    //   new HumanMessage('[Your task history memory starts here]'),
    // );
  };

  initMemory = async (state?: any) => {
    this.memoryManager = new Memory(state?.memory);
  };

  async createAgent(params: {
    store?: BaseStore;
    model?: BaseChatModel;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    configurable?: Record<string, any>;
  }) {
    const { store, model, messageEvent, chatOptions, signal, configurable } =
      params;
    this.workspace = configurable?.workspace;

    const checkpoint = await dbManager.langgraphSaver.get({
      configurable,
    });
    const state = checkpoint?.channel_values;

    const sendMessage = async (
      message: BaseMessage,
      state?: 'start' | 'end',
    ) => {
      message.id = message.id || uuidv4();
      if (state == 'start' || !state) {
        await messageEvent.created([message]);
      }
      if (state == 'end' || !state) {
        await messageEvent.finished([message]);
      }
    };

    const StateAnnotation = Annotation.Root({
      ...BaseAnnotation,
      ...{
        task: Annotation<string>,
        log_list: Annotation<string>,
        current_state: Annotation<z.infer<typeof this.current_state>>,
        // action: Annotation<any>,
        // actionName: Annotation<string>,
        memory: Annotation<MemoryItem[]>,
        messages: Annotation<BaseMessage[]>,
        history: Annotation<MessageHistory>,
        fail_times: Annotation<number>,
      },
      ...PlannerAnnotation,
    });

    const config = await this.getConfig();
    this.model = model;
    if (!this.model) {
      try {
        const { provider, modelName } = getProviderModel(config.model);
        this.model = await getChatModel(provider, modelName, chatOptions);
      } catch {
        console.error('model not found');
      }
    }

    let { systemPrompt, plannerSystemPrompt } = config;
    try {
      systemPrompt = fs.readFileSync(
        getAssetPath('prompts', 'manus_system_prompt.md'),
        'utf-8',
      );
    } catch {}
    try {
      plannerSystemPrompt = fs.readFileSync(
        getAssetPath('prompts', 'manus_planner_prompt.md'),
        'utf-8',
      );
    } catch {}

    this.plannerSystemPrompt = plannerSystemPrompt;
    this.defaultAgents = config?.defaultAgents || [];
    this.maxFailTimes = config?.maxFailTimes || 5;
    let agentNames = chatOptions?.agentNames || [];
    agentNames.push(...this.defaultAgents);
    agentNames = [...new Set(agentNames)];

    const tools: BaseTool[] = [];

    const commonTools = await toolsManager.buildTools([
      ...new Set([
        'terminal',
        'python_interpreter',
        'file_to_text',
        'move_file',
        'read_file',
        'write_file',
        'create_directory',
        'search_files',
        'list_directory',
        ...(chatOptions?.toolNames || []),
      ]),
    ]);

    tools.push(...commonTools);

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
              '任务的详细总结,若有文件则在全文最后使用<file>文件路径</file>输出文件',
            ),
          fail_reason: z.string().nullable(),
          attachments: z
            .array(z.string())
            .optional()
            .nullable()
            .describe('文件附件列表'),
        }),
      });
      agent.id = agentName;
      agentDescription += `- \`${_agent.name}\`: ${_agent.description}\n`;
      agents.push(agent);
    }

    const agentActionList = [
      DoneAction,
      PlanAction,
      HumanFeedbackAction,
      HandoffAction,
      LockedTaskAction,
      SearchMemoryAction,
      GetMemoryAction,
      SaveMemoryAction,
      ...tools,
    ];

    const renderedTools = renderTextDescription(tools);
    this.systemPrompt = (
      await SystemMessagePromptTemplate.fromTemplate(systemPrompt).format({
        agentDescription,
        renderedTools,
      })
    ).text;
    await this.initMessage(state);
    await this.initMemory(state);

    console.log(
      `当前可使用的动作: [${agentActionList.map((x) => x.name).join(', ')}]`,
    );

    const humanNode = async (state: typeof StateAnnotation.State) => {
      const value = interrupt({
        text_to_revise: state.current_state.action_args.question,
      });
      const humanMessage = value;
      await that.messageManager?.addMessage(humanMessage);
      await sendMessage(humanMessage);
      return new Command({
        update: {
          messages: that.messageManager.getMessages(),
          history: that.messageManager.history,
          waitHumanAsk: false,
        },
        goto: 'manus',
      });
    };

    const lockedTaskNode = async (state: typeof StateAnnotation.State) => {
      const userInput = state.messages[state.messages.length - 1].content;
      const task =
        state.current_state.action_args.task == '<copy_user_input>'
          ? state.messages[state.messages.length - 1].content
          : state.current_state.action_args.task;
      console.log(`📝 主要任务: ${task}`);
      that.messageManager?.removeLastMessage();
      that.messageManager?.removeLastMessage();

      await that.messageManager?.addLockedTaskMessage(
        `Your new ultimate task is: "${task}" . Take the previous context into account and finish your new ultimate task. `,
      );
      return new Command({
        update: {
          task: task,
          history: that.messageManager.history,
        },
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
                this.messageManager.addToolMessage(
                  tool_message.content.toString(),
                  'tool',
                );
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
              messages: this.messageManager.getMessages(),
              history: this.messageManager.history,
            },
            goto: 'manus',
          });
        } else if (isToolMessage(lastMessage)) {
          const tool_message = new ToolMessage('', lastMessage.tool_call_id);
          tool_message.id = uuidv4();
          tool_message.additional_kwargs = {};
          tool_message.additional_kwargs['model'] = state.current_state.action;
          await messageEvent.created([tool_message]);
          const tool = tools.find((x) => x.name == state.current_state.action);
          if (tool) {
            try {
              const res = await tool?.invoke(state.current_state.action_args);
              tool_message.content = res;
              tool_message.status = ChatStatus.SUCCESS;
            } catch (err) {
              tool_message.content = err.message;
              tool_message.status = ChatStatus.ERROR;
            }
            this.messageManager.removeLastMessage();

            await this.messageManager.addToolMessage(
              new ToolMessage(
                tool_message.content.toString(),
                lastMessage.tool_call_id,
              ),
              'tool',
            );
            await messageEvent.finished([tool_message]);
          } else {
            tool_message.content = `${state.actionName} tool not find`;
            tool_message.status = ChatStatus.ERROR;
            await messageEvent.finished([tool_message]);
            throw new Error(`${state.actionName} tool not find`);
          }
          return new Command({
            update: {
              messages: this.messageManager.getMessages(),
              history: this.messageManager.history,
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
      const memoryTool = tool(
        async (input) => {
          const { qurey } = input;
          let memory = that.messageManager.getMessagesWithMetadata();
          memory = memory.filter((x) => x.metadata.type == 'agent');

          const contents = memory.map((x) => x.message?.text?.trim());

          const vectorStore = await MemoryVectorStore.fromDocuments(
            contents
              .filter((x) => x)
              .map(
                (x) =>
                  ({
                    pageContent: x,
                  }) as Document,
              ),
            await getDefaultEmbeddingModel(),
          );

          const results = await vectorStore.similaritySearch(qurey, 5);
          return `[Here is memory start]\n${results.map((x) => x.pageContent).join('\n')}\n[Here is memory end]`;
        },
        {
          name: 'memory',
          description: 'query by keyword from memory',
          schema: z.object({
            qurey: z.string(),
          }),
        },
      );

      const agentNode = async (
        state: typeof StateAnnotation.State,
        config: RunnableConfig,
      ) => {
        const _agent = await agentManager.getAgent(agent.id);
        const newAgent = await agentManager.buildAgent({
          agent: _agent,
          store: store,
          signal: signal,
          tools: [memoryTool],
          responseFormat: z.object({
            summary: z
              .string()
              .describe(
                '任务的详细总结,若有文件则在全文最后使用<file>文件路径</file>输出文件',
              ),
            fail_reason: z.string().nullable(),
            attachments: z
              .array(z.string())
              .optional()
              .nullable()
              .describe('output files'),
          }),
        });
        const { messages, task, todo, current_state } = state;
        const handoffTask = action.handoff.task;
        const handoffAgent = action.handoff.agent_name;
        await sendMessage(
          new AIMessage({
            content: `@${handoffAgent} Help me complete the following tasks: \n${handoffTask}`,
            name: that.name,
          }),
        );

        //const lastMessage = state.messages.pop();
        const inputMessage = new HumanMessage('');
        inputMessage.id = uuidv4();
        inputMessage.name = that.name;
        inputMessage.content = `@${handoffAgent} Help me complete the following tasks, you must focus on this task: \n${handoffTask}`;
        await that.messageManager?.addMessage(
          inputMessage,
          undefined,
          'handoff',
        );
        const inputMessages = this.messageManager.getMessages([
          'init',
          'agent',
        ]);

        if (todo) {
          inputMessages.splice(
            inputMessages.length - 1,
            0,
            new HumanMessage(
              `[Here is todo start]\n${todo}\n[Here is todo end]`,
            ),
          );
        }

        // if (that.memoryManager?.get().length > 0) {
        //   inputMessages.splice(
        //     inputMessages.length - 1,
        //     0,
        //     new HumanMessage(
        //       `[Here is memory you can use]\n${that.memoryManager?.print()}\n[Here is memory end]`,
        //     ),
        //   );
        // }

        // inputMessages.push(inputMessage);

        // if (!isToolMessage(lastMessage)) {
        //   throw new Error('last message is not a tool message');
        // }
        const result = await newAgent.stream(
          {
            messages: inputMessages,
          },
          {
            configurable: {
              signal: signal,
              workspace: config.configurable.workspace,
              thread_id: uuidv4(),
            },
            tags: ['ignore'],
          },
        );
        const result_messages = [];
        let structuredResponse: any;
        for await (const chunk of result) {
          console.log(chunk);
          if (chunk.agent) {
            const { messages: agent_messages } = chunk.agent;
            for (const message of agent_messages) {
              await that.messageManager?.addMessage(
                message,
                undefined,
                'agent',
                handoffAgent,
              );
              message.additional_kwargs.history = [
                ...inputMessages,
                ...result_messages,
              ].map((x) => x.toJSON());
              await sendMessage(message);
              console.log(
                `🪙 花费: ${message.usage_metadata?.total_tokens} 输入: ${message.usage_metadata?.input_tokens} 输出: ${message.usage_metadata?.output_tokens}`,
              );
            }
            result_messages.push(...agent_messages);
          } else if (chunk.tools) {
            const { messages: tool_messages } = chunk.tools;
            for (const message of tool_messages) {
              await that.messageManager?.addMessage(
                message,
                undefined,
                'agent',
                handoffAgent,
              );
              await sendMessage(message);
            }
            result_messages.push(...tool_messages);
          } else if (chunk?.generate_structured_response?.structuredResponse) {
            structuredResponse =
              chunk.generate_structured_response.structuredResponse;
          }
        }

        if (structuredResponse.fail_reason) {
          const lastResultMessage: AIMessage = new AIMessage({
            content: `@${that.name} task failed!\nFail Reason: ${structuredResponse.fail_reason}\nTask Summary: \n${structuredResponse.summary}`,
            name: handoffAgent,
          });
          await that.messageManager?.addMessage(
            lastResultMessage,
            undefined,
            'handoff',
            handoffAgent,
          );
          await sendMessage(lastResultMessage);

          return new Command({
            update: {
              messages: that.messageManager.getMessages(),
              history: that.messageManager.history,
            },
            goto: todo ? 'plan' : 'manus',
          });
        } else {
          const lastResultMessage: AIMessage = new AIMessage({
            content: `@${that.name} task completed!\nTask Summary: \n${structuredResponse.summary}\n\n${structuredResponse?.attachments?.map((x) => `<file>${x}</file>`).join('\n') || ''}`,
            name: handoffAgent,
            usage_metadata:
              result_messages[result_messages.length - 1].usage_metadata,
          });
          await that.messageManager?.addMessage(
            lastResultMessage,
            undefined,
            'handoff',
            handoffAgent,
          );
          await sendMessage(lastResultMessage);

          that.memoryManager?.add(
            structuredResponse.summary,
            result_messages.map((x) => x.content).join('\n'),
          );
          return new Command({
            update: {
              messages: that.messageManager.getMessages(),
              history: that.messageManager.history,
              memory: that.memoryManager.get(),
            },
            goto: todo ? 'plan' : 'manus',
          });
        }
      };
      return agentNode;
    };

    const getNextAction = async (
      inputMessages: BaseMessage[],
      task?: string,
    ): Promise<{
      message: BaseMessage;
      current_state: z.infer<typeof this.current_state>;
      // action: any;
    }> => {
      const agentOutput = this.createAgentOutput(agentActionList);

      const actionTool = tool((args) => {}, {
        name: 'action',
        description: 'thought and select action to execute',
        schema: z.object({
          thought: z.string().describe('Your current thinking step'),
          action: z
            .enum(agentActionList.map((x) => x.name) as [string, ...string[]])
            .describe('The action you want to take'),
          action_description: z
            .string()
            .describe('The description of the action you want to take'),
        }),
      });
      const modelWithThought = that.model.bindTools([actionTool], {
        tool_choice: 'any',
      });
      let result = await modelWithThought.invoke(inputMessages, {
        tags: ['ignore'],
        configurable: {
          signal: signal,
        },
      });
      if(result.tool_calls.length==0){
        return {
          message: new AIMessage({
            content: ``,
            // tool_calls: [result.tool_calls[0]],
          }),
          current_state: {
            thought: '',
            action: HumanFeedbackAction.name,
            action_description: HumanFeedbackAction.description,
            action_args: {question: result.content },
          },

          // action: args.action,
        };
      }

      const tool_call = result.tool_calls[0];
      const { id, name, args } = tool_call;
      console.log(`💭 思考: ${args.thought}`);
      console.log(`🚀 行动: ${args.action}: ${args.action_description}`);
      if (result.text) console.log(`💬 回复: ${result.text}`);
      const action = agentActionList.find((x) => x.name == args.action);
      const modelWithActions = that.model.bindTools([action], {
        tool_choice: 'any',
      });
      
      inputMessages.push(
        new AIMessage(
          `${result.text ? `${result.text}\n` : ''}💭 Thought: ${args.thought}\n🚀 Action: ${args.action}: ${args.action_description}`,
        ),
      );
      result = await modelWithActions.invoke(inputMessages, {
        tags: ['ignore'],
        configurable: {
          signal: signal,
        },
      });
      const action_args = result.tool_calls[0].args;

      return {
        message: new AIMessage({
          content: `${`${result.text}\n` || ''}💭 Thought: ${args.thought}`,
          // tool_calls: [result.tool_calls[0]],
        }),
        current_state: {
          thought: args.thought,
          action: args.action,
          action_description: args.action_description,
          action_args: action_args,
        },
        // action: args.action,
      };

      //       const structured_llm = that.model.withStructuredOutput(agentOutput, {
      //         name: 'AgentOutput',
      //         includeRaw: true,
      //         method: 'functionCalling',
      //       });
      //       const res = await structured_llm.invoke(inputMessages, {
      //         tags: ['ignore'],
      //         configurable: {
      //           signal: signal,
      //         },
      //       });

      //       if (!res.parsed) {
      //         await that.messageManager.addMessage(
      //           res.raw,
      //           undefined,
      //           'action',
      //           that.name,
      //         );
      //         await that.messageManager?.addToolMessage(
      //           new ToolMessage(
      //             `🚨 Action output error: \nYou must response json format like this:\n
      // {
      //  current_state: {
      //   thought: '',
      //   evaluation_previous_goal: '',
      //   memory: '',
      //   next_goal: '',
      //   reply: '',
      // },
      // action: {
      //   human_feedback: {
      //     question: '',
      //   },
      // }`,
      //             (res.raw as AIMessage).tool_calls[0].id,
      //             that.name,
      //           ),
      //           'action',
      //         );
      //         if (res.raw.text) {
      //           const content = removeThinkTags(res.raw.text);
      //           const parser = new JsonOutputParser<typeof agentOutput>();
      //           const result = await parser.invoke(content);

      //           return {
      //             message: res.raw,
      //             current_state: result?.current_state,
      //             action: result?.action,
      //           };
      //         } else if (res.raw.tool_calls) {
      //           const tool_calls = res.raw.tool_calls;
      //           const tool_call = tool_calls[0];
      //           try {
      //             const ss = agentOutput.parse(tool_call.args);
      //             debugger;
      //           } catch (err) {
      //             console.error(tool_call);
      //           }

      //           debugger;
      //         }
      //       }
      //       if (task) {
      //         console.log(`📝 当前主要任务: ${task}`);
      //       }
      //       const actionName = Object.keys(res.parsed.action)[0];
      //       const actionArgs = res.parsed.action[actionName];
      //       console.log(`💭 思考: ${res.parsed.current_state.thought}`);
      //       console.log(`🧠 记忆: ${res.parsed.current_state.memory}`);
      //       console.log(`🚀 行动: ${actionName} ${JSON.stringify(actionArgs)}`);
      //       console.log(`💬 回复: ${res.parsed.current_state.reply}`);
      //       if (isAIMessage(res.raw)) {
      //         console.log(
      //           `🪙 花费: ${res.raw.usage_metadata?.total_tokens} 输入: ${res.raw.usage_metadata?.input_tokens} 输出: ${res.raw.usage_metadata?.output_tokens}`,
      //         );
      //       }
      //       console.log('--------------------------------');

      //       return {
      //         message: res.raw,
      //         current_state: res.parsed.current_state,
      //         action: res.parsed.action,
      //       };
    };

    const manusAgent = async (
      state: typeof StateAnnotation.State,
      config: RunnableConfig,
    ) => {
      const { messages, task, todo } = state;
      const lastMessage = messages[messages.length - 1];

      that.messageManager?.removeAllFromTypeMessage('plan');

      let _inputMessages = that.messageManager?.getMessagesWithMetadata([
        'agent',
      ]);

      const limit = 6;
      const typeIndices: number[] = [];
      _inputMessages.forEach((item, index) => {
        if (item.metadata.type === 'action') {
          typeIndices.push(index);
        }
      });

      // 如果指定类型的元素数量小于等于限制数量，则保留所有元素
      if (typeIndices.length > limit) {
        // 计算要保留的指定类型元素的起始索引
        const startIndex = typeIndices.length - limit;

        // 创建一个集合，存储要删除的元素索引
        const indicesToRemove = new Set<number>();
        typeIndices.slice(0, startIndex).forEach((index) => {
          indicesToRemove.add(index);
        });

        _inputMessages = _inputMessages.filter(
          (_, index) => !indicesToRemove.has(index),
        );
      }

      const inputMessages = _inputMessages.map((x) => x.message);
      // 保留最后3条action

      if (
        isHumanMessage(lastMessage) &&
        !task &&
        state?.current_state?.action != 'human_feedback'
      ) {
        inputMessages.push(lastMessage);
        await this.messageManager?.addMessage(lastMessage, undefined, 'user');
      }

      if (task) {
        if (state.plans) {
          inputMessages.push(
            new HumanMessage(
              `[Here is todo.md Start]\n${todo}\n[Here is todo.md End]\n\n---\nfollow the todo.md to complete the task and current step is "${state.currentStep}"\nIf current step is completed, please update plan or if all steps are completed, please use "done" tool to response\nwhat next step action?`,
            ),
          );
        } else {

          inputMessages.push(new HumanMessage(`what next action?`));
        }
      }

      let nextAction;
      let failTimes = state.fail_times || 0;
      try {
        nextAction = await getNextAction(inputMessages, task);
        failTimes = 0;
      } catch (err) {
        console.error(
          `🚨 失败[${failTimes} / ${this.maxFailTimes}]: ${err.message}`,
        );
        if (failTimes < this.maxFailTimes) {
          failTimes += 1;

          return new Command({
            update: {
              failTimes: failTimes,
              messages: this.messageManager.getMessages(),
              history: this.messageManager.history,
            },
            goto: 'manus',
          });
        } else {
          return new Command({
            goto: END,
          });
        }
      }

      let goto = END;
      const { current_state, message } = nextAction;

      // 添加当前动作
      await this.messageManager.addMessage(
        message,
        undefined,
        'action',
        this.name,
      );

      const actionName = current_state.action;

      if (actionName) {
        if (actionName.startsWith('handoff')) {
          goto = `handoff_to_${current_state.action_args.agent_name}`;
        } else if (actionName == HumanFeedbackAction.name) {
          goto = 'human';
        } else if (actionName == LockedTaskAction.name) {
          goto = 'locked_task';
        } else if (actionName == PlanAction.name) {
          goto = 'plan';
        } else if (tools.map((x) => x.name).includes(actionName)) {
          goto = 'tool';
        } else {
          // goto = 'manus';
        }
      }

      if (goto == 'human') {
        const askMessage = new AIMessage(
          `${current_state.action_args.question}`,
        );
        askMessage.name = this.name;
        askMessage.additional_kwargs.model = 'human_feedback';
        askMessage.additional_kwargs.history = [...inputMessages].map((x) =>
          x.toJSON(),
        );
        await sendMessage(askMessage);
        await this.messageManager?.addMessage(askMessage);
      }

      if (
        actionName.startsWith('handoff') ||
        actionName == LockedTaskAction.name
      ) {
        // if (current_state.thought) {
        //   await sendMessage(
        //     new AIMessage({
        //       content: nextAction.current_state.thought,
        //       name: this.name,
        //     }),
        //   );
        // }
      }
      if (actionName == PlanAction.name) {
        const toolCallMessage = new AIMessage({
          content: current_state.action_description,
          tool_calls: [
            {
              name: actionName,
              args: current_state.action_args,
              id: this.messageManager.toolId,
              type: 'tool_call',
            },
          ],
        });
        toolCallMessage.name = this.name;
        toolCallMessage.additional_kwargs.model = model['modelName'];
        await this.messageManager.addMessage(
          toolCallMessage,
          undefined,
          'action',
          this.name,
        );
        await this.messageManager.addToolMessage('', 'action');
        await sendMessage(
          new AIMessage({
            content: current_state.action_description,
            name: this.name,
          }),
        );
      }
      if (goto == 'tool') {
        const toolCallMessage = new AIMessage({
          content: current_state.action_description,
          tool_calls: [
            {
              name: actionName,
              args: current_state.action_args,
              id: this.messageManager.toolId,
              type: 'tool_call',
            },
          ],
        });
        toolCallMessage.name = this.name;
        toolCallMessage.additional_kwargs.model = model['modelName'];
        await this.messageManager.addMessage(
          toolCallMessage,
          undefined,
          'action',
          this.name,
        );
        await this.messageManager.addToolMessage('', 'action');
        await sendMessage(toolCallMessage);
      }

      return new Command({
        update: {
          failTimes: failTimes,
          messages: this.messageManager.getMessages(),
          history: this.messageManager.history,
          current_state: nextAction.current_state,
          waitHumanAsk: actionName == HumanFeedbackAction.name,
        },
        goto: goto,
      });
    };

    const workflow = new StateGraph(StateAnnotation)
      .addNode('manus', manusAgent, {
        ends: [
          END,
          ...agents.map((x) => `handoff_to_${x.name}`),
          'tool',
          'human',
          'locked_task',
          ...(agentActionList.includes(PlanAction) ? ['plan'] : []),
        ],
      })
      .addNode('locked_task', lockedTaskNode, {
        ends: ['manus'],
      })
      .addNode('tool', await toolNode(commonTools), {
        ends: ['manus'],
      })
      .addNode('human', humanNode, {
        ends: ['manus'],
      })
      .addEdge(START, 'manus');

    if (agentActionList.includes(PlanAction)) {
      workflow
        .addNode(
          'plan',
          await PlannerNode({
            llm: that.model,
            messageManager: this.messageManager,
            systemPrompt: this.plannerSystemPrompt,
            structuredMethod: 'functionCalling',
            tools: commonTools,
            agentDescription,
            callBack: async (message, state) => {
              if (isAIMessage(message) && state == 'end') {
                message.tool_calls[0].id = this.messageManager.toolId;
                await this.messageManager?.addMessage(
                  message,
                  undefined,
                  'plan',
                );
              } else if (isToolMessage(message)) {
                message.tool_call_id = this.messageManager.toolId;
                if (state == 'end') {
                  console.log('tool_call_id', this.messageManager.toolId);
                  if (this.workspace) {
                    await fs.promises.writeFile(
                      path.join(this.workspace, 'todo.md'),
                      message.content.toString(),
                    );
                  }
                  await this.messageManager?.addToolMessage(
                    message.content.toString(),
                    'plan',
                  );
                  console.log('tool_call_id', this.messageManager.toolId);
                }
              }
              await sendMessage(message, state);
            },
          }),
        )

        .addEdge('plan', 'manus');
    }

    for (const agent of agents) {
      // const _agent = await that.agentRepository.findOne({
      //   where: { id: agentName },
      // });
      // const agent = await agentManager.buildAgent({
      //   agent: _agent,
      //   store: store,
      //   signal: signal,
      //   responseFormat: z.object({
      //     logs: z.string().describe('执行日志'),
      //     result: z.enum(['success', 'fail', 'skip']),
      //   }),
      // });
      workflow.addNode(
        `handoff_to_${agent.name}`,
        await createAgentNode(agent),
        {
          ends: ['manus', 'plan'],
        },
      );
    }

    // Finally, we compile it into a LangChain Runnable.
    const app = workflow.compile({
      store: store,
      checkpointer: dbManager.langgraphSaver,

      // interruptAfter: ['ask'],
    });
    app.config = { recursionLimit: 1000 };
    return app;
  }
}
