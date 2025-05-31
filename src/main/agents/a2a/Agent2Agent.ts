import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  isHumanMessage,
} from '@langchain/core/messages';
import {
  Runnable,
  RunnableConfig,
  RunnableLambda,
} from '@langchain/core/runnables';
import { BaseStore } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { A2ACardResolver, A2AClient, AgentCard, Role } from 'a2a-js';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessageEvent } from '../BaseAgent';
import { ChatOptions } from '@/entity/Chat';
import { Agent } from '@/entity/Agent';
import * as fs from 'fs';
import path from 'path';
import { BaseLangChainParams } from '@langchain/core/language_models/base';
import { IterableReadableStream } from '@langchain/core/utils/stream';

class A2AChain extends Runnable<any, any, RunnableConfig> {
  //implements BaseLangChainParams

  client: A2AClient;

  agentCard: AgentCard;

  messageEvent?: AgentMessageEvent;

  constructor(params: {
    client: A2AClient;
    agentCard: AgentCard;
    messageEvent: AgentMessageEvent;
  }) {
    super();
    this.client = params.client;
    this.agentCard = params.agentCard;
    this.messageEvent = params?.messageEvent;
  }

  lc_namespace: string[] = ['a2a'];

  async invoke(input: any, config?: RunnableConfig): Promise<AIMessage> {
    const { messages } = input;
    const chatId = config?.configurable?.chatId;
    const workspace = config?.configurable?.workspace;
    const lastMessage: BaseMessage = messages[messages.length - 1];
    let role;
    let content;
    if (isHumanMessage(lastMessage)) {
      role = 'user';
      content = lastMessage.text;
    }
    const aiMessage = new AIMessage('');
    aiMessage.id = uuidv4();
    aiMessage.name = this.agentCard.name;
    await this.messageEvent?.created([aiMessage]);
    try {
      const task = await this.client.sendTask({
        id: uuidv4(),
        sessionId: chatId,
        message: {
          role: role as Role,
          parts: [{ type: 'text', text: content }],
        },
      });
      console.log(task);
      let output_content =
        task.status.state == 'completed'
          ? task.status.message.parts
              .filter((x) => x.type == 'text')
              .map((x) => x.text)
              .join('\n')
          : '';
      if (task.artifacts && task.artifacts.length > 0) {
        for (const artifact of task.artifacts) {
          if (artifact.name) {
            const text = artifact.parts[0].text;
            if (text) {
              const filePath = path.join(workspace, artifact.name);
              fs.writeFileSync(filePath, text);
              output_content += `\n<file>${filePath}</file>`;
            }
          }
        }
      }
      aiMessage.content = output_content;
      await this.messageEvent?.finished([aiMessage]);
    } catch (err) {
      aiMessage.content = '';
      aiMessage.additional_kwargs.error = err.message;
      await this.messageEvent?.finished([aiMessage]);
    }
    return aiMessage;
  }

  async stream(
    input: any,
    config?: RunnableConfig,
  ): Promise<IterableReadableStream<AIMessage>> {
    const that = this;
    async function* generateStream() {
      const aiMessage = await that.invoke(input, config);
      yield aiMessage;
    }
    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());

    return stream;
    // const { messages } = input;
    // const chatId = config?.configurable?.chatId;
    // const workspace = config?.configurable?.workspace;
    // const lastMessage: BaseMessage = messages[messages.length - 1];
    // let role;
    // let content;
    // if (isHumanMessage(lastMessage)) {
    //   role = 'user';
    //   content = lastMessage.text;
    // }
    // const aiMessage = new AIMessage('');
    // aiMessage.id = uuidv4();
    // aiMessage.name = this.agentCard.name;
    // await this.messageEvent?.created([aiMessage]);
    // try {
    //   const task = await this.client.sendTaskSubscribe({
    //     id: uuidv4(),
    //     sessionId: chatId,
    //     message: {
    //       role: role as Role,
    //       parts: [{ type: 'text', text: content }],
    //     },
    //   });
    //   for await (const chunk of task) {
    //     console.log(chunk);
    //   }
    //   // if (task.artifacts && task.artifacts.length > 0) {
    //   //   for (const artifact of task.artifacts) {
    //   //     if (artifact.name) {
    //   //       const text = artifact.parts[0].text;
    //   //       if (text) {
    //   //         const filePath = path.join(workspace, artifact.name);
    //   //         fs.writeFileSync(filePath, text);
    //   //         output_content += `\n<file>${filePath}</file>`;
    //   //       }
    //   //     }
    //   //   }
    //   // }
    //   // aiMessage.content = output_content;
    //   debugger;
    //   await this.messageEvent?.finished([aiMessage]);
    // } catch (err) {
    //   aiMessage.content = '';
    //   aiMessage.additional_kwargs.error = err.message;
    //   await this.messageEvent?.finished([aiMessage]);
    //   // return new AIMessage(err.message);
    // }
    // return null;
  }
}

export const createA2A = async (
  agent: Agent,
  params: {
    store?: BaseStore;
    model?: BaseChatModel;
    messageEvent?: AgentMessageEvent;
    chatOptions?: ChatOptions;
    signal?: AbortSignal;
    configurable?: Record<string, any>;
  },
) => {
  const client = new A2AClient(agent.remote_url, fetch);
  const agentCard = await new A2ACardResolver(agent.remote_url).getAgentCard();
  const chain = new A2AChain({
    client,
    agentCard,
    messageEvent: params.messageEvent,
  });

  return chain;
};
