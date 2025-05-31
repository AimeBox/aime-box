import tokenCounter from '@/main/utils/tokenCounter';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  isSystemMessage,
  isToolMessage,
  ToolMessage,
} from '@langchain/core/messages';

type MessageType =
  | 'init'
  | 'tool'
  | 'user'
  | 'assistant'
  | 'task'
  | 'plan'
  | 'agent'
  | 'action'
  | 'handoff';

interface MessageMetadata {
  type: MessageType;
  tokens: number;
  name?: string;
  inMemory?: boolean;
}

export class MessageHistory {
  messages: { message: BaseMessage; metadata: MessageMetadata }[] = [];

  totalTokens: number = 0;

  addMessage(
    message: BaseMessage,
    metadata?: MessageMetadata,
    position?: number,
  ) {
    if (position === undefined) {
      this.messages.push({ message, metadata });
    } else {
      this.messages.splice(position, 0, { message, metadata });
    }
    this.totalTokens += metadata.tokens;
  }

  removeMessage(position: number = -1) {
    let index = position;
    if (index < 0) {
      index = this.messages.length + index;
    }
    if (this.messages[index].metadata?.tokens)
      this.totalTokens -= this.messages[index].metadata.tokens;
    this.messages.splice(index, 1);
  }

  removeAllFromTypeMessage(messageType: MessageType) {
    const messages = this.messages.filter(
      (message) => message.metadata.type === messageType,
    );
    this.totalTokens -= messages.reduce(
      (acc, message) => acc + message.metadata.tokens,
      0,
    );
    this.messages = this.messages.filter(
      (message) => message.metadata.type !== messageType,
    );
  }
}

export class MessageManager {
  llm: BaseChatModel;

  summaryLLM?: BaseChatModel;

  task: string;

  maxInputTokens: number;

  history: MessageHistory;

  toolId: string = '0';

  constructor(props: {
    llm: BaseChatModel;
    summaryLLM?: BaseChatModel;
    task?: string;
    maxInputTokens?: number;
    history?: MessageHistory;
    config?: {
      messagesKeepConfig: Record<
        MessageType,
        {
          maxCount?: number;
          cutMode?: 'remove' | 'summary';
          inMemory?: boolean;
        }
      >;
    };
  }) {
    const { llm, task, maxInputTokens = 128000, history } = props;
    this.history = new MessageHistory();
    if (history) {
      Object.assign(this.history, history);
      this.toolId = history.messages
        .filter((x) => isToolMessage(x.message))
        .length.toString();
    }
    this.llm = llm;
    this.task = task;
    this.maxInputTokens = maxInputTokens;
  }

  async addTaskMessage(task: string) {
    this.task = task;

    const message = new HumanMessage(task);
    const tokenCount = await this.countTokens(message);
    const index = this.history.messages.findIndex(
      (x) => x.metadata.type === 'task',
    );
    if (index >= 1) {
      this.history.removeMessage(index);
    }
    this.history.addMessage(
      message,
      {
        type: 'task',
        tokens: tokenCount,
      },
      1,
    );
  }

  async addMessage(
    message: BaseMessage,
    position?: number,
    messageType?: MessageType,
    name?: string,
    inMemory?: boolean,
  ) {
    const tokenCount = await this.countTokens(message);
    this.history.addMessage(
      message,
      {
        type: messageType,
        name,
        tokens: tokenCount,
        inMemory,
      },
      position,
    );
  }

  getMessagesWithMetadata(
    withOutType?: MessageType[],
  ): { message: BaseMessage; metadata: MessageMetadata }[] {
    if (withOutType && withOutType.length > 0) {
      return this.history.messages.filter(
        (message) => !withOutType.includes(message.metadata.type),
      );
    }
    const msg = this.history.messages;
    return msg;
  }

  getMessages(withOutType?: MessageType[]): BaseMessage[] {
    if (withOutType && withOutType.length > 0) {
      return this.history.messages
        .filter((message) => !withOutType.includes(message.metadata.type))
        .map((message) => message.message);
    }
    const msg = this.history.messages.map((message) => message.message);
    return msg;
  }

  removeAllFromTypeMessage(messageType: MessageType) {
    this.history.removeAllFromTypeMessage(messageType);
  }

  countTokens(message: BaseMessage): Promise<number> {
    return tokenCounter([message], this.llm);
  }

  removeLastMessage() {
    this.history.removeMessage();
  }

  async addToolMessage(
    content: string | ToolMessage,
    messageType?: MessageType,
  ): Promise<void> {
    if (typeof content === 'string') {
      await this.addMessage(
        new ToolMessage(content, this.toolId.toString()),
        undefined,
        messageType,
      );
      this.toolId = (parseInt(this.toolId, 10) + 1).toString();
    } else if (content instanceof ToolMessage) {
      await this.addMessage(content, undefined, messageType);
    }
  }

  lastMessage(): BaseMessage {
    return this.history.messages[this.history.messages.length - 1].message;
  }

  cutMessages() {
    const { messages } = this.history;
    const { totalTokens } = this.history;
    const maxTokens = this.maxInputTokens;
    if (totalTokens > maxTokens) {
    }
    return messages;
  }
}
