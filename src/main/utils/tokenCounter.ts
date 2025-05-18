import { Tiktoken } from 'js-tiktoken/lite';
import { getEncodingNameForModel, getEncoding } from 'js-tiktoken';
import {
  BaseMessage,
  isAIMessage,
  isToolMessage,
} from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

const tokenCounter = async (
  messages: BaseMessage[],
  model?: BaseChatModel,
): Promise<number> => {
  if (model && 'getNumTokens' in model) {
    try {
      const listTokenCounter = async (msgs: BaseMessage[]) => {
        let tokenCounts = 0;
        for (const msg of msgs) {
          if (isAIMessage(msg)) {
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              tokenCounts += await model.getNumTokens(
                JSON.stringify(msg.tool_calls) + msg.content,
              );
            } else {
              tokenCounts += await model.getNumTokens(msg.content);
            }
          } else {
            tokenCounts += await model.getNumTokens(msg.content);
          }
        }

        return tokenCounts;
      };
      const count = await listTokenCounter(messages);
      return count;
    } catch {
      console.log('tokenCounter error');
    }
  }
  const iktoken = getEncoding('o200k_base');
  const content = messages
    .map((m) => {
      if (isAIMessage(m)) {
        return JSON.stringify(m.tool_calls) + m.content;
      }
      return m.content;
    })
    .join('\n');
  const tokens = iktoken.encode(content);

  return tokens.length;
};

export default tokenCounter;
