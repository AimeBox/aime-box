import { ChatStatus } from '@/entity/Chat';
import {
  AIMessage,
  isHumanMessage,
  isToolMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';

export const chatCallbacks = (
  modelName,
  providerType,
  handlerMessageCreated,
  handlerMessageStream,
  handlerMessageError,
  handlerMessageFinished,
) => {
  let lastMessage;
  const toolCalls = [];
  const messages = [];
  return [
    {
      async handleChatModelStart(
        llm,
        messages,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        runName,
      ) {
        const _lastMessage = messages[0][messages.length - 1];
        if (isHumanMessage(_lastMessage)) {
          await handlerMessageCreated?.(_lastMessage);
          messages.push(_lastMessage);
        }
        const aiMessage = new AIMessage({
          id: uuidv4(),
          content: '',
          additional_kwargs: {
            model: modelName,
            provider_type: providerType,
          },
        });
        await handlerMessageCreated?.(aiMessage);
        lastMessage = aiMessage;
        messages.push(aiMessage);
      },
      async handleLLMNewToken(token, idx, runId, parentRunId, tags, fields) {
        if (token && lastMessage) {
          if (lastMessage instanceof AIMessage) {
            lastMessage.content += token;
            await handlerMessageStream?.(lastMessage);
          }
        }
      },
      async handleLLMError(err, runId, parentRunId, tags, extraParams) {
        console.log('handleLLMError', {
          err,
          runId,
          parentRunId,
          tags,
          extraParams,
        });
        if (lastMessage) {
          if (isToolMessage(lastMessage)) {
            lastMessage.status = ChatStatus.ERROR;
          }
          lastMessage.additional_kwargs['error'] = err.error || err.name;
          await handlerMessageError?.(lastMessage);
        }
      },
      async handleLLMEnd(output, runId, parentRunId, tags, extraParams) {
        if (output && lastMessage) {
          lastMessage.content = output.generations[0][0].text;
          lastMessage.tool_calls = output.generations[0][0].message.tool_calls;
          if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            toolCalls.push(...lastMessage.tool_calls);
          }
          lastMessage.usage_metadata =
            output.generations[0][0].message.usage_metadata;
          await handlerMessageFinished?.(lastMessage);
        }
      },
      async handleToolStart(
        tool,
        input,
        runId,
        parentRunId,
        tags,
        metadata,
        runName,
      ) {
        console.log(tool, input, runName);
        const toolCall = toolCalls.shift();
        const toolMessage = new ToolMessage({
          id: uuidv4(),
          content: '',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          additional_kwargs: {
            provider_type: undefined,
            model: toolCall.name,
          },
        });
        await handlerMessageCreated?.(toolMessage);
        lastMessage = toolMessage;
        messages.push(toolMessage);
      },
      async handleToolEnd(output, runId, parentRunId, tags) {
        console.log(output);
        let _isToolMessage = false;
        try {
          _isToolMessage = isToolMessage(output);
        } catch {}
        if (_isToolMessage) {
          const msg = messages.find(
            (x) => x.tool_call_id == output.tool_call_id,
          );
          msg.content = output.content;
          msg.tool_call_id = output.tool_call_id;
          msg.name = output.name;
          msg.status = ChatStatus.SUCCESS;
          msg.additional_kwargs = {
            provider_type: undefined,
            model: output.name,
          };
          await handlerMessageFinished?.(msg);
          lastMessage = msg;
        } else {
          //lastMessage.content = output.content;
          lastMessage.status = ChatStatus.SUCCESS;
          lastMessage.additional_kwargs = {
            provider_type: undefined,
            model: lastMessage.name,
          };
          await handlerMessageFinished?.(lastMessage);
        }
      },
      async handleToolError(output, runId, parentRunId, tags) {
        lastMessage.content = output.message;
        lastMessage.status = ChatStatus.ERROR;
        await handlerMessageFinished?.(lastMessage);
      },
    },
  ];
};
