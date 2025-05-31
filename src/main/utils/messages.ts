import {
  BaseMessage,
  HumanMessage,
  isSystemMessage,
  isToolMessage,
  RemoveMessage,
  SystemMessage,
  mergeContent,
  mergeMessageRuns,
  isAIMessage,
  AIMessage,
} from '@langchain/core/messages';
import tokenCounter from './tokenCounter';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { isArray, isString } from './is';

const SystemPrompt: string = `You are a specialized summarization assistant. Your task is to create a concise but comprehensive summary of the conversation history.

The summary should:
1. Preserve all key information including decisions, conclusions, and important context
2. Include any tools that were used and their results
3. Maintain chronological order of events
4. Be presented as a narrated list of key points with section headers
5. Include only factual information from the conversation (no new information)
6. Be concise but detailed enough that the conversation can continue with this summary as context

VERY IMPORTANT: This summary will replace older parts of the conversation in the LLM's context window, so ensure it contains ALL key information and LATEST STATE OF THE CONVERSATION - SO WE WILL KNOW HOW TO PICK UP WHERE WE LEFT OFF.


THE CONVERSATION HISTORY TO SUMMARIZE IS AS FOLLOWS:
===============================================================
==================== CONVERSATION HISTORY ====================
{messages}
==================== END OF CONVERSATION HISTORY ====================
===============================================================`;
const checkAndSummarize = async (
  messages: BaseMessage[],
  model: BaseChatModel,
  force: boolean = false,
  options: {
    keepLastMessagesCount: number;
    tokenThreshold?: number;
    summaryTokens?: number;
  } = {
    keepLastMessagesCount: 3,
    tokenThreshold: 30000,
    summaryTokens: 8192,
  },
): Promise<{
  systemMessage?: SystemMessage;
  keepMessages: BaseMessage[];
  deleteMessages?: BaseMessage[];
  summaryMessage?: BaseMessage;
}> => {
  if ('maxTokens' in model) {
    model.maxTokens = options.summaryTokens || 8192;
  }
  if (options.keepLastMessagesCount < 0) {
    options.keepLastMessagesCount = 3;
  }
  let systemMessage;
  if (isSystemMessage(messages[0])) {
    systemMessage = messages.shift();
  }

  if (messages.length <= options.keepLastMessagesCount) {
    if (systemMessage) return { systemMessage, keepMessages: messages };
    return { keepMessages: messages };
  }

  const summarizeMessages = messages.slice(
    0,
    -1 * options.keepLastMessagesCount,
  );
  const keepMessages = messages.slice(-1 * options.keepLastMessagesCount);

  while (true) {
    const msg = keepMessages.shift();
    if (isToolMessage(msg)) {
      summarizeMessages.push(msg);
    } else {
      keepMessages.unshift(msg);
      break;
    }
  }
  const ss = summarizeMessages
    .map((x) => {
      const dict = x.toDict();
      if (['ai', 'human', 'system', 'tool'].includes(dict.type)) {
        const m: any = dict.data;
        let content = '';
        if (isString(m.content)) {
          content = `${dict.type}: ${m.content}`;
        } else if (isArray(m.content)) {
          content = m.content
            .filter((x) => x.type == 'text' && x.text)
            .map((x: any) => `${dict.type}: ${x.text}`)
            .join('\n');
        }

        if (m.tool_calls) {
          content += `\n> tool_call: ${JSON.stringify(m.tool_calls)}`;
        }
        return content;
      }
      return null;
    })
    .filter((x) => x);
  const content = ss.join('\n');

  const tokenCount = await tokenCounter([new HumanMessage(content)], model);
  if (tokenCount < options.tokenThreshold && !force) {
    if (systemMessage) return { systemMessage, keepMessages: messages };
    return { keepMessages: messages };
  }
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(SystemPrompt),
    new HumanMessage(
      'PLEASE PROVIDE THE SUMMARY NOW. The language match the CONVERSATION HISTORY',
    ),
  ]);

  const formattedChatPrompt = await chatPrompt.invoke({
    messages: content,
  });

  const summary = await model.invoke(formattedChatPrompt, { tags: ['ignore'] });

  const summaryMessage =
    new HumanMessage(`======== CONVERSATION HISTORY SUMMARY ========

${summary.content}

======== END OF SUMMARY ========

The above is a summary of the conversation history. The conversation continues below.`);
  const deleteMessages = summarizeMessages.map(
    (x) => new RemoveMessage({ id: x.id }),
  );
  if (systemMessage)
    return {
      systemMessage,
      keepMessages: mergeMessageRuns([...keepMessages]),
      deleteMessages,
      summaryMessage,
    };

  return {
    keepMessages: mergeMessageRuns([...keepMessages]),
    deleteMessages,
    summaryMessage,
  };
};

const convertMessagesForNonFunctionCallingModels = (
  messages: BaseMessage[],
): BaseMessage[] => {
  return messages.map((message) => {
    if (isToolMessage(message)) {
      return new HumanMessage({ content: message.content });
    } else if (isAIMessage(message)) {
      if (message.tool_calls && message.tool_calls.length > 0) {
        return new AIMessage({
          content: message.content
            ? `${message.content}\ntool_calls: ${JSON.stringify(message.tool_calls)}`
            : `tool_calls: ${JSON.stringify(message.tool_calls)}`,
        });
      } else {
        return new AIMessage({
          content: message.content,
        });
      }
    }
    return message;
  });
};

const removeThinkTags = (text: string): string => {
  return text.replaceAll(/<think>([\s\S]*?)<\/think>/g, '');
};

export {
  checkAndSummarize,
  convertMessagesForNonFunctionCallingModels,
  removeThinkTags,
};
