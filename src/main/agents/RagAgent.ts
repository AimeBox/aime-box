/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatOpenAI } from '@langchain/openai';

import {
  AgentExecutor,
  createOpenAIToolsAgent,
  createOpenAIFunctionsAgent,
  createReactAgent,
  createStructuredChatAgent,
} from 'langchain/agents';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { pull } from 'langchain/hub';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from '@langchain/core/prompts';

import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import type {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { type BaseMessage } from '@langchain/core/messages';
import {
  BaseOutputParser,
  OutputParserException,
} from '@langchain/core/output_parsers';
import { getChatModel } from '../llm';
import type {
  AgentAction,
  AgentFinish,
  AgentStep,
} from '@langchain/core/agents';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { DuckDuckGoSearchTool } from '../tools/DuckDuckGoSearch';

import { ReActSingleInputOutputParser } from 'langchain/agents/react/output_parser';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AgentRunnableSequence } from './ToolsAgent';
import { WeatherTool } from '../tools/WeatherTool';
import { Ollama } from '@langchain/community/llms/ollama';
import { ReActInputOutputParser } from './react/ReActInputOutputParser';

const REACT_PROMPT = `Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question
Begin!

Question: {input}
Thought:{agent_scratchpad}
`;

export function formatLogToString(
  intermediateSteps: AgentStep[],
  observationPrefix = 'Observation: ',
  llmPrefix = 'Thought: ',
) {
  const formattedSteps = intermediateSteps.reduce(
    (thoughts, { action, observation }) =>
      thoughts +
      [action.log, `\n${observationPrefix}${observation}`, llmPrefix].join(
        '\n',
      ),
    '',
  );
  return formattedSteps;
}

export const testReActAgent = async () => {
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
  const duckDuckGoSearch = new DuckDuckGoSearch({ maxResults: 1 });

  const res3 = await duckDuckGoSearch.invoke('LangChain definition');
  const tools = [new WeatherTool(), duckDuckGoSearch];

  // const llm = await getChatModel('local-ollama', 'qwen:7b');
  const llm = await getChatModel('local-ollama', 'qwen:7b');
  // const llm = await getChatModel('local-ollama', 'phi3');
  // const llm = await getChatModel('local-ollama', 'llama3:instruct');
  // const llm = await getChatModel('gmcc', 'qwen:14b');
  // const llm = await getChatModel('oai', 'gpt-3.5-turbo');
  // const llm = new Ollama({
  //   temperature: 0,
  //   baseUrl: 'http://127.0.0.1:11434',
  //   model: 'phi3',
  // });

  // const llm = await getChatModel('gmcc', 'qwen:14b');
  // const llm = await getChatModel('oai', 'gpt-3.5-turbo');
  // const prompt = await pull<PromptTemplate>('hwchase17/react');
  const prompt = await pull<PromptTemplate>('hwchase17/structured-chat-agent');
  // const prompt = PromptTemplate.fromTemplate(REACT_PROMPT);

  const missingVariables = ['tools', 'tool_names', 'agent_scratchpad'].filter(
    (v) => !prompt.inputVariables.includes(v),
  );
  if (missingVariables.length > 0) {
    throw new Error(
      `Provided prompt is missing required input variables: ${JSON.stringify(
        missingVariables,
      )}`,
    );
  }
  const toolNames = tools.map((tool) => tool.name);
  const partialedPrompt = await prompt.partial({
    tools: (): string => {
      return tools
        .map((tool) => {
          const schema = zodToJsonSchema(tool.schema);
          const parameters = {
            type: schema.type,
            properties: schema.properties,
            required: schema.required,
          };

          return `${tool.name}: ${
            tool.description
          }  Parameters: ${JSON.stringify(parameters)}`;
        })
        .join('\n');
    },
    tool_names: toolNames.join(', '),
  });
  // TODO: Add .bind to core runnable interface.
  const llmWithStop = llm.bind({
    stop: ['\nObservation:'],
  });
  const agent = AgentRunnableSequence.fromRunnables(
    [
      RunnablePassthrough.assign({
        agent_scratchpad: (input) => {
          return formatLogToString(input.steps);
        },
      }),
      partialedPrompt,
      llmWithStop,
      new ReActInputOutputParser({
        toolNames,
      }),
    ],
    {
      name: 'ReactAgent',
      streamRunnable: false,
      singleAction: true,
    },
  );

  // const agent = await createReactAgent({
  //   llm,
  //   tools,
  //   prompt,
  // });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    handleParsingErrors(e) {
      return e.message;
    },
  });

  // const result = await agentExecutor.invoke({
  //   input: 'What is LangChain?',
  // });
  const result = await agentExecutor.invoke({
    input: '当前广州和北京温度差多少',
  });

  console.log(result);
};
