import tokenCounter from '@/main/utils/tokenCounter';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';

type MessageType = 'init' | 'tool' | 'user' | 'assistant';

interface MessageMetadata {
  type: MessageType;
  tokens: number;
}

class MessageHistory {
  messages: { message: BaseMessage; metadata: MessageMetadata }[];
  totalTokens: number;

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
    this.messages.splice(position, 1);
    this.totalTokens -= this.messages[position].metadata.tokens;
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
  }) {
    const { llm, task, maxInputTokens = 128000 } = props;
    this.history = new MessageHistory();
    this.llm = llm;
    this.task = task;
    this.maxInputTokens = maxInputTokens;
  }

  addTaskMessage(task: string) {
    this.task = task;
    const sys_index = this.history.messages.findIndex(
      (x) => x.message.getType() == 'system',
    );
    this.history.addMessage(new HumanMessage(task), undefined, sys_index);
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

  getMessages(): BaseMessage[] {
    return this.history.messages.map((message) => message.message);
  }

  countTokens(message: BaseMessage): Promise<number> {
    return tokenCounter([message], this.llm);
  }

  removeLastMessage() {
    this.history.removeMessage();
  }

  addToolMessage(content: string, messageType?: MessageType) {
    this.addMessage(
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
    const messages = this.history.messages;
    const totalTokens = this.history.totalTokens;
    const maxTokens = this.maxInputTokens;
    if (totalTokens > maxTokens) {
    }
    return messages;
  }
}
