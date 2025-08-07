import {
  IpcMainEvent,
  dialog,
  ipcMain,
  ipcRenderer,
  BrowserWindow,
  app,
  IpcMainInvokeEvent,
  shell,
} from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { concat } from '@langchain/core/utils/stream';

// import AppDataSource from '../../data-source';

import { In, Like, Repository } from 'typeorm';
import * as fs from 'node:fs/promises';
import ExcelJS, { config } from 'exceljs';
import {
  BaseMessage,
  SystemMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
  isAIMessage,
  isToolMessage,
  ToolMessageChunk,
  isHumanMessage,
} from '@langchain/core/messages';
import { parse } from 'csv-parse';
import type { DocumentInterface } from '@langchain/core/documents';
import {
  Chat,
  ChatFile,
  ChatMessage,
  ChatOptions,
  ChatStatus,
} from '../../entity/Chat';
import { Providers } from '../../entity/Providers';
import { chatWithAdvancedRagAgent } from '../agents/rag/AdvancedRagAgent';
import { getChatModel } from '../llm';
import {
  ChatInputAttachment,
  ChatInputExtend,
  ChatMode,
} from '../../types/chat';
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
import { notificationManager } from '../app/NotificationManager';
import { BaseTool } from '../tools/BaseTool';
import { KnowledgeBaseQuery } from '../tools/KnowledgeBaseQuery';
import { getDataPath } from '../utils/path';
import {
  createReactAgent,
  createAgentExecutor,
} from '@langchain/langgraph/prebuilt';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { Agent } from '@/entity/Agent';
import { AgentExecutor } from 'langchain/agents';
import { writeFile } from 'node:fs/promises';
import { runAgent } from './runAgent';
import {
  Command,
  CompiledStateGraph,
  InMemoryStore,
  MessagesAnnotation,
  Pregel,
  StateDefinition,
  StateGraph,
  StateSnapshot,
  StateType,
} from '@langchain/langgraph';
import { isArray, isString } from '../utils/is';
import { LanggraphCheckPoints, LanggraphWrites } from '@/entity/CheckPoints';
import { removeThinkTags } from '../utils/messages';
// const repository = dbManager.dataSource.getRepository(Chat);

export interface ChatInfo extends Chat {
  totalToken?: number;
  inputToken?: number;
  outputToken?: number;
  status: 'running' | 'idle' | string;
  agentName?: string;
}

export class ChatManager {
  chatRepository: Repository<Chat>;

  agentRepository: Repository<Agent>;

  chatFileRepository: Repository<ChatFile>;

  chatMessageRepository: Repository<ChatMessage>;

  providersRepository: Repository<Providers>;

  runningTasks: Map<string, AbortController> = new Map();

  constructor() {
    this.chatRepository = dbManager.dataSource.getRepository(Chat);
    this.chatFileRepository = dbManager.dataSource.getRepository(ChatFile);
    this.chatMessageRepository =
      dbManager.dataSource.getRepository(ChatMessage);
    this.providersRepository = dbManager.dataSource.getRepository(Providers);
  }

  async init() {
    this.agentRepository = dbManager.dataSource.getRepository(Agent);
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
      (
        event,
        chatId: string,
        title: string,
        model: string,
        options?: ChatOptions,
      ) => this.updateChat(event, chatId, title, model, options),
    );
    ipcMain.handle('chat:delete', (event, chatId: string) =>
      this.deleteChat(event, chatId),
    );
    ipcMain.on(
      'chat:chat-resquest',
      async (
        event,
        input: {
          chatId: string;
          content: string;
          extend: any;
          config: any;
          is_hidden_message?: boolean;
        },
      ) => {
        const res = await this.chatResquest(
          input.chatId,
          input.content,
          input.extend,
          input.is_hidden_message,
          (key, value) => {
            event.sender.send(key, value);
          },
        );
        event.returnValue = res;
      },
    );
    ipcMain.handle(
      'chat:chat-file-create',
      async (
        event,
        input: { chatId: string; files: ChatInputAttachment[] },
      ) => {
        await this.chatFileCreate(input.chatId, input.files);
      },
    );
    ipcMain.handle(
      'chat:chat-file-update',
      async (event, input: { chatFileId: string; data: any }) => {
        await this.chatFileUpdate(input.chatFileId, input.data);
      },
    );
    ipcMain.handle('chat:cancel', (event, chatId: string) =>
      this.cancelChat(chatId),
    );

