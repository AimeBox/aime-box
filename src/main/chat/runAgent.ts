import { ChatStatus } from '@/entity/Chat';
import {
  AIMessage,
  BaseMessage,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { CompiledStateGraph } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';

export const runAgent = async (
  agent: any,
  messages: BaseMessage[],
  signal?: AbortSignal,
  configurable?: Record<string, any> | undefined,
  modelName?: string,
  providerType?: string,
  callbacks?: {
    handlerMessageCreated?: (message: BaseMessage) => Promise<void>;
    handlerMessageStream?: (message: BaseMessage) => Promise<void>;
    handlerMessageError?: (message: BaseMessage) => Promise<void>;
    handlerMessageFinished?: (message: BaseMessage) => Promise<void>;
  },
) => {
  let lastMessage;
  // const toolCalls = [];
  // const messages = [];
  messages.forEach((x) => {
    if (isHumanMessage(x)) {
      if (x.content.length == 1 && (x.content[0] as any)?.type == 'text') {
        x.content = (x.content[0] as any)?.text;
      }
    }
  });
  let _lastMessage;
  try {
    const eventStream = await agent.streamEvents(
      { messages },
      {
        version: 'v2',
        signal,
        configurable: { thread_id: uuidv4(), ...(configurable || {}) },
      },
    );
    const _toolCalls = [];
    const _messages = [];
    for await (const { event, tags, data } of eventStream) {
      if (event == 'on_chat_model_start') {
        console.log('on_chat_model_start', data);
        _lastMessage =
          data.input.messages[0][data.input.messages[0].length - 1];
        if (isHumanMessage(_lastMessage)) {
          await callbacks?.handlerMessageCreated?.(_lastMessage);
          _messages.push(_lastMessage);
        }
        const aiMessage = new AIMessage({
          id: uuidv4(),
          content: '',
          additional_kwargs: {
            model: modelName,
            provider_type: providerType,
          },
        });
        await callbacks?.handlerMessageCreated?.(aiMessage);
        _lastMessage = aiMessage;
        _messages.push(aiMessage);
      } else if (event == 'on_chat_model_stream') {
        // console.log('on_chat_model_stream', data);

        if (data.chunk.content && _lastMessage) {
          if (isAIMessage(_lastMessage)) {
            _lastMessage.content += data.chunk.content;
            await callbacks?.handlerMessageStream?.(_lastMessage);
          }
        }
      } else if (event == 'on_chat_model_end') {
        console.log('on_chat_model_end', data);
        if (data.output && _lastMessage) {
          _lastMessage.content = data.output.content;
          _lastMessage.tool_calls = data.output.tool_calls;
          if (_lastMessage.tool_calls && _lastMessage.tool_calls.length > 0) {
            _toolCalls.push(..._lastMessage.tool_calls);
          }
          _lastMessage.usage_metadata = data.output.usage_metadata;
          await callbacks?.handlerMessageFinished?.(_lastMessage);
        }
      } else if (event == 'on_tool_start') {
        console.log('on_tool_start', data);
        const toolCall = _toolCalls.shift();
        if (toolCall) {
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
          await callbacks?.handlerMessageCreated?.(toolMessage);
          _lastMessage = toolMessage;
          _messages.push(toolMessage);
        }
      } else if (event == 'on_tool_end') {
        console.log('on_tool_end', data);
        let _isToolMessage = false;
        try {
          _isToolMessage = isToolMessage(data.output);
        } catch {}
        if (_isToolMessage) {
          const msg = _messages.find(
            (x) => x.tool_call_id == data.output.tool_call_id,
          );
          msg.content = data.output.content;
          msg.tool_call_id = data.output.tool_call_id;
          msg.name = data.output.name;
          msg.status = ChatStatus.SUCCESS;
          msg.additional_kwargs = {
            provider_type: undefined,
            model: data.output.name,
          };
          await callbacks?.handlerMessageFinished?.(msg);
          _lastMessage = msg;
        } else {
          //lastMessage.content = output.content;
          _lastMessage.status = ChatStatus.SUCCESS;
          _lastMessage.additional_kwargs = {
            provider_type: undefined,
            model: _lastMessage.name,
          };
          await callbacks?.handlerMessageFinished?.(_lastMessage);
        }
      } else if (
        event == 'on_chain_end' ||
        tags.find((x) => x.startsWith('graph:'))
      ) {
        if (
          data?.output?.messages?.length > 0 &&
          isToolMessage(data.output.messages[0])
        ) {
          const msg = _messages.find(
            (x) => x.tool_call_id == data.output.messages[0].tool_call_id,
          );
          if (msg.status === undefined) {
            msg.content = data.output.messages[0].content;
            msg.status = data.output.messages[0].status;
            await callbacks?.handlerMessageFinished?.(msg);
          }
        }
      } else {
        //console.log(event, tags, data);
      }
    }
  } catch (err) {
    if (_lastMessage) {
      if (isToolMessage(_lastMessage)) {
        _lastMessage.status = ChatStatus.ERROR;
      }
      _lastMessage.additional_kwargs['error'] = err.message || err.name;
      await callbacks?.handlerMessageError?.(_lastMessage);
    }
    console.error(err);
  }
};
