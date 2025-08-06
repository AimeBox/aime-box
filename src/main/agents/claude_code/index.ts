import { FormSchema } from '@/types/form';
import { AgentMessageEvent, BaseAgent, BaseAnnotation } from '../BaseAgent';
import { z } from 'zod';
import { t } from 'i18next';
import { ChatOptions, ChatStatus } from '@/entity/Chat';
import { tool } from '@langchain/core/tools';
import {
  Annotation,
  BaseStore,
  Command,
  END,
  interrupt,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getProviderModel } from '@/main/utils/providerUtil';
import { getChatModel } from '@/main/llm';
import { RunnableConfig } from '@langchain/core/runnables';
import { concat, IterableReadableStream } from '@langchain/core/utils/stream';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { getClaudeCodePrompt, getCompressionPrompt } from './prompt';
import tokenCounter from '@/main/utils/tokenCounter';
import { BaseTool } from '@/main/tools/BaseTool';
import {
  FileRead,
  FileWrite,
  Edit,
  MultiEdit,
  ListDirectory,
  GrepTool,
  GlobTool,
} from '@/main/tools/FileSystemTool';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { toolsManager } from '@/main/tools';
import { TodoRead, TodoWrite } from '@/main/tools/TodoToolkit';
import { PythonInterpreterTool } from '@/main/tools/PythonInterpreter';
import { TerminalTool } from '@/main/tools/TerminalTool';
import { BashTool } from '@/main/tools/BashTool';
import { v4 as uuidv4 } from 'uuid';
import { MemoryRead, MemorySave } from '@/main/tools/MemoryToolkit';
import { dbManager } from '@/main/db';
import { WebSearchTool } from '@/main/tools/WebSearchTool';
import { WebLoader } from '@/main/tools/WebLoader';
import { Think } from '@/main/tools/ThinkTool';
import { AskHuman } from '@/main/tools/AskHuman';
import { AgentInfo, agentManager } from '..';
import { Agent } from '@/entity/Agent';
import { isObject, isString } from '@/main/utils/is';
import path from 'path';
import fs from 'fs';
import settingsManager from '@/main/settings';
import os from 'os';
import { appendPart, prependPart } from '@/main/utils/messages';

export class VibeAgent extends BaseAgent {
  name: string = 'vibe_agent';

  description: string =
    'a helpful AI assistant that helps users with complex tasks';

  tags: string[] = ['work'];

  hidden: boolean = false;

