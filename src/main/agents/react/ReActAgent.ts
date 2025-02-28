import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { getChatModel } from '../../llm';
import { ChatOptions } from '../../../entity/Chat';
import {} from '@langchain/core/language_models/base';
import { toolsManager } from '../../tools';
import { ChatResponse } from '@/main/chat/ChatResponse';

export const chatWithReActAgent = async (
  query: { content: any[] },
  connectionName: string,
  modelName: string,
  toolNames: string[],
  options: ChatOptions,
  history: BaseMessage[],
): Promise<ChatResponse> => {
  const messageHistory = new ChatMessageHistory();
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      'Respond to the human as helpfully and accurately as possible. You have access to the following tools:\n\n{tools}\n\nUse a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).\n\nValid "action" values: "Final Answer" or {tool_names}\n\nProvide only ONE action per $JSON_BLOB, as shown:\n\n```json\n{{\n  "action": $TOOL_NAME,\n  "action_input": $INPUT\n}}\n```\n\nFollow this format:\n\nQuestion: input question to answer\nThought: consider previous and subsequent steps\nAction:\n```\n$JSON_BLOB\n```\nObservation: action result\n... (repeat Thought/Action/Observation N times)\nThought: I know what to respond\nAction:\n```json\n{{\n  "action": "Final Answer",\n  "action_input": "Final response to human"\n}}\n```\n\nBegin! Reminder to ALWAYS respond with a valid json blob of a single action. Use tools if necessary. Respond directly if appropriate. Format is Action:```$JSON_BLOB```then Observation',
    ),
    new MessagesPlaceholder('chat_history'),
    HumanMessagePromptTemplate.fromTemplate(
      '{input}\n\n{agent_scratchpad}\n(reminder to respond in a JSON blob no matter what)',
    ),
  ]);
  // const promptTemplate = PromptTemplate.fromTemplate();

  // const prompt = await pull<PromptTemplate>('hwchase17/structured-chat-agent');

  const llm = await getChatModel(connectionName, modelName, options);
  let agent;
  const tools = toolsManager.tools
    .filter((x) => (options?.toolNames ?? []).includes(x.name))
    .map((x) => x.tool);
  toolNames = tools.map((x) => x.name);
  if (tools.length == 0) {
  } else {
    // if (llm.lc_namespace[llm.lc_namespace.length - 1] == 'ollama') {
    //   options.temperature = 0.1;
    //   llm = await getChatModel(connectionName, modelName, options);
    //   llm = new OllamaFunctions(llm);
    //   llm.bind({functions:[]})
    // }
    agent = await createStructuredChatAgent({
      llm: llm,
      tools: tools,
      prompt: prompt,
      streamRunnable: false,
    });
  }
  const agentExecutor = new AgentExecutor({
    agent,
    tools: tools,
    verbose: true,
    maxIterations: 3,
    handleParsingErrors(e) {
      return e.message;
    },
  });

  // const agentWithChatHistory = new RunnableWithMessageHistory({
  //   runnable: agentExecutor,
  //   // This is needed because in most real world scenarios, a session id is needed per user.
  //   // It isn't really used here because we are using a simple in memory ChatMessageHistory.
  //   getMessageHistory: (_sessionId) => messageHistory,
  //   inputMessagesKey: 'input',
  //   historyMessagesKey: 'chat_history',
  // });
  const actions = [];
  const res = await agentExecutor.invoke(
    {
      input: query.content.find((x) => x.type == 'text').text,
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
            const { tool } = action;
            const { toolInput } = action;
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
  let output = null;

  if (typeof res.output === 'string') {
    output = res.output;
  } else {
    output = JSON.stringify(res.output);
  }

  return {
    actions,
    output,
  };
};
