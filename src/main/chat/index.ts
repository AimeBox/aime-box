import {
  IpcMainEvent,
  dialog,
  ipcMain,
  ipcRenderer,
  BrowserWindow,
  app,
} from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { concat } from '@langchain/core/utils/stream';

// import AppDataSource from '../../data-source';

import { Repository } from 'typeorm';
import * as fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {
  BaseMessage,
  SystemMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { parse } from 'csv-parse';
import type { DocumentInterface } from '@langchain/core/documents';
import { Chat, ChatMessage, ChatOptions, ChatStatus } from '../../entity/Chat';
import { Providers } from '../../entity/Providers';
import { chatWithReActAgent } from '../agents/react/ReActAgent';
import { chatWithAdvancedRagAgent } from '../agents/rag/AdvancedRagAgent';
import { getChatModel } from '../llm';
import { ChatInputExtend, ChatMode } from '../../types/chat';
import { chatWithReWOOAgent } from '../agents/rewoo/ReWOOAgent';
import providersManager from '../providers';
import { toolsManager } from '../tools';
import { chatWithPlanExecuteAgent } from '../agents/plan_execute/PlanExecuteAgent';
import { chatWithStormAgent } from '../agents/storm/StormAgent';
import { dbManager } from '../db';
import path from 'node:path';
import { chatWithToolCallingAgent } from '../agents/tool_callling/ToolCallingAgent';
import settingsManager from '../settings';
import {
  CallbackManagerForLLMRun,
  Callbacks,
} from '@langchain/core/callbacks/manager';
import { handler } from 'tailwindcss-animate';
import { agentManager } from '../agents';
import { getProviderModel } from '../utils/providerUtil';
import { Serialized } from '@langchain/core/dist/load/serializable';
import { notificationManager } from '../app/NotificationManager';
// const repository = dbManager.dataSource.getRepository(Chat);

export class ChatManager {
  chatRepository: Repository<Chat>;

  chatMessageRepository: Repository<ChatMessage>;

  providersRepository: Repository<Providers>;

  runningTasks: Map<string, AbortController> = new Map();

  constructor() {
    this.chatRepository = dbManager.dataSource.getRepository(Chat);
    this.chatMessageRepository =
      dbManager.dataSource.getRepository(ChatMessage);
    this.providersRepository = dbManager.dataSource.getRepository(Providers);
  }

  async init() {
    await this.chatMessageRepository.update(
      {
        status: ChatStatus.RUNNING,
      },
      {
        status: ChatStatus.ERROR,
        error_msg: 'cancel',
      },
    );

    if (!ipcMain) return;
    ipcMain.handle(
      'chat:create',
      async (
        event,
        mode: ChatMode,
        providerModel?: string,
        agentName?: string,
      ) => await this.createChat(providerModel, mode, agentName),
    );
    ipcMain.handle(
      'chat:update',
      (event, chatId: string, title: string, model: string) =>
        this.updateChat(chatId, title, model),
    );
    ipcMain.on(
      'chat:chat-resquest',
      async (
        event,
        input: { chatId: string; content: string; extend: any; config: any },
      ) => {
        const res = await this.chatResquest(
          input.chatId,
          input.content,
          input.extend,
          (key, value) => {
            event.sender.send(key, value);
          },
        );
        event.returnValue = res;
      },
    );
    ipcMain.handle('chat:cancel', (event, chatId: string) =>
      this.cancelChat(chatId),
    );

    ipcMain.on(
      'chat:delete-chatmessage',
      async (event, chatMessageId: string) => {
        event.returnValue =
          await this.chatMessageRepository.delete(chatMessageId);
      },
    );
    ipcMain.on(
      'chat:update-chatmessage',
      async (event, chatMessageId: string, content: string) => {
        const res = await this.chatMessageRepository.findOne({
          where: { id: chatMessageId },
        });
        if (res) {
          const index = res.content.findIndex((x) =>
            Object.keys(x).includes('text'),
          );
          if (index > -1) {
            res.content[index].text = content;
          } else {
            res.content.unshfit({ type: 'text', text: content });
          }

          await this.chatMessageRepository.save(res);
        }
        event.returnValue = res;
      },
    );
    ipcMain.handle('chat:get-chat', (event, input: { chatId: string }) =>
      this.getChat(input.chatId),
    );

    ipcMain.on(
      'chat:export',
      async (event, input: { chatId: string; savePath: string }) => {
        const res = await this.chatRepository.findOne({
          where: { id: input.chatId },
          relations: { chatMessages: true },
        });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        worksheet.columns = [
          { header: 'id', key: 'id' },
          { header: 'model', key: 'model' },
          { header: 'role', key: 'role' },
          { header: 'content', key: 'content' },
          { header: 'timestamp', key: 'timestamp' },
          { header: 'error_msg', key: 'error_msg' },
        ];
        res.chatMessages.forEach((chatMessage) => {
          worksheet.addRow({
            id: chatMessage.id,
            model: chatMessage.model,
            role: chatMessage.role,
            content: chatMessage?.content?.content.find((x) => x.type == 'text')
              ?.text,
            timestamp: chatMessage.timestamp,
            error_msg: chatMessage.error_msg,
          });
        });
        await workbook.xlsx.writeFile(input.savePath);
        event.returnValue = undefined;
      },
    );
    ipcMain.on(
      'chat:split-multi-line',
      async (event, input: { msg: string }) => {
        try {
          event.returnValue = await this.splitMultiLine(input.msg);
        } catch {
          event.returnValue = undefined;
        }
      },
    );
  }

  public async createChat(model: string, mode: ChatMode, agentName?: string) {
    const data = new Chat(uuidv4(), 'New Chat', model, mode, agentName);
    const res = await this.chatRepository.save(data);
    return res;
  }

  public async updateChat(chatId: string, title: string, model: string) {
    const _chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });
    if (_chat) {
      _chat.title = title;
      _chat.model = model;
      const res = await this.chatRepository.save(_chat);
      return res;
    }
    return undefined;
  }

  public async getChat(chatId: string) {
    const res = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: { chatMessages: true },
    });
    const output = {
      ...res,
      status: this.runningTasks.has(chatId) ? 'running' : 'idle',
    };
    return output;
  }

  public async autoGenerationTitle(chat: Chat, content: string) {
    const prompt = `Create a concise, 3-5 word phrase as a header for the following query, strictly adhering to the 3-5 word limit and avoiding the use of the word 'title': ${content}`;
    chat.options = undefined;
    const defaultTitleLLM = settingsManager.getSettings()?.defaultTitleLLM;
    if (defaultTitleLLM) {
      try {
        const res = await this.chat(defaultTitleLLM, [
          new HumanMessage({ content: prompt }),
        ]);
        if (res?.status == ChatStatus.SUCCESS) return res?.content;
      } catch (err) {
        console.error(err);
      }
    }

    return content?.substring(0, 19);
  }

  async getContent(
    content: string,
    extend: ChatInputExtend | undefined = undefined,
  ) {
    let res;
    if (typeof content == 'string') {
      res = { content: [{ type: 'text', text: content }] };
    }
    if (extend && extend.attachments) {
      const { attachments } = extend;

      for (let index = 0; index < attachments.length; index++) {
        const attachment = attachments[index];
        if (
          attachment.type == 'file' &&
          (attachment.ext == '.jpg' ||
            attachment.ext == '.png' ||
            attachment.ext == '.jpeg')
        ) {
          const imageData = await fs.readFile(attachment.path);
          res.content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/${attachment.ext.substring(
                1,
              )};base64,${imageData.toString('base64')}`,
            },
          });
        } else if (attachment.type == 'file' && attachment.ext == '.mp4') {
          res.content.push({
            type: 'video_path',
            video_path: attachment.path,
          });
        } else {
          res.content.push({ type: attachment.type, path: attachment.path });
        }
      }
    }
    return res;
  }

  public async chatResquest(
    chatId: string,
    content: string,
    extend: ChatInputExtend,
    event: Function,
  ) {
    const chat = await this.getChat(chatId);
    const chatMessages = chat?.chatMessages;
    let parentId = null;
    let isFirst = true;
    let messages = [] as BaseMessage[];
    if (chatMessages.length > 0) {
      parentId = chatMessages[chatMessages.length - 1].id;
      isFirst = false;

      for (let index = 0; index < chatMessages.length; index++) {
        const chatMessage = chatMessages[index];
        if (chatMessage.status == ChatStatus.SUCCESS) {
          const message = this.toLangchainMessage([chatMessage]);
          messages.push(...message);
        }

        if (chatMessage.divider) {
          messages = [];
        }
      }
    }

    const input_content = await this.getContent(content, extend);
    if (!chat.model) {
      notificationManager.sendNotification('Model is not set', 'error');
      return;
    }
    const { modelName, provider: providerName } = getProviderModel(chat.model);
    const provider = await this.providersRepository.findOne({
      where: { name: providerName },
    });
    if (!provider) {
      notificationManager.sendNotification('Provider is not set', 'error');
      return;
    }

    if (chat.mode == 'agent' && chat.agent) {
      const agent = agentManager.agents.find((x) => x.info.name == chat.agent);
      const insertData = new ChatMessage(
        uuidv4(),
        parentId,
        chat,
        modelName,
        'user',
        input_content.content,
        ChatStatus.SUCCESS,
      );

      await this.chatMessageRepository.save(insertData);
      event(`chat:message-changed:${chatId}`, insertData);
      const chatMessageResponeId = uuidv4();
      let insertResponeData = new ChatMessage(
        chatMessageResponeId,
        insertData.id,
        chat,
        modelName,
        'assistant',
        [],
        ChatStatus.RUNNING,
      );
      //insertResponeData.provider_type = provider?.type;
      await this.chatMessageRepository.manager.save(insertResponeData);
      event(`chat:message-changed:${chatId}`, insertResponeData);
      let output = '';
      try {
        const res = await agent.agent.stream(content);

        for await (const chunk of res) {
          output += chunk;
          event(`chat:message-stream:${chatId}`, {
            chatId,
            chatMessageId: insertResponeData.id,
            content: output,
          });
        }
        insertResponeData.content = [
          {
            type: 'text',
            text: output,
          },
        ];
        insertResponeData.status = ChatStatus.SUCCESS;
        await this.chatMessageRepository.manager.save(insertResponeData);
        event(`chat:message-changed:${chatId}`, insertResponeData);
      } catch (err) {
        insertResponeData.content = [
          {
            type: 'text',
            text: output,
          },
        ];
        insertResponeData.error_msg = err.message;
        insertResponeData.status = ChatStatus.ERROR;
        await this.chatMessageRepository.manager.save(insertResponeData);
        event(`chat:message-changed:${chatId}`, insertResponeData);
      }

      return;
    }

    const res = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: { chatMessages: true },
    });

    const insertData = new ChatMessage(
      uuidv4(),
      parentId,
      chat,
      modelName,
      'user',
      input_content.content,
      ChatStatus.SUCCESS,
    );

    await this.chatMessageRepository.save(insertData);
    let lastMesssageId = insertData.id;
    const lastMesssage = new HumanMessage({
      id: insertData.id,
      content: input_content.content,
    });
    messages.push(lastMesssage);

    const headHistory = [] as BaseMessage[];
    if (chat.options) {
      if (chat.options.allwaysClear) {
        messages = [];
      }
      if (chat.options?.system) {
        headHistory.push(
          new SystemMessage({ id: uuidv4(), content: chat.options?.system }),
        );
      }
      if (chat.options?.history && chat.options?.history.length > 0) {
        chat.options?.history.forEach((h) => {
          if (h.role == 'user') {
            headHistory.push(
              new HumanMessage({ id: uuidv4(), content: h.content }),
            );
          } else if (h.role == 'assistant') {
            headHistory.push(
              new AIMessage({ id: uuidv4(), content: h.content }),
            );
          }
        });
      }
    }

    messages = [...headHistory, ...messages].filter((x) => x.content);

    event(`chat:message-changed:${chatId}`, insertData);
    event(`chat:start`, chat);
    const controller = new AbortController();
    this.runningTasks.set(chatId, controller);
    try {
      await this.chat(
        chat.model,
        messages,
        chat.options,
        {
          handleMessageCreated: async (message: AIMessage | ToolMessage) => {
            let msg = new ChatMessage(
              message.id,
              lastMesssageId,
              chat,
              modelName,
              message instanceof ToolMessage ? 'tool' : 'assistant',
              [{ type: 'text', text: message.content }],
              ChatStatus.RUNNING,
            );
            msg.provider_type =
              message instanceof AIMessage ? provider?.type : undefined;
            msg = await this.chatMessageRepository.save(msg);
            lastMesssageId = msg.id;
            event(`chat:message-changed:${chatId}`, msg);
          },
          handleMessageStream: async (message: AIMessage | ToolMessage) => {
            event(`chat:message-stream:${chatId}`, {
              chatId,
              chatMessageId: message.id,
              content: message.content,
            });
          },
          handleMessageFinished: async (message: AIMessage | ToolMessage) => {
            const msg = await this.chatMessageRepository.findOne({
              where: { id: message.id },
              relations: { chat: true },
            });
            if (message instanceof AIMessage) {
              msg.content = [{ type: 'text', text: message.content }];
              msg.tool_calls = message?.tool_calls || [];
            } else if (message instanceof ToolMessage) {
              msg.content = [
                {
                  type: 'tool_call',
                  text: message.content?.toString()?.trim(),
                  tool_call_id: message.tool_call_id,
                  tool_call_name: message.name,
                  status: message.status,
                },
              ];
            }
            msg.status = message.additional_kwargs['error']
              ? ChatStatus.ERROR
              : ChatStatus.SUCCESS;
            msg.error_msg = message.additional_kwargs['error'] as
              | string
              | undefined;
            msg.timestamp = new Date().getTime();
            msg.setUsage(message.usage_metadata);
            await this.chatMessageRepository.manager.save(msg);
            event(`chat:message-finish:${chatId}`, msg);
            lastMesssageId = msg.id;
            messages.push(message);
          },
        },
        controller.signal,
      );
    } catch (err) {
      console.error(err);
    }

    if (controller) {
      this.runningTasks.delete(chatId);
    }
    event(`chat:end`, chat);

    if (isFirst) {
      const title = await this.autoGenerationTitle(chat, content);
      const _chat = await this.chatRepository.findOne({
        where: { id: chatId },
        relations: { chatMessages: true },
      });
      _chat.title = title as string;
      await this.chatRepository.save(_chat);
      event(`chat:title-changed`, _chat);
      event(`chat:changed:${chatId}`, _chat);
    }
  }

  public async chat(
    providerModel: string,
    messages: BaseMessage[],
    // content: string | any[],
    // history: any[] | undefined,
    options?: ChatOptions | undefined,
    callbacks?: any | undefined,
    //streamCallback?: any | undefined,
    signal?: AbortSignal | undefined,
  ) {
    const handlerMessageCreated = callbacks?.['handleMessageCreated'];
    //const handlerMessageUpdated = callbacks?.['handleMessageUpdated'];
    const handlerMessageFinished = callbacks?.['handleMessageFinished'];
    const handlerMessageStream = callbacks?.['handleMessageStream'];
    const handlerMessageError = callbacks?.['handleMessageError'];
    const aiMessage = new AIMessage({ id: uuidv4(), content: '' });
    if (handlerMessageCreated) await handlerMessageCreated(aiMessage);

    let gathered;
    try {
      const { provider, modelName } = getProviderModel(providerModel);

      const llm = await getChatModel(provider, modelName, options);
      if (options?.streaming === undefined || options?.streaming) {
        const stream = await llm.stream(messages, { signal });

        for await (const chunk of stream) {
          gathered = gathered !== undefined ? concat(gathered, chunk) : chunk;
          aiMessage.content = gathered.content;
          if (handlerMessageStream) await handlerMessageStream(aiMessage);
        }
      } else {
        gathered = await llm.invoke(messages, { signal });
      }
      if (gathered?.additional_kwargs?.reasoning_content) {
        gathered.content = `<think>\n${gathered?.additional_kwargs?.reasoning_content}\n</think>\n\n${
          gathered.content
        }`;
      }
      aiMessage.content = gathered.content;
      aiMessage.tool_calls = gathered.tool_calls;
      aiMessage.usage_metadata = gathered.usage_metadata;
    } catch (err) {
      aiMessage.additional_kwargs['error'] = err.message;
      if (handlerMessageError) await handlerMessageError(aiMessage);
    } finally {
      if (handlerMessageFinished) await handlerMessageFinished(aiMessage);
      //messages.push(aiMessage);
    }

    if (gathered.tool_calls && gathered.tool_calls.length > 0) {
      const tool_calls = gathered.tool_calls as any[];
      for (let index = 0; index < tool_calls.length; index++) {
        const tool_call = tool_calls[index];
        const { name, type, id, args } = tool_call;
        const tool =
          toolsManager.tools.find((x) => x.tool.name == name)?.tool ||
          agentManager.agents.find((x) => x.info.name == name)?.agent;

        if (tool) {
          const toolMessage = new ToolMessage({
            id: uuidv4(),
            tool_call_id: id,
            name: name,
            content: '',
            status: undefined,
          });
          if (handlerMessageCreated) await handlerMessageCreated(toolMessage);

          let output = '';
          try {
            const tool_res = await tool.stream(args, {
              signal: signal,
            });

            for await (const chunk of tool_res) {
              output += chunk;
              toolMessage.content = output;
              if (handlerMessageStream) await handlerMessageStream(toolMessage);
            }

            toolMessage.status = ChatStatus.SUCCESS;
            toolMessage.content = output;
            toolMessage.tool_call_id = id;
          } catch (err) {
            toolMessage.content = output;
            toolMessage.status = ChatStatus.ERROR;
            toolMessage.additional_kwargs['error'] = err.message;
          } finally {
            if (handlerMessageFinished)
              await handlerMessageFinished(toolMessage);
            //messages.push(toolMessage);
          }
        }
      }
      await this.chat(providerModel, messages, options, callbacks, signal);
    }

    console.log('usage', gathered.usage_metadata);
    const response = {
      // modelName,
      role: 'assistant',
      content: gathered.content,
      tool_calls: gathered.tool_calls,
      status: ChatStatus.SUCCESS,
      timestamp: new Date().getTime(),
      usage_metadata: gathered.usage_metadata,
    };
    return response;
  }

  public async cancelChat(chatId: string) {
    const controller = this.runningTasks.get(chatId);
    if (controller) {
      controller.abort('cancel');
    }
  }

  public toLangchainMessage(messages: ChatMessage[]): BaseMessage[] {
    const list = [];
    messages.forEach((x) => {
      if (x.role == 'system') {
        list.push(new SystemMessage({ id: x.id, content: x.content }));
      } else if (x.role == 'assistant') {
        list.push(
          new AIMessage({
            id: x.id,
            content: x.content,
            tool_calls: x.tool_calls,
          }),
        );
      } else if (x.role == 'user') {
        if (x.content)
          list.push(new HumanMessage({ id: x.id, content: x.content }));
      } else if (x.role == 'tool') {
        const tool_call = x.content.find((x) => x.type == 'tool_call');
        if (
          tool_call &&
          (x.status == ChatStatus.SUCCESS || x.status == ChatStatus.ERROR)
        ) {
          list.push(
            new ToolMessage({
              id: x.id,
              tool_call_id: tool_call.tool_call_id,
              content: tool_call.text,
              status: tool_call.status,
            }),
          );
        }
      }
    });
    return list;
  }

  public splitMultiLine = (msg: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      parse(
        msg,
        {
          trim: true,
          columns: false, // 指定列标题
          skip_empty_lines: true, // 跳过空行})
          quote: '"',
          delimiter: '\t',
          relax_quotes: true,
        },
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const list = [];
            for (let index = 0; index < rows.length; index++) {
              const row = rows[index];
              list.push(row.join('\t'));
            }

            resolve(list);
          }
        },
      );
    });
  };
}

export const chatManager = new ChatManager();
