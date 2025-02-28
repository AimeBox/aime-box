import { ChatOpenAI } from '@langchain/openai';
import {
  AgentExecutor,
  createOpenAIToolsAgent,
  createOpenAIFunctionsAgent,
  createReactAgent,
} from 'langchain/agents';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { pull } from 'langchain/hub';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';

import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import type {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  ToolMessage,
  AIMessage,
  isBaseMessage,
} from '@langchain/core/messages';
import { type BaseMessage } from '@langchain/core/messages';
import {
  BaseOutputParser,
  OutputParserException,
} from '@langchain/core/output_parsers';
import { getChatModel } from '../llm';
import type { AgentAction, AgentFinish } from '@langchain/core/agents';

export class ToolsAgentOutputParser extends BaseOutputParser<
  AgentAction[] | AgentFinish
> {
  lc_namespace: string[];

  constructor() {
    super(...arguments);
    Object.defineProperty(this, 'lc_namespace', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ['langchain', 'agents', 'openai'],
    });
  }

  static lc_name() {
    return 'ToolsAgentOutputParser';
  }

  async parse(text) {
    throw new Error(
      `OpenAIFunctionsAgentOutputParser can only parse messages.\nPassed input: ${text}`,
    );
  }

  async parseResult(generations) {
    if ('message' in generations[0] && isBaseMessage(generations[0].message)) {
      return this.parseAIMessage(generations[0].message);
    }
    throw new Error(
      'parseResult on OpenAIFunctionsAgentOutputParser only works on ChatGeneration output',
    );
  }

  /**
   * Parses the output message into a ToolsAgentAction[] or AgentFinish
   * object.
   * @param message The BaseMessage to parse.
   * @returns A ToolsAgentAction[] or AgentFinish object.
   */
  parseAIMessage(message) {
    if (message.content && typeof message.content !== 'string') {
      throw new Error('This agent cannot parse non-string model responses.');
    }
    if (message.additional_kwargs.tool_calls) {
      const toolCalls = message.additional_kwargs.tool_calls;
      try {
        return toolCalls.map((toolCall, i) => {
          const toolInput = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {};
          const messageLog = i === 0 ? [message] : [];
          return {
            tool: toolCall.function.name,
            toolInput,
            toolCallId: toolCall.id,
            log: `Invoking "${toolCall.function.name}" with ${
              toolCall.function.arguments ?? '{}'
            }\n${message.content}`,
            messageLog,
          };
        });
      } catch (error) {
        throw new OutputParserException(
          `Failed to parse tool arguments from chat model response. Text: "${JSON.stringify(
            toolCalls,
          )}". ${error}`,
        );
      }
    } else {
      return {
        returnValues: { output: message.content },
        log: message.content,
      };
    }
  }

  getFormatInstructions() {
    throw new Error(
      'getFormatInstructions not implemented inside OpenAIToolsAgentOutputParser.',
    );
  }
}

export class AgentRunnableSequence extends RunnableSequence {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, 'streamRunnable', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'singleAction', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromRunnables([first, ...runnables], config) {
    const sequence = RunnableSequence.from([first, ...runnables], config.name);
    sequence.singleAction = config.singleAction;
    sequence.streamRunnable = config.streamRunnable;
    return sequence;
  }

  static isAgentRunnableSequence(x) {
    return typeof x.singleAction === 'boolean';
  }
}

export function formatToOpenAIToolMessages(
  steps: ToolsAgentStep[],
): BaseMessage[] {
  return steps.flatMap(({ action, observation }) => {
    if ('messageLog' in action && action.messageLog !== undefined) {
      const log = action.messageLog;
      return log.concat(
        new ToolMessage({
          content: observation,
          tool_call_id: action.toolCallId,
        }),
      );
    }
    return [new AIMessage(action.log)];
  });
}

