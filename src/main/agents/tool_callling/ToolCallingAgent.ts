import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import {
  AgentExecutor,
  createStructuredChatAgent,
  createToolCallingAgent,
} from 'langchain/agents';
import { pull } from 'langchain/hub';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { getChatModel } from '../../llm';
import { ChatOptions } from '../../../entity/Chat';
import {} from '@langchain/core/language_models/base';
import { toolsManager } from '../../tools';
import { ChatResponse } from '@/main/chat/ChatResponse';

export const chatWithToolCallingAgent = async (
  query: { content: any[] },
  files: string[],
  connectionName: string,
  modelName: string,
  options: ChatOptions,
  history: BaseMessage[],
): Promise<ChatResponse> => {
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'You are a helpful assistant'],
    ['placeholder', '{chat_history}'],
    ['human', '{input}'],
    ['placeholder', '{agent_scratchpad}'],
  ]);
  const tools = toolsManager.tools
    .filter((x) => (options?.toolNames ?? []).includes(x.name))
    .map((x) => x.tool);

  const llm = await getChatModel(connectionName, modelName, options);
  const agent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  const actions = [];
  const result = await agentExecutor.invoke(
    {
      input: query,
      chat_history: history,
    },
    {
      callbacks: [
        {
          handleAgentAction(action, runId) {
            const regex = /Thought\s*\d*\s*:[\s]*(.*)[\s]/;
            const actionMatch = action.log.match(regex);
            let thought = null;
            if (actionMatch) {
              thought = actionMatch[0]
                .substring(actionMatch.indexOf(':') + 1)
                .trim();
            }
            const { tool, toolInput } = action;

            //console.log(messageLog);
            actions.push({
              runId,
              thought,
              tool,
              toolInput,
              toolOutput: '',
            });

            console.log('\nhandleAgentAction', action);
          },
          handleAgentEnd(action, runId) {
            console.log('\nhandleAgentEnd', action);
          },
          handleToolEnd(output, runId) {
            const action = actions.find((x) => x.runId);
            action.toolOutput = output;
            console.log('\nhandleToolEnd', output);
          },
        },
      ],
    },
  );

  let output = '';
  if (typeof result.output === 'string') {
    output = result.output;
  } else {
    output = JSON.stringify(result.output);
  }

  return {
    actions,
    output,
  };
};