    ipcMain.on(
      'chat:delete-chatmessage',
      async (event, chatMessageId: string) => {
        event.returnValue = await this.onDeleteMessage(chatMessageId);
      },
    );
    ipcMain.handle('chat:openWorkspace', async (event, chatId: string) =>
      this.openWorkspace(chatId),
    );
    ipcMain.handle(
      'chat:update-chatmessage',
      async (
        event,
        chatMessageId: string,
        content: string,
        additional_kwargs?: Record<string, any>,
      ) => {
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
          if (additional_kwargs) res.additional_kwargs = additional_kwargs;

          await this.chatMessageRepository.save(res);
        }
        return res;
      },
    );
    ipcMain.handle(
      'chat:getChatPage',
      (
        event,
        input: {
          filter?: string;
          skip: number;
          pageSize: number;
          sort?: string | undefined;
        },
      ) => this.getChatPage(input),
    );
    ipcMain.handle('chat:get-chat', (event, input: { chatId: string }) =>
      this.getChat(input.chatId),
    );
    ipcMain.handle(
      'chat:export',
      (
        event,
        type: string,
        chatId: string,
        input: { savePath: string; image?: string },
      ) => {
        if (type == 'image') {
          this.exportImage(chatId, input.savePath, input.image);
        }
      },
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
    ipcMain.handle('chat:clear', (event, chatId: string) =>
      this.clearChat(chatId),
    );
    ipcMain.handle(
      'chat:split-multi-line',
      async (event, input: { msg: string }) => {
        try {
          return await this.splitMultiLine(input.msg);
        } catch {
          return undefined;
        }
      },
    );
  }

  public async createChat(model: string, mode: ChatMode, agentName?: string) {
    const data = new Chat(uuidv4(), 'New Chat', model, mode, agentName);

    if (agentName) {
      const agent = await agentManager.getAgent(agentName);
      if (agent) {
        data.message_edit_enable = !agent.fixedThreadId;
      }
    }

    const res = await this.chatRepository.save(data);
    return res;
  }

  public async updateChat(
    event: IpcMainInvokeEvent,
    chatId: string,
    title: string,
    model: string,
    options?: ChatOptions,
  ) {
    const _chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });
    if (_chat) {
      if (title) {
        if (_chat.title != title) {
          _chat.title = title;
          event.sender.send(`chat:title-changed`, _chat);
        }
      }
      if (model) {
        _chat.model = model;
      }
      if (options) {
        _chat.options = { ...(_chat.options || {}), ...options };
      }
      const res = await this.chatRepository.save(_chat);
      event.sender.send(`chat:changed:${chatId}`, _chat);
      return res;
    }
    return undefined;
  }

  public async deleteChat(event: IpcMainInvokeEvent, chatId: string) {
    await this.clearChat(chatId);
    const res = await this.chatRepository.delete(chatId);
    return res;
  }

  public async getChatPage(input: {
    filter?: string;
    skip: number;
    pageSize: number;
    sort?: string | undefined;
  }): Promise<{ items: ChatInfo[]; totalCount: number }> {
    let sortField = '';
    let order: 'ASC' | 'DESC' = 'ASC';
    if (input.sort) {
      if (input.sort.split(' ').length === 2) {
        sortField = input.sort.split(' ')[0] as string;
        if (input.sort.split(' ')[1].toLowerCase() === 'desc') order = 'DESC';
      } else {
        sortField = input.sort;
      }
    }

    const res = await this.chatRepository.find({
      where: input.filter ? { title: Like(`%${input.filter}%`) } : undefined,
      skip: input.skip,
      take: input.pageSize,
      order: { [sortField]: order },
    });
    const agentIds = new Set(res.map((x) => x.agent));
    const agents = await this.agentRepository.find({
      where: { id: In(Array.from(agentIds)) },
    });

    const totalCount = await this.chatRepository.count({
      where: input.filter ? { title: Like(`%${input.filter}%`) } : undefined,
    });
    return {
      items: res.map((x) => ({
        ...x,
        agentName: agents.find((y) => y.id == x.agent)?.name,
        status: this.runningTasks.has(x.id) ? 'running' : 'idle',
      })),
      totalCount,
    };
  }

  public async getChat(chatId: string): Promise<ChatInfo> {
    const res = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: { chatMessages: true, chatFiles: true },
    });

    const totalToken = res.chatMessages
      .map((x) => x.total_tokens)
      .reduce((acc, curr) => acc + curr, 0);
    const inputToken = res.chatMessages
      .map((x) => x.input_tokens)
      .reduce((acc, curr) => acc + curr, 0);
    const outputToken = res.chatMessages
      .map((x) => x.output_tokens)
      .reduce((acc, curr) => acc + curr, 0);

    if (res.chatMessages.length > 50) {
      res.chatMessages = res.chatMessages.slice(-50);
    }

    const output = {
      ...res,
      status: this.runningTasks.has(chatId) ? 'running' : 'idle',
      totalToken: totalToken,
      inputToken: inputToken,
      outputToken: outputToken,
    };
    return output;
  }

  public async autoGenerationTitle(chat: Chat, content: string) {
    const prompt = `Create a concise, 3-5 word phrase as a header for the following query, strictly adhering to the 3-5 word limit and avoiding the use of the word 'title'`;
    chat.options = undefined;
    const defaultTitleLLM = settingsManager.getSettings()?.defaultTitleLLM;
    if (defaultTitleLLM) {
      try {
        const { provider, modelName } = getProviderModel(defaultTitleLLM);
        const llm = await getChatModel(provider, modelName, {
          temperature: 0,
        });

        const res = await llm.invoke([
          new SystemMessage({ content: prompt }),
          new HumanMessage({ content: content }),
        ]);
        let res_content: string | undefined = res?.content?.toString();
        if (res_content) {
          res_content = removeThinkTags(res_content);
        }
        return res_content?.trim().replace('\n', '');
      } catch (err) {
        console.error(err);
      }
    }

    return content?.substring(0, 20);
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
          res.content.find((x) => x.type == 'text')!.text +=
            `\n\n<${attachment.type}>${attachment.path}</${attachment.type}>`;
        } else if (attachment.type == 'file' && attachment.ext == '.mp4') {
          // res.content.push({
          //   type: 'video_path',
          //   video_path: attachment.path,
          // });
          res.content.find((x) => x.type == 'text')!.text +=
            `\n\n<${attachment.type}>${attachment.path}</${attachment.type}>`;
        } else if (attachment.type == 'file' || attachment.type == 'folder') {
          res.content.find((x) => x.type == 'text')!.text +=
            `\n\n<${attachment.type}>${attachment.path}</${attachment.type}>`;
          // res.content.push(attachment);
        }
      }
    }
    return res;
  }

  public async chatResquest(
    chatId: string,
    content: string,
    extend: ChatInputExtend,
    is_hidden_message?: boolean = false,
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
        const message = this.toLangchainMessage([chatMessage]);
        messages.push(...message);

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
    insertData.is_hidden = is_hidden_message || false;
    insertData.is_llm_message = true;

    await this.chatMessageRepository.save(insertData);
    let lastMesssageId = insertData.id;
    const lastMesssage = new HumanMessage({
      id: insertData.id,
      content: input_content.content,
    });
    messages.push(lastMesssage);

    const headHistory = [] as BaseMessage[];
    if (chat.options) {
      // if (chat.options.allwaysClear) {
      //   messages = [];
      // }
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

    messages = [...headHistory, ...messages].filter(
      (x) => x.content || isToolMessage(x),
    );

    event(`chat:message-changed:${chatId}`, insertData);
    chat.status = 'running';
    event(`chat:start`, chat);
    const controller = new AbortController();

    this.runningTasks.set(chatId, controller);

    const callbacks = {
      handleMessageCreated: async (
        message: AIMessage | ToolMessage | HumanMessage,
      ) => {
        let role;
        if (isAIMessage(message)) {
          role = 'assistant';
        } else if (isToolMessage(message)) {
          role = 'tool';
        } else if (isHumanMessage(message)) {
          role = 'user';
        }
        let msg;
        if (role == 'user') {
          msg = new ChatMessage(
            message.id,
            lastMesssageId,
            chat,
            modelName,
            role,
            isString(message.content)
              ? [{ type: 'text', text: message.content }]
              : message.content,
            ChatStatus.SUCCESS,
          );
        } else {
          const _content = isString(message.content)
            ? [
                {
                  type: 'text',
                  text: message.content,
                },
              ]
            : message.content;
          if (role == 'tool') {
            _content[0].tool_call_id = (message as ToolMessage).tool_call_id;
            _content[0].type = 'tool_call';
          }

          msg = new ChatMessage(
            message.id,
            lastMesssageId,
            chat,
            modelName,
            role,
            _content,
            ChatStatus.RUNNING,
          );
        }

        msg.additional_kwargs = message.additional_kwargs;
        msg.provider_type = message.additional_kwargs[
          'provider_type'
        ] as string;
        msg.model = (message.additional_kwargs['model'] as string) || 'Unknown';
        msg.name = message.name;
        msg = await this.chatMessageRepository.save(msg);
        lastMesssageId = msg.id;
        event(`chat:message-changed:${chatId}`, msg);
      },
      handleMessageUpdate: async (message: BaseMessage) => {
        const msg = await this.chatMessageRepository.findOne({
          where: { id: message.id, chatId: chatId },
          relations: { chat: true },
        });

        if (!msg) return;
        if (isString(message.content)) {
          msg.content = [{ type: 'text', text: message.content }];
        } else {
          msg.content = message.content;
        }
        await this.chatMessageRepository.manager.save(msg);

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
          where: { id: message.id, chatId: chatId },
          relations: { chat: true },
        });

        if (!msg) return;

        if (isAIMessage(message)) {
          msg.content = [{ type: 'text', text: message.content }];
          msg.tool_calls = message?.tool_calls || [];
        } else if (isToolMessage(message)) {
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
        for (const additional_kwarg of Object.keys(message.additional_kwargs)) {
          msg.additional_kwargs[additional_kwarg] =
            message.additional_kwargs[additional_kwarg];
        }
        msg.status = message.additional_kwargs['error']
          ? ChatStatus.ERROR
          : ChatStatus.SUCCESS;
        msg.error_msg = message.additional_kwargs['error'] as
          | string
          | undefined;
        msg.time_cost = new Date().getTime() - msg.timestamp;
        msg.timestamp = new Date().getTime();
        if (isAIMessage(message)) {
          msg.setUsage(message.usage_metadata);
        }
        await this.chatMessageRepository.manager.save(msg);
        event(`chat:message-finish:${chatId}`, msg);
        lastMesssageId = msg.id;
        messages.push(message);
      },
      handleMessageError: async (message: AIMessage | ToolMessage) => {
        const msg = await this.chatMessageRepository.findOne({
          where: { id: message.id },
          relations: { chat: true },
        });
        msg.error_msg = message.additional_kwargs['error'] as string;
        if (isToolMessage(message)) {
          msg.content = [
            {
              type: 'tool_call',
              text: msg.error_msg,
              tool_call_id: message.tool_call_id,
              tool_call_name: message.name,
              status: message.status,
            },
          ];
        } else if (isAIMessage(message)) {
          msg.content = [
            {
              type: 'text',
              text: message.content,
            },
          ];
        }

        msg.status = ChatStatus.ERROR;
        await this.chatMessageRepository.manager.save(msg);
        event(`chat:message-changed:${chatId}`, msg);
      },
    };
    await fs.mkdir(this.getChatPath(chatId), { recursive: true });
    try {
      if (chat.mode == 'agent' && chat.agent) {
        // agent 模式
        const agent = await agentManager.getAgent(chat.agent);
        if (agent.type == 'supervisor') {
          await this.chatSupervisor(agent, messages, {
            providerModel: chat.model,
            options: chat.options,
            callbacks,
            signal: controller.signal,
            configurable: { workspace: this.getChatPath(chatId), chatId },
          });
        } else if (agent.type == 'react') {
          await this.chatReact(agent, messages, {
            providerModel: chat.model,
            options: chat.options,
            callbacks,
            signal: controller.signal,
            configurable: { workspace: this.getChatPath(chatId), chatId },
          });
        } else if (agent.type == 'built-in') {
          await this.chatBuiltIn(agent, messages, {
            chatId,
            providerModel: chat.model,
            options: chat.options,
            callbacks,
            signal: controller.signal,
            fixedThreadId: agent.fixedThreadId,
            configurable: {
              workspace: this.getChatPath(chatId),
              thread_id: agent.fixedThreadId === true ? chatId : undefined,
              recursionLimit:
                agent.config?.recursionLimit || agent?.recursionLimit || 25,
              chatId,
            },
          });

          event(`chat:changed:${chatId}`, chat);
        } else if (agent.type == 'anp' || agent.type == 'a2a') {
          await this.chatRemoteAgent(agent, messages, {
            providerModel: chat.model,
            options: chat.options,
            callbacks,
            signal: controller.signal,
            configurable: { workspace: this.getChatPath(chatId), chatId },
          });
        }
      } else {
        // 普通chat模式
        await this.chat(
          chat.model,
          messages,
          chat.options,
          callbacks,
          controller.signal,
          { workspace: this.getChatPath(chatId) },
        );
      }
    } catch (err) {
      notificationManager.sendNotification(err.message, 'error');
      const msgs = await this.chatMessageRepository.find({
        where: { chatId: chatId, status: ChatStatus.RUNNING },
      });

      for (const m of msgs) {
        m.status = ChatStatus.ERROR;
        m.additional_kwargs['error'] = err.message;
      }
      await this.chatMessageRepository.save(msgs);

      if (err.message == 'Aborted') {
        const aborted_msg = new ChatMessage(
          uuidv4(),
          lastMesssageId,
          chat,
          modelName,
          'user',
          [{ type: 'text', text: '[Request interrupted by user]' }],
          ChatStatus.SUCCESS,
        );
        aborted_msg.is_hidden = true;
        await this.chatMessageRepository.save(aborted_msg);
      }

      console.error(err);
    }
    if (chat?.options?.allwaysClear === true) {
      const msg = await this.chatMessageRepository.findOne({
        where: { chatId: chatId },
        relations: { chat: true },
        order: { timestamp: 'DESC' },
      });
      if (msg) {
        msg.divider = true;
        await this.chatMessageRepository.save(msg);
        event(`chat:message-changed:${chatId}`, msg);
      }
    }
    if (controller) {
      this.runningTasks.delete(chatId);
      event(`chat:changed:${chatId}`, chat);
    }
    console.info('chat end');
    chat.status = 'idle';
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

  getChatPath(chatId: string) {
    return path.join(getDataPath(), 'chats', chatId);
  }

  public async chatFileCreate(chatId: string, files: ChatInputAttachment[]) {
    const chat = await this.getChat(chatId);
    if (chat.mode != 'file') {
      notificationManager.sendNotification('Chat mode is not file', 'error');
      return;
    }
    await fs.mkdir(this.getChatPath(chatId), { recursive: true });

    const chatFiles = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const chatFile = new ChatFile(uuidv4(), chatId, file);
      chatFiles.push(chatFile);
    }
    await this.chatFileRepository.save(chatFiles);
  }

  public async chatFileUpdate(chatFileId: string, data: any) {
    const chatFile = await this.chatFileRepository.findOne({
      where: { id: chatFileId },
    });
    if (chatFile) {
      const _chatFile = { ...chatFile, ...data };
      await this.chatFileRepository.save(_chatFile);
    }
  }

  public async buildTools(options?: ChatOptions) {
    let tools = [] as BaseTool[];
    // if (options?.agentNames && options?.agentNames.length > 0) {
    //   const agents = agentManager.agents.filter((x) =>
    //     options?.agentNames.includes(x.info.name),
    //   );
    //   tools.push(...agents.map((x) => x.agent));
    // }

    if (options?.toolNames && options?.toolNames.length > 0) {
      tools.push(...(await toolsManager.buildTools(options?.toolNames)));
    }
    if (options?.kbList && options?.kbList.length > 0) {
      const kbq = new KnowledgeBaseQuery({ knowledgebaseIds: options.kbList });
      tools = tools.filter((x) => x.name != kbq.name);
      tools.push(kbq);
    }
    return tools;
  }

  public async chat(
    providerModel: string,
    messages: BaseMessage[],
    options?: ChatOptions | undefined,
    callbacks?: any | undefined,
    signal?: AbortSignal | undefined,
    configurable?: Record<string, any> | undefined,
  ) {
    const handlerMessageCreated = callbacks?.['handleMessageCreated'];
    const handlerMessageUpdate = callbacks?.['handleMessageUpdate'];
    const handlerMessageFinished = callbacks?.['handleMessageFinished'];
    const handlerMessageStream = callbacks?.['handleMessageStream'];
    const handlerMessageError = callbacks?.['handleMessageError'];

    const tools = await this.buildTools(options);
    const { provider, modelName } = getProviderModel(providerModel);
    const providerInfo = await providersManager.getProviders();
    const providerType = providerInfo.find((x) => x.name == provider)?.type;
    const llm = await getChatModel(provider, modelName, options);

    //const checkpointer = dbManager.langgraphSaver;
    const reactAgent = createReactAgent({
      llm: llm,
      tools,
      //prompt: options?.system,
      //checkpointer: checkpointer,
    });
    await runAgent(reactAgent, messages, {
      signal,
      configurable,
      modelName,
      providerType,
      callbacks: {
        handlerMessageCreated,
        handlerMessageUpdate,
        handlerMessageFinished,
        handlerMessageStream,
        handlerMessageError,
      },
    });
  }

  public async chatBuiltIn(
    agent: Agent,
    messages: BaseMessage[],
    config: {
      chatId: string;
      providerModel: string;
      options?: ChatOptions | undefined;
      callbacks?: any | undefined;
      signal?: AbortSignal | undefined;
      configurable?: Record<string, any> | undefined;
      fixedThreadId?: boolean;
    },
  ) {
    const { provider, modelName } = getProviderModel(
      config?.providerModel || agent.model,
    );
    const providerInfo = await providersManager.getProviders();
    const providerType = providerInfo.find((x) => x.name == provider)?.type;

    const handlerMessageCreated = config.callbacks?.['handleMessageCreated'];
    const handlerMessageUpdate = config.callbacks?.['handleMessageUpdate'];
    const handlerMessageFinished = config.callbacks?.['handleMessageFinished'];
    const handlerMessageStream = config.callbacks?.['handleMessageStream'];
    const handlerMessageError = config.callbacks?.['handleMessageError'];

    const _agent = await agentManager.buildAgent({
      agent,
      store: new InMemoryStore(),
      model: config?.providerModel || agent.model,
      chatOptions: config.options,
      messageEvent: {
        created: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageCreated?.(x);
            }),
          );
        },
        updated: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageUpdate?.(x);
            }),
          );
        },
        finished: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageFinished?.(x);
            }),
          );
        },
      },
      signal: config.signal,
      configurable: config.configurable,
    });
    let _messages = messages;
    let state: StateSnapshot | undefined;
    if (config.fixedThreadId === true) {
      state = await _agent.getState({
        configurable: { thread_id: config.chatId },
      });
      const { values } = state;
      _messages = [];
      if (values.messages) {
        _messages = [...values.messages];
      }
      _messages.push(messages.pop());
      //_messages = [_messages.pop()];
    }

    await runAgent(_agent, _messages, {
      signal: config.signal,
      configurable: config.configurable,
      modelName,
      providerType,
      state,
      recursionLimit:
        agent.config?.recursionLimit || agent?.recursionLimit || 25,
      callbacks: {
        handlerMessageCreated,
        handlerMessageFinished,
        handlerMessageStream,
        handlerMessageError,
      },
    });
  }

  public async chatSupervisor(
    agent: Agent,
    messages: BaseMessage[],
    config: {
      providerModel: string;
      options?: ChatOptions | undefined;
      callbacks?: any | undefined;
      signal?: AbortSignal | undefined;
      configurable?: Record<string, any> | undefined;
    },
  ) {
    const { provider, modelName } = getProviderModel(
      config?.providerModel || agent.model,
    );
    const providerInfo = await providersManager.getProviders();
    const providerType = providerInfo.find((x) => x.name == provider)?.type;

    const model = await getChatModel(provider, modelName, config?.options);
    const workflow = await agentManager.buildAgent({
      agent,
      store: new InMemoryStore(),
      model: config?.providerModel,
    });
    const handlerMessageCreated = config?.callbacks?.['handleMessageCreated'];
    //const handlerMessageUpdated = callbacks?.['handleMessageUpdated'];
    const handlerMessageFinished = config?.callbacks?.['handleMessageFinished'];
    const handlerMessageStream = config?.callbacks?.['handleMessageStream'];
    const handlerMessageError = config?.callbacks?.['handleMessageError'];

    await runAgent(workflow, messages, {
      signal: config?.signal,
      configurable: config?.configurable,
      modelName,
      providerType,
      recursionLimit: agent.recursionLimit,
      callbacks: {
        handlerMessageCreated,
        handlerMessageFinished,
        handlerMessageStream,
        handlerMessageError,
      },
    });
  }

  public async chatReact(
    agent: Agent,
    messages: BaseMessage[],
    config: {
      providerModel: string;
      options?: ChatOptions | undefined;
      callbacks?: any | undefined;
      signal?: AbortSignal | undefined;
      configurable?: Record<string, any> | undefined;
    },
  ) {
    const handlerMessageCreated = config?.callbacks?.['handleMessageCreated'];
    //const handlerMessageUpdated = callbacks?.['handleMessageUpdated'];
    const handlerMessageFinished = config?.callbacks?.['handleMessageFinished'];
    const handlerMessageStream = config?.callbacks?.['handleMessageStream'];
    const handlerMessageError = config?.callbacks?.['handleMessageError'];

    const { provider, modelName } = getProviderModel(
      config?.providerModel || agent.model,
    );
    const providerInfo = await providersManager.getProviders();
    const providerType = providerInfo.find((x) => x.name == provider)?.type;
    const tools = await toolsManager.buildTools(agent?.tools);

    const model = await getChatModel(provider, modelName, config?.options);
    const reactAgent = await agentManager.buildAgent({
      agent,
      store: new InMemoryStore(),
      model: config?.providerModel,
    });

    await runAgent(reactAgent, messages, {
      signal: config?.signal,
      configurable: config?.configurable,
      modelName,
      providerType,
      recursionLimit: agent.recursionLimit,
      callbacks: {
        handlerMessageCreated,
        handlerMessageFinished,
        handlerMessageStream,
        handlerMessageError,
      },
    });
  }

  public async chatRemoteAgent(
    agent: Agent,
    messages: BaseMessage[],
    config: {
      providerModel: string;
      options?: ChatOptions | undefined;
      callbacks?: any | undefined;
      signal?: AbortSignal | undefined;
      configurable?: Record<string, any> | undefined;
    },
  ) {
    const handlerMessageCreated = config?.callbacks?.['handleMessageCreated'];
    const handlerMessageUpdate = config?.callbacks?.['handleMessageUpdate'];
    const handlerMessageFinished = config?.callbacks?.['handleMessageFinished'];
    const handlerMessageStream = config?.callbacks?.['handleMessageStream'];
    const handlerMessageError = config?.callbacks?.['handleMessageError'];

    const { provider, modelName } = getProviderModel(
      config?.providerModel || agent.model,
    );
    const providerInfo = await providersManager.getProviders();
    const providerType = providerInfo.find((x) => x.name == provider)?.type;
    // const tools = await toolsManager.buildTools(agent?.tools);

    const model = await getChatModel(provider, modelName, config?.options);
    const reactAgent = await agentManager.buildAgent({
      agent,
      store: new InMemoryStore(),
      model: config?.providerModel,
      messageEvent: {
        created: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageCreated?.(x);
            }),
          );
        },
        updated: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageUpdate?.(x);
            }),
          );
        },
        finished: async (msg) => {
          await Promise.all(
            msg.map(async (x) => {
              await handlerMessageFinished?.(x);
            }),
          );
        },
      },
    });

    await runAgent(reactAgent, messages, {
      signal: config?.signal,
      configurable: config?.configurable,
      modelName,
      providerType,
      recursionLimit: agent.recursionLimit,
      callbacks: {
        handlerMessageCreated,
        handlerMessageFinished,
        handlerMessageStream,
        handlerMessageError,
      },
    });
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
        if (x.content) {
          let content;
          if (isArray(x.content)) {
            content = x.content.filter((z) => z.type != 'file');
          } else {
            content = x.content;
          }
          list.push(new HumanMessage({ id: x.id, content }));
        }
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

  public async exportImage(chatId: string, savePath: string, image: string) {
    const chat = await this.getChat(chatId);
    const chatMessages = await this.chatMessageRepository.find({
      where: { chat: { id: chatId } },
    });
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows.length > 0 ? windows[0] : null;
    const res = await dialog.showSaveDialog(mainWindow as BrowserWindow, {
      title: `Export Image`,
      defaultPath: `${chat.title}.jpg`,
    });
    if (!res || res.canceled || !res.filePath) {
      return;
    }
    const _savePath = res.filePath;

    const _image = image.substring(image.indexOf(',') + 1);
    const imageBuffer = Buffer.from(_image, 'base64');
    await writeFile(_savePath, imageBuffer);
  }

  public async clearChat(chatId: string) {
    const messages = await this.chatMessageRepository.find({
      where: { chatId: chatId },
    });
    await this.chatMessageRepository.remove(messages);

    const checkPoints =
      await dbManager.dataSource.getRepository(LanggraphCheckPoints);
    const writes = await dbManager.dataSource.getRepository(LanggraphWrites);

    await checkPoints.delete({ thread_id: chatId });

    await writes.delete({ thread_id: chatId });

    const workspace = path.join(getDataPath(), 'chats', chatId);
    try {
      if ((await fs.stat(workspace)).isDirectory()) {
        await fs.rm(workspace, { recursive: true });
      }
    } catch {}
  }

  public async onDeleteMessage(chatMessageId: string) {
    const message = await this.chatMessageRepository.findOne({
      where: { id: chatMessageId },
    });
    if (message) {
      const delMsg = [message];
      if (message.role == 'assistant') {
        const { tool_calls } = message;
        if (tool_calls && tool_calls.length > 0) {
          const tool_messages = await this.chatMessageRepository.find({
            where: { chatId: message.chatId, role: 'tool' },
          });
          for (const tool_call of tool_calls) {
            for (const tool_message of tool_messages) {
              if (
                tool_message.content.find((x) => x.tool_call_id == tool_call.id)
              )
                delMsg.push(tool_message);
            }
          }
        }
      }
      await this.chatMessageRepository.remove(delMsg);
    }
  }

  public async openWorkspace(chatId: string) {
    const workspace = path.join(getDataPath(), 'chats', chatId);
    try {
      if ((await fs.stat(workspace)).isDirectory()) {
        await shell.openPath(workspace);
      }
    } catch {}
  }
}

export const chatManager = new ChatManager();