export const testToolsAgent = async () => {
  const addTool = new DynamicStructuredTool({
    name: 'add',
    description: 'Add two integers together.',
    schema: z.object({
      firstInt: z.number(),
      secondInt: z.number(),
    }),
    func: async ({ firstInt, secondInt }) => {
      return (firstInt + secondInt).toString();
    },
  });

  const multiplyTool = new DynamicStructuredTool({
    name: 'multiply',
    description: 'Multiply two integers together.',
    schema: z.object({
      firstInt: z.number(),
      secondInt: z.number(),
    }),
    func: async ({ firstInt, secondInt }) => {
      return (firstInt * secondInt).toString();
    },
  });

  const weatherTool = new DynamicStructuredTool({
    name: 'get_current_weather',
    description: 'Get the current weather in a given location',
    schema: z.object({
      location: z
        .string()
        .describe('The city and state, e.g. San Francisco, CA'),
      unit: z.enum(['celsius', 'fahrenheit']),
    }),
    func: async ({ location, unit }) => {
      if (location.toLowerCase().includes('tokyo')) {
        return JSON.stringify({
          location: 'Tokyo',
          temperature: '10',
          unit: 'celsius',
        });
      }
      if (
        location.toLowerCase().includes('beijing') ||
        location.toLowerCase().includes('北京')
      ) {
        return JSON.stringify({
          location: 'beijing',
          temperature: '10',
          unit: 'celsius',
        });
      }
      if (
        location.toLowerCase().includes('guangzhou') ||
        location.toLowerCase().includes('广州')
      ) {
        return JSON.stringify({
          location: 'guangzhou',
          temperature: '20',
          unit: 'celsius',
        });
      }
      if (location.toLowerCase().includes('san francisco')) {
        return JSON.stringify({
          location: 'San Francisco',
          temperature: '72',
          unit: 'fahrenheit',
        });
      }
      if (location.toLowerCase().includes('paris')) {
        return JSON.stringify({
          location: 'Paris',
          temperature: '22',
          unit: 'celsius',
        });
      }
      return JSON.stringify({ location: location, temperature: 'unknown' });
    },
  });

  const exponentiateTool = new DynamicStructuredTool({
    name: 'exponentiate',
    description: 'Exponentiate the base to the exponent power.',
    schema: z.object({
      base: z.number(),
      exponent: z.number(),
    }),
    func: async ({ base, exponent }) => {
      return (base ** exponent).toString();
    },
  });

  // const tools = [addTool, multiplyTool, exponentiateTool, weatherTool];
  const tools = [weatherTool];
  // const prompt = await pull<ChatPromptTemplate>('hwchase17/openai-tools-agent');

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', '"You are a helpful assistant"'],
    //new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);
  // const model = await getChatModel('local-ollama', 'qwen:7b');
  const model = await getChatModel('local-ollama', 'phi3');

  // const model = await getChatModel('gmcc', 'qwen:14b');
  // const model = await getChatModel('oai', 'gpt-3.5-turbo');
  const agent = await createToolsAgent({ llm: model, tools, prompt });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    handleParsingErrors: (e) => {
      return e.message;
    },
  });

  const res = await agentExecutor.invoke({
    input: '我想知道现在北京和广州的气温相差多少度？',
  });

  // const res = await agentExecutor.invoke({
  //   input: "What's the weather like in San Francisco?",
  // });
  const res2 = await agentExecutor.invoke({
    input:
      'Take 3 to the fifth power and multiply that by the sum of twelve and three, then square the whole result',
  });
  debugger;
};
export type CreateToolsAgentParams = {
  /**
   * LLM to use as the agent. Should work with OpenAI tool calling,
   * so must either be an OpenAI model that supports that or a wrapper of
   * a different model that adds in equivalent support.
   */
  llm: BaseChatModel<
    BaseChatModelCallOptions & {
      tools?:
        | StructuredToolInterface[]
        | OpenAIClient.ChatCompletionTool[]
        | any[];
    }
  >;
  /** Tools this agent has access to. */
  tools: StructuredToolInterface[];
  /** The prompt to use, must have an input key of `agent_scratchpad`. */
  prompt: ChatPromptTemplate;
  /**
   * Whether to invoke the underlying model in streaming mode,
   * allowing streaming of intermediate steps. Defaults to true.
   */
  streamRunnable?: boolean;
};

export function createToolsAgent({
  llm: model,
  tools,
  prompt,
  streamRunnable,
}: CreateToolsAgentParams) {
  if (!prompt.inputVariables.includes('agent_scratchpad')) {
    throw new Error(
      [
        `Prompt must have an input variable named "agent_scratchpad".`,
        `Found ${JSON.stringify(prompt.inputVariables)} instead.`,
      ].join('\n'),
    );
  }
  const modelWithTools = model.bind({ tools: tools.map(convertToOpenAITool) });

  const agent = AgentRunnableSequence.fromRunnables(
    [
      RunnablePassthrough.assign({
        agent_scratchpad: (input) => formatToOpenAIToolMessages(input.steps),
      }),
      prompt,
      modelWithTools,
      new ToolsAgentOutputParser(),
    ],
    {
      name: 'ToolsAgent',
      streamRunnable,
      singleAction: false,
    },
  );
  return agent;
}