  fixedThreadId: boolean = true;

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
      label: t('common.compression_token_threshold'),
      field: 'compression_token_threshold',
      subLabel: '',
      component: 'InputNumber',
      defaultValue: 0.7,
      componentProps: {
        min: 0.5,
        max: 0.9,
        step: 0.01,
      },
    },
    {
      label: t('common.compression_preserve_threshold'),
      field: 'compression_preserve_threshold',
      component: 'InputNumber',
      defaultValue: 0.3,
    },
    {
      label: t('common.compression_model'),
      field: 'compression_model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'llm',
      },
    },
    {
      component: 'InputNumber',
      field: 'recursionLimit',
      defaultValue: 25,
      label: t('agents.recursionLimit'),
    },
  ];

  systemPrompt: string;

  compression_model?: BaseChatModel;

  constructor(options: {
    provider: string;
    modelName: string;
    options: ChatOptions;
  }) {
    super(options);
  }

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

    const sendMessage = async (
      message: BaseMessage,
      state?: 'start' | 'chunk' | 'end',
    ) => {
      message.id = message.id || uuidv4();
      if (state == 'start' || !state) {
        await messageEvent.created([message]);
      }
      if (state == 'chunk') {
        await messageEvent.updated([message]);
      }
      if (state == 'end' || !state) {
        await messageEvent.finished([message]);
      }
    };
    const config = await this.getConfig();
    this.systemPrompt = '';
    this.model = model;
    if (!this.model) {
      try {
        const { provider, modelName } = getProviderModel(config.model);
        this.model = await getChatModel(provider, modelName, chatOptions);
      } catch {
        console.error('model not found');
      }
    }
    if (!config.compression_model) {
      this.compression_model = this.model;
    } else {
      try {
        const { provider, modelName } = getProviderModel(
          config.compression_model,
        );
        this.compression_model = await getChatModel(
          provider,
          modelName,
          chatOptions,
        );
      } catch {
        console.error('model not found');
      }
    }

    const that = this;

    const tools: BaseTool[] = [];

    const agentNames = chatOptions?.agentNames || [];

    const agents =
      agentNames.length > 0
        ? (await agentManager.getList()).filter((agent) =>
            agentNames.includes(agent.name),
          )
        : [];

    const commonTools = await toolsManager.buildTools([
      ...new Set([
        new BashTool().name,
        new PythonInterpreterTool().name,
        new FileRead().name,
        new FileWrite().name,
        new TodoWrite().name,
        // new TodoRead().name,
        new Edit().name,
        new MultiEdit().name,
        new ListDirectory().name,
        new WebSearchTool().name,
        new WebLoader().name,
        new GrepTool().name,
        new Think().name,
        new AskHuman().name,
        ...(chatOptions?.toolNames || []),
      ]),
    ]);

    tools.push(...commonTools);

    tools.push(new MemorySave());
    // tools.push(new MemoryRead());

    const createTaskTool = async (
      tools: BaseTool[],
      agents: BaseAgent[] = [],
    ) => {
      let TaskSchema;
      if (agents.length > 0) {
        TaskSchema = z.object({
          description: z
            .string()
            .describe('A short (3-5 word) description of the task'),
          prompt: z.string().describe('The task for the agent to perform'),
          subagent_type: z
            .enum(['general-purpose', ...agents.map((agent) => agent.name)])
            .describe('The type of specialized agent to use for this task'),
        });
      } else {
        TaskSchema = z.object({
          description: z
            .string()
            .describe('A short (3-5 word) description of the task'),
          prompt: z.string().describe('The task for the agent to perform'),
          subagent_type: z
            .enum(['general-purpose'])
            .describe('The type of specialized agent to use for this task'),
        });
      }

      const TaskTool = tool(
        async (
          arg: z.infer<typeof TaskSchema>,
          runManager?: CallbackManagerForToolRun,
          config?: RunnableConfig,
        ) => {
          const { description, prompt, subagent_type } = arg;

          const _agent: AgentInfo = await agentManager.getAgent(subagent_type);
          if (subagent_type == 'general-purpose') {
            return {
              is_success: true,
              res: `Now task`,
            };
          } else if (_agent) {
            const _tools = await toolsManager.buildTools(_agent.tools);

            const system_prompt = `${_agent.prompt}

# Additional Instructions

Here is useful information about the environment you are running in:
<env>
Working directory: ${cwd}
Platform: ${process.platform}
OS Version: ${os.version()}
System Language: ${settingsManager.getLanguage()}
Today's date: ${new Date().toISOString().split('T')[0]}
</env>
`;
            _agent.prompt = system_prompt;
            const subAgent = await agentManager.buildAgent({
              agent: _agent as Agent,
              model: _agent.model,
              signal,
              tools: _tools,
            });
            const res: { messages: BaseMessage[] } = await subAgent.invoke(
              {
                messages: [new HumanMessage(prompt)],
              },
              {
                ...(config || {}),
                tags: ['ignore'],
              },
            );

            return {
              is_success: true,
              messages: [
                ...(_agent.prompt ? [new SystemMessage(system_prompt)] : []),
                ...res.messages,
              ],
            };
          } else {
            return {
              is_success: false,
              error: `Agent "${subagent_type}" not found`,
            };
          }
        },
        {
          name: 'task',
          description: `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types and the tools they have access to:

- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: \\_)
${
  agents.length > 0
    ? `- ${agents
        .map((agent) => {
          return `${agent.name}: ${agent.description}`;
        })
        .join('\n')}\n`
    : ''
}

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.

When NOT to use the Agent tool:

- If you want to read a specific file path, use the '${new FileRead().name}' or '${new GlobTool().name}' tool instead of the Agent tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the '${new GlobTool().name}' tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the '${new FileRead().name}' tool instead of the Agent tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above


Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
6. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.

Example usage:

<example_agent_descriptions>
"code-reviewer": use this agent after you are done writing a signficant piece of code
"greeting-responder": use this agent when to respond to user greetings with a friendly joke
</example_agent_description>

<example>
user: "Please write a function that checks if a number is prime"
assistant: Sure let me write a function that checks if a number is prime
assistant: First let me use the '${new FileWrite().name}' tool to write a function that checks if a number is prime
assistant: I'm going to use the '${new FileWrite().name}' tool to write the following code:
<code>
function isPrime(n) {
 if (n <= 1) return false
 for (let i = 2; i * i <= n; i++) {
 if (n % i === 0) return false
 }
 return true
}
</code>
<commentary>
Since a signficant piece of code was written and the task was completed, now use the code-reviewer agent to review the code
</commentary>
assistant: Now let me use the code-reviewer agent to review the code
assistant: Uses the 'task' tool to launch the with the code-reviewer agent
</example>

<example>
user: "Hello"
<commentary>
Since the user is greeting, use the greeting-responder agent to respond with a friendly joke
</commentary>
assistant: "I'm going to use the 'task' tool to launch the with the greeting-responder agent"
</example>`,
          schema: TaskSchema,
        },
      );

      return TaskTool;
    };

    const taskTool = await createTaskTool(tools, agents);

    tools.push(taskTool);
    const cwd = configurable?.workspace;

    const modelWithTool = this.model.bindTools(tools);

    const StateAnnotation = Annotation.Root({
      ...BaseAnnotation,
      ...{
        messages: Annotation<BaseMessage[]>,
        isCompressed: Annotation<boolean | undefined>,
        todoReminders: Annotation<string | undefined>,
      },
    });

    const humanNode = async (state: typeof StateAnnotation.State) => {
      const ai = state.messages[state.messages.length - 1] as AIMessage;
      const value = interrupt({
        text_to_revise: ai.text,
      });
      const askHuman = ai.tool_calls?.find((x) => x.name == AskHuman.Name);
      const toolMessage = new ToolMessage(
        'wait for human input...',
        askHuman.id,
      );
      let inputWithForm;
      if (
        value.content.startsWith('<ask-human-callback>\n') &&
        value.content.endsWith('\n</ask-human-callback>')
      ) {
        const callbackData = value.content.slice(
          '<ask-human-callback>\n'.length,
          -'\n</ask-human-callback>'.length,
        );
        let input = '';
        inputWithForm = true;

        try {
          input = JSON.parse(callbackData);
          toolMessage.content = value.content;
          toolMessage.additional_kwargs = {
            input,
          };
          toolMessage.status = ChatStatus.SUCCESS;
        } catch (err) {
          toolMessage.content = `human input error: ${err.message}`;
          toolMessage.additional_kwargs = {
            error: err.message,
          };
          toolMessage.status = ChatStatus.ERROR;
        }
      } else {
        inputWithForm = false;
        toolMessage.content = value.content;
        toolMessage.status = ChatStatus.SUCCESS;
      }

      toolMessage.id = uuidv4();

      await sendMessage(toolMessage);

      const act_messages = inputWithForm ? [toolMessage] : [toolMessage, value];

      return new Command({
        update: {
          messages: [...state.messages, ...act_messages],
          waitHumanAsk: false,
        },
        goto: 'mainAgent',
      });
    };

    const mainAgent = async ({
      messages,
      isCompressed,
      todoReminders,
    }: typeof StateAnnotation.State) => {
      const memory = await new MemoryRead().invoke(
        {},
        {
          configurable,
          signal,
        },
      );

      const systemPrompt = await getClaudeCodePrompt(
        tools,
        that.model.modelName,
        cwd,
        undefined,
        undefined,
        taskTool.name,
        agents,
      );
      const systemMessage = new SystemMessage(systemPrompt.join('\n'));
      const aiMessage = new AIMessage('');
      aiMessage.id = uuidv4();
      await sendMessage(aiMessage, 'start');

      const reminders_file = path.join(cwd, '.reminders.md');

      const last_message = messages[messages.length - 1];
      const first_message = messages[0];

      if (
        fs.existsSync(reminders_file) &&
        (isCompressed || messages.length == 1)
      ) {
        const systemReminder = `<system-reminder>
As you answer the user's questions, you can use the following context:
#
Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

Contents of ${reminders_file} (project instructions, checked into the codebase):

${fs.readFileSync(reminders_file, 'utf-8')}

IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>`;

        if (isHumanMessage(first_message)) {
          const msg = prependPart(first_message, systemReminder);
          messages[0] = msg;
        }
      }

      let _todoReminders = `<system-reminder>This is a reminder that your todo list is currently empty. DO NOT mention this to the user explicitly because they are already aware. If you are working on tasks that would benefit from a todo list please use the '${TodoWrite.Name}' tool to create one. If not, please feel free to ignore. Again do not mention this message to the user.</system-reminder>`;
      // add todo list and user memory in message
      if (isHumanMessage(last_message) && todoReminders != _todoReminders) {
        const todoPath = path.join(cwd, '.todo', 'todo.md');
        let todoList;
        if (fs.existsSync(todoPath)) {
          try {
            const data = await fs.promises.readFile(todoPath);
            todoList = JSON.parse(data.toString());
          } catch (err) {
            // console.error(err);
          }
        }

        if (todoList) {
          _todoReminders = `<system-reminder>\nYour todo list has changed. DO NOT mention this explicitly to the user. Here are the latest contents of your todo list:\n\n${JSON.stringify(todoList)}. Continue on with the tasks at hand if applicable.\n</system-reminder>`;
        }
        messages[messages.length - 1] = appendPart(
          last_message,
          _todoReminders,
        );

        const memory_reminder = `<system-reminder>\nThis is the user's memory:\n\n${memory}\nYou can use '${MemorySave.Name}' tool to save or update the memory.\n</system-reminder>`;
        messages[messages.length - 1] = appendPart(
          last_message,
          memory_reminder,
        );
      }

      const response = await modelWithTool.stream(
        [systemMessage, ...messages],
        {
          tags: ['ignore'],
          signal: signal,
        },
      );
      const response_text = '';
      let finalResult: AIMessageChunk | undefined;
      for await (const chunk of response) {
        if (finalResult) {
          finalResult = concat(finalResult, chunk);
        } else {
          finalResult = chunk;
        }
        finalResult.id = aiMessage.id;
        await sendMessage(finalResult, 'chunk');
      }

      finalResult.id = aiMessage.id;
      finalResult.additional_kwargs = finalResult.additional_kwargs || {};
      finalResult.additional_kwargs['history'] = [systemMessage, ...messages];
      await sendMessage(finalResult, 'end');

      delete finalResult.additional_kwargs['history'];

      if (finalResult.content) console.log(finalResult.content);

      if (finalResult.tool_calls && finalResult.tool_calls.length > 0) {
        const ask_human = finalResult.tool_calls.find(
          (x) => x.name == new AskHuman().name,
        );
        if (ask_human) {
          return new Command({
            goto: 'human',
            update: {
              messages: [...messages, finalResult],
              waitHumanAsk: true,
              isCompressed: false,
              todoReminders: _todoReminders,
            },
          });
        }

        const task_calls = finalResult.tool_calls.filter(
          (x) => x.name == taskTool.name,
        );

        if (task_calls.length > 0) {
          return new Command({
            goto: 'task',
            update: {
              messages: [...messages, finalResult],
              isCompressed: false,
              todoReminders: _todoReminders,
            },
          });
        }

        return new Command({
          update: {
            messages: [...messages, finalResult],
            isCompressed: false,
            todoReminders: _todoReminders,
          },
          goto: 'tool',
        });
      }

      return new Command({
        update: {
          messages: [...messages, finalResult],
          todoReminders: _todoReminders,
        },
        goto: END,
      });
    };

    const toolNode = async ({ messages }: typeof StateAnnotation.State) => {
      const last_message = messages[messages.length - 1];
      const tool_call_messages = [];
      if (isAIMessage(last_message)) {
        const toolCalls = last_message.tool_calls;
        for (const toolCall of toolCalls) {
          const toolId = toolCall.id;
          const toolName = toolCall.name;
          const toolArgs = toolCall.args;
          const toolMessage = new ToolMessage('', toolId, toolName);
          toolMessage.id = uuidv4();

          await sendMessage(toolMessage, 'start');

          const tool = await tools.find((t) => t.name == toolName);

          try {
            const toolResult = await tool?.invoke(toolArgs);
            toolMessage.content = toolResult;
            toolMessage.status = ChatStatus.SUCCESS;
          } catch (err) {
            toolMessage.content = err.message;
            toolMessage.additional_kwargs.error = err.message;
            toolMessage.status = ChatStatus.ERROR;
          }
          await sendMessage(toolMessage, 'end');
          tool_call_messages.push(toolMessage);
        }
      }
      return new Command({
        update: {
          messages: [...messages, ...tool_call_messages],
        },
        goto: 'messageCompactor',
      });
    };

    const messageCompactor = async ({
      messages,
    }: typeof StateAnnotation.State) => {
      const { messages: _messages, isCompressed } =
        await tryCompressMessage(messages);

      return new Command({
        update: {
          messages: _messages,
          isCompressed,
        },
        goto: 'mainAgent',
      });
    };

    const tryCompressMessage = async (
      messages: BaseMessage[],
      compression_token_threshold = 0.7,
      compression_preserve_threshold = 0.3,
    ): Promise<{ messages: BaseMessage[]; isCompressed: boolean }> => {
      if (messages.length < 5) return { messages, isCompressed: false };
      const tokenCount = await tokenCounter(messages);

      let max_context_length: number = 64 * 1000;
      if (this.model.metadata && 'max_context_length' in this.model.metadata) {
        max_context_length = this.model.metadata.max_context_length as number;
      }

      console.log(
        `提示词使用率: ${((tokenCount / max_context_length) * 100).toFixed(2)}%`,
      );

      if (tokenCount < compression_token_threshold * max_context_length)
        return { messages, isCompressed: false };

      let preserve_message_index = Math.ceil(messages.length * 0.3);

      while (preserve_message_index < messages.length) {
        if (isToolMessage(messages[preserve_message_index])) {
          preserve_message_index += 1;
        } else {
          break;
        }
      }

      const compression_message = messages.slice(
        0,
        messages.length - preserve_message_index + 1,
      );

      const preserved_message = messages.slice(
        messages.length - preserve_message_index + 1,
      );

      const compressionPrompt = getCompressionPrompt();
      const compressionResponse = await this.compression_model.invoke(
        [
          new SystemMessage(
            `You are a helpful AI assistant tasked with summarizing conversations.`,
          ),
          ...compression_message,
          new HumanMessage(compressionPrompt),
        ],
        { tags: ['ignore'], signal },
      );
      const compression_token_count = await tokenCounter([
        ...compression_message,
        ...preserved_message,
      ]);

      console.log(
        `压缩后提示词使用率: ${((compression_token_count / max_context_length) * 100).toFixed(2)}%`,
      );
      console.log(compressionResponse.content);
      return {
        messages: [
          new HumanMessage({
            content: `This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:\n${compressionResponse.content}`,
          }),
          ...preserved_message,
        ],
        isCompressed: true,
      };
    };

    const taskRun = async (
      { messages }: typeof StateAnnotation.State,
      config: RunnableConfig,
    ) => {
      const last_message: AIMessage = messages[messages.length - 1];
      const task_calls = last_message.tool_calls?.filter(
        (x) => x.name == taskTool.name,
      );

      if (task_calls.length > 0) {
        const task_calls_results = await Promise.all(
          task_calls.map(async (task_call) => {
            const task_call_message = new ToolMessage(
              '',
              task_call.id,
              task_call.name,
            );
            task_call_message.id = uuidv4();
            await sendMessage(task_call_message, 'start');

            const task_call_result = await taskTool.invoke(
              task_call.args,
              config,
            );

            if (task_call_result.is_success) {
              const last_message =
                task_call_result.messages[task_call_result.messages.length - 1];
              task_call_message.status = ChatStatus.SUCCESS;
              task_call_message.content = last_message.content;
              task_call_message.additional_kwargs['history'] =
                task_call_result.messages;
            } else {
              task_call_message.status = ChatStatus.ERROR;
              task_call_message.additional_kwargs['error'] =
                task_call_result.error;
              task_call_message.content = task_call_result.error;
            }
            await sendMessage(task_call_message, 'end');
            delete task_call_message.additional_kwargs['history'];
            return task_call_message;
          }),
        );
        return new Command({
          update: {
            messages: [...messages, ...task_calls_results],
          },
          goto: 'mainAgent',
        });
      } else {
        throw new Error('No task calls found');
      }
    };

    const workflow = new StateGraph(StateAnnotation)
      .addNode('mainAgent', mainAgent, {
        ends: [END, 'tool', 'human', 'task'],
      })
      .addNode('messageCompactor', messageCompactor, {
        ends: ['mainAgent'],
      })
      .addNode('tool', toolNode, {
        ends: ['messageCompactor'],
      })
      .addNode('human', humanNode, {
        ends: ['mainAgent'],
      })
      .addNode('task', taskRun, {
        ends: ['mainAgent'],
      })
      .addEdge(START, 'messageCompactor');

    const app = workflow.compile({
      store: store,
      checkpointer: dbManager.langgraphSaver,

      // interruptAfter: ['ask'],
    });
    return app;
  }

  async stream(
    input: z.infer<typeof this.schema> | string,
    options?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    const that = this;
    async function* generateStream() {
      yield '123';
    }
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
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
}
