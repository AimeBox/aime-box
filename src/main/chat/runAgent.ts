import { ChatStatus } from '@/entity/Chat';
import {
  AIMessage,
  BaseMessage,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { CompiledStateGraph, StateGraph } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import { notificationManager } from '../app/NotificationManager';
import { isArray } from '../utils/is';

export const runAgent = async (
  agent: any,
  messages: BaseMessage[],
  options: {
    modelName?: string;
    providerType?: string;
    signal?: AbortSignal;
    configurable?: Record<string, any> | undefined;
    recursionLimit?: number;
    callbacks?: {
      handlerMessageCreated?: (message: BaseMessage) => Promise<void>;
      handlerMessageStream?: (message: BaseMessage) => Promise<void>;
      handlerMessageError?: (message: BaseMessage) => Promise<void>;
      handlerMessageFinished?: (message: BaseMessage) => Promise<void>;
    };
  },
) => {
  let lastMessage;
  // const toolCalls = [];
  // const messages = [];
  messages.forEach((x) => {
    // filter file content
    if (isArray(x.content) && x.content.find((x) => x.type == 'file')) {
      const files: any[] = x.content.filter((x) => x.type == 'file');
      if (x.content.find((x) => x.type == 'text')) {
        (x.content.find((x) => x.type == 'text') as any).text +=
          `\n\n${files.map((z) => `[${z.name}](${z.path})`).join('\n')}`;
      } else {
        x.content.push({
          type: 'text',
          text: files.map((z) => `[${z.name}](${z.path})`).join('\n'),
        });
      }
      x.content = x.content.filter((x) => x.type != 'file');
      x.additional_kwargs = {
        ...x.additional_kwargs,
        files: files,
      };
    }

    if (isHumanMessage(x)) {
      if (x.content.length == 1 && (x.content[0] as any)?.type == 'text') {
        x.content = (x.content[0] as any)?.text;
      } else if (
        x.content.length > 1 &&
        (x.content as any[]).filter((x) => x.type == 'text').length ==
          x.content.length
      ) {
        x.content = (x.content as any[]).map((x) => x.text).join('\n');
      }
    }
  });
  let _lastMessage;
  try {
    const eventStream = await agent.streamEvents(
      { messages, current_time: new Date().toISOString() },
      {
        version: 'v2',
        signal: options?.signal,
        recursionLimit: options?.recursionLimit,
        configurable: { thread_id: uuidv4(), ...(options?.configurable || {}) },
      },
    );
    let _toolCalls = [];
    let _toolStart = [];
    const _messages = [];
    for await (const { event, tags, data } of eventStream) {
      if (tags.includes('ignore')) {
        continue;
      }
      if (event == 'on_chat_model_start') {
        console.log('on_chat_model_start', data, tags);
        _lastMessage =
          data.input.messages[0][data.input.messages[0].length - 1];
        if (isHumanMessage(_lastMessage)) {
          await options?.callbacks?.handlerMessageCreated?.(_lastMessage);
          _messages.push(_lastMessage);
          const aiMessage = new AIMessage({
            id: uuidv4(),
            content: '',
            additional_kwargs: {
              model: options?.modelName,
              provider_type: options?.providerType,
            },
          });
          await options?.callbacks?.handlerMessageCreated?.(aiMessage);
          _lastMessage = aiMessage;
          _messages.push(aiMessage);
        } else {
          const aiMessage = new AIMessage({
            id: uuidv4(),
            content: '',
            additional_kwargs: {
              model: options?.modelName,
              provider_type: options?.providerType,
            },
          });
          await options?.callbacks?.handlerMessageCreated?.(aiMessage);
          _lastMessage = aiMessage;
          _messages.push(aiMessage);
        }
      } else if (event == 'on_chat_model_stream') {
        //console.log('on_chat_model_stream', data);

        if (data.chunk.content && _lastMessage) {
          if (isAIMessage(_lastMessage)) {
            _lastMessage.content += data.chunk.content;
            await options?.callbacks?.handlerMessageStream?.(_lastMessage);
          }
        }
      } else if (event == 'on_chat_model_end') {
        console.log('on_chat_model_end', data, tags);
        if (data.output && _lastMessage) {
          _lastMessage.content = data.output.content;
          _lastMessage.tool_calls = data.output.tool_calls;
          if (_lastMessage.tool_calls && _lastMessage.tool_calls.length > 0) {
            _toolCalls = [];
            _toolCalls.push(..._lastMessage.tool_calls);
            _toolStart = [];
          }
          _lastMessage.usage_metadata = data.output.usage_metadata;
          await options?.callbacks?.handlerMessageFinished?.(_lastMessage);
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
          await options?.callbacks?.handlerMessageCreated?.(toolMessage);
          _lastMessage = toolMessage;
          _messages.push(toolMessage);
          _toolStart.push(toolMessage);
        }
      } else if (event == 'on_tool_end') {
        console.log('on_tool_end', data);
        let _isToolMessage = false;
        const tooStart = _toolStart.shift();

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
          await options?.callbacks?.handlerMessageFinished?.(msg);
          _lastMessage = msg;
        } else {
          const _toolMessage =
            data.output?.update?.messages[
              data.output.update.messages.length - 1
            ];
          if (_toolMessage) {
            const msg = _messages.find(
              (x) => x.tool_call_id == _toolMessage.tool_call_id,
            );
            //lastMessage.content = output.content;
            msg.content = _toolMessage.content;
            msg.status = ChatStatus.SUCCESS;
            msg.additional_kwargs = {
              provider_type: undefined,
              model: msg.name,
            };
            await options?.callbacks?.handlerMessageFinished?.(msg);
            _lastMessage = msg;
          }
        }
      } else if (
        event == 'on_chain_end' ||
        tags.find((x) => x.startsWith('graph:'))
      ) {
        if (
          data?.output?.messages?.length > 0 &&
          isToolMessage(data.output.messages[0])
        ) {
          const tooStart = _toolStart.shift();
          const msg = _messages.find(
            (x) => x.tool_call_id == data.output.messages[0].tool_call_id,
          );
          if (msg.status === undefined) {
            msg.content = data.output.messages[0].content;
            msg.status = data.output.messages[0].status;
            await options?.callbacks?.handlerMessageFinished?.(msg);
          }
        }
      } else {
      }
      console.log(event, tags, data);
    }
  } catch (err) {
    if (_lastMessage) {
      if (isToolMessage(_lastMessage)) {
        _lastMessage.status = ChatStatus.ERROR;
      }
      _lastMessage.additional_kwargs['error'] = err.message || err.name;
      await options?.callbacks?.handlerMessageError?.(_lastMessage);
    }
    throw err;
  }
};
