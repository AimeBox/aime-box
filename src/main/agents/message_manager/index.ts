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
  | 'agent';

interface MessageMetadata {
  type: MessageType;
  tokens: number;
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
    this.totalTokens -= this.messages[position].metadata.tokens;
    this.messages.splice(position, 1);
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
  ) {
    const tokenCount = await this.countTokens(message);
    this.history.addMessage(
      message,
      {
        type: messageType,
        tokens: tokenCount,
      },
      position,
    );
  }

  getMessages(withOutType?: MessageType[]): BaseMessage[] {
    if (withOutType && withOutType.length > 0) {
      return this.history.messages
        .filter((message) => !withOutType.includes(message.metadata.type))
        .map((message) => message.message);
    }
    return this.history.messages.map((message) => message.message);
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
    content: string,
    messageType?: MessageType,
  ): Promise<void> {
    await this.addMessage(
      new ToolMessage(content, this.toolId.toString()),
      undefined,
      messageType,
    );
    this.toolId = (parseInt(this.toolId, 10) + 1).toString();
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
