// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  OpenDialogOptions,
  SaveDialogOptions,
  webUtils,
} from 'electron';
import { Chat } from '../entity/Chat';
import { Providers } from '../entity/Providers';
import { McpServerInfo, ToolInfo } from './tools';
import {
  KnowledgeBaseCreateInput,
  KnowledgeBaseDocument,
  KnowledgeBaseItemChunk,
  KnowledgeBaseUpdateInput,
} from './knowledgebase';
import { GlobalSettings } from './settings';
import { ChatInputAttachment, ChatInputExtend, ChatMode } from '@/types/chat';
import { Prompt, PromptGroup } from '@/entity/Prompt';
import { ChatInfo } from './chat';
import { get } from 'http';
import { Instances } from '@/entity/Instances';
import { ProviderInfo } from './providers';

const electronHandler = {
  ipcRenderer: {
    send(channel: string, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    sendSync(channel: string, ...args: unknown[]) {
      const res = ipcRenderer.sendSync(channel, ...args);
      return res;
    },
    on(channel: string, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    removeListener(channel: string, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.removeListener(channel, subscription);
    },
    removeAllListeners: (channel: string) =>
      ipcRenderer.removeAllListeners(channel),
    listenerCount: (channel: string) => {
      return ipcRenderer.listenerCount(channel);
    },
  },
  app: {
    getPathForFile: (file: File) => {
      return webUtils.getPathForFile(file);
    },
    showSaveDialog: (arg: SaveDialogOptions) =>
      ipcRenderer.invoke('app:showSaveDialog', arg),
    showOpenDialog: (
      arg: OpenDialogOptions,
    ): Promise<
      { ext: string; name: string; path: string; type: 'file' | 'folder' }[]
    > => ipcRenderer.invoke('app:showOpenDialog', arg),
    info: () => ipcRenderer.sendSync('app:info'),
    setTheme: (theme: 'system' | 'light' | 'dark') =>
      ipcRenderer.sendSync('app:setTheme', theme),
    clipboard: (text: string) => ipcRenderer.invoke('app:clipboard', text),
    tts: (text: string) => ipcRenderer.send('app:tts', text),
    resetTTS: () => ipcRenderer.invoke('app:resetTTS'),
    openPath: (path: string) => ipcRenderer.invoke('app:openPath', path),
    showItemInFolder: (path: string) =>
      ipcRenderer.invoke('app:showItemInFolder', path),
    trashItem: (path: string) => ipcRenderer.invoke('app:trashItem', path),
    startDrag: (filePath: string) =>
      ipcRenderer.send('app:startDrag', filePath),
    getPathInfo: (paths: string[]): Promise<ChatInputAttachment[]> =>
      ipcRenderer.invoke('app:getPathInfo', paths),
  },
  db: {
    insert(tableName: string, data: any) {
      const res = ipcRenderer.sendSync('db:insert', tableName, data);
      return res;
    },
    update(tableName: string, data: any[], condition: any) {
      const res = ipcRenderer.sendSync('db:update', tableName, data, condition);
      return res;
    },
    delete(tableName: string, condition: any) {
      const res = ipcRenderer.sendSync('db:delete', tableName, condition);
      return res;
    },
    query<T>(query: string, params: any | null = null) {
      const res = ipcRenderer.sendSync('db:query', query, params);
      return res as T[];
    },
    get<T>(
      tableName: string,
      id: string | number,
      relations: string[] | null = null,
    ) {
      const res = ipcRenderer.sendSync('get', tableName, id, relations);
      return res as T;
    },
    getMany<T>(
      tableName: string,
      where: any,
      sort: string | undefined | null = null,
    ) {
      const res = ipcRenderer.sendSync('db:getMany', tableName, where, sort);
      return res as T[];
    },
    page<T>(
      tableName: string,
      where: object,
      skip: number,
      pageSize: number,
      sort: string | undefined | null = null,
    ) {
      const res = ipcRenderer.sendSync(
        'db:page',
        tableName,
        where,
        skip,
        pageSize,
        sort,
      );
      return { items: res.items, totalCount: res.totalCount } as {
        items: T[];
        totalCount: number;
      };
    },
  },
  chat: {
    openWorkspace: (chatId: string) =>
      ipcRenderer.invoke('chat:openWorkspace', chatId),
    getChatPage: (input: {
      filter?: string;
      skip: number;
      pageSize: number;
      sort?: string | undefined;
    }): Promise<{
      items: ChatInfo[];
      totalCount: number;
    }> => ipcRenderer.invoke('chat:getChatPage', input),
    create: (
      mode: ChatMode,
      providerModel?: string,
      agentName?: string,
    ): Promise<Chat | undefined> =>
      ipcRenderer.invoke('chat:create', mode, providerModel, agentName),
    update: (
      chatId: string,
      title: string,
      model: string,
      options,
    ): Promise<Chat> =>
      ipcRenderer.invoke('chat:update', chatId, title, model, options),
    delete: (chatId: string) => ipcRenderer.invoke('chat:delete', chatId),
    export: async (
      type: string,
      chatId: string,
      input: { savePath?: string; image?: string },
    ) => {
      const res = await ipcRenderer.invoke('chat:export', type, chatId, input);
      return res;
    },
    getChat: (chatId: string): Promise<ChatInfo> =>
      ipcRenderer.invoke('chat:get-chat', { chatId }),
    chatResquest(input: {
      chatId: string;
      content: string;
      extend: ChatInputExtend | any | undefined;
    }) {
      ipcRenderer.send('chat:chat-resquest', input);
    },
    chatFileCreate: (input: { chatId: string; files: ChatInputAttachment[] }) =>
      ipcRenderer.invoke('chat:chat-file-create', input),
    chatFileUpdate: (input: { chatFileId: string; data: any }) =>
      ipcRenderer.invoke('chat:chat-file-update', input),
    cancel: (chatId: string) => ipcRenderer.invoke('chat:cancel', chatId),
    chatResquestSync(input: {
      chatId: string;
      content: string;
      extend: any | undefined;
    }) {
      const res = ipcRenderer.sendSync('chat:chat-resquest', input);
      return res;
    },
    updateChatMessage(chatMessageId: string, content: string) {
      const res = ipcRenderer.sendSync(
        'chat:update-chatmessage',
        chatMessageId,
        content,
      );
      return res;
    },
    deleteChatMessage(chatMessageId: string) {
      const res = ipcRenderer.sendSync(
        'chat:delete-chatmessage',
        chatMessageId,
      );
      return res;
    },
    splitMultiLine(msg: string): string[] {
      const res = ipcRenderer.sendSync('chat:split-multi-line', { msg });
      return res;
    },
  },
  setting: {
    set: (key: string, value: any) =>
      ipcRenderer.sendSync('settings:set', key, value),
    get<T>(key: string) {
      const res = ipcRenderer.sendSync('settings:get', 'settings', key);
      return res as T;
    },
    getSettings: (): GlobalSettings =>
      ipcRenderer.sendSync('settings:getSettings'),
    getForm() {
      const res = ipcRenderer.sendSync('getForm');
      return res;
    },
    setForm(form) {
      const res = ipcRenderer.sendSync('setForm', form);
      return res;
    },
    setProxy: (proxy: string) =>
      ipcRenderer.sendSync('settings:setProxy', proxy),
    getLocalModels: () => ipcRenderer.sendSync('settings:getLocalModels'),
    downloadModel: (task, model) =>
      ipcRenderer.send('settings:downloadModel', task, model),
    deleteLocalModel: (task, model) =>
      ipcRenderer.invoke('settings:deleteLocalModel', task, model),
  },
  store: {
    get(key: string) {
      return ipcRenderer.sendSync('get-store', key);
    },
    set(key: string, value: any) {
      ipcRenderer.sendSync('set-store', key, value);
    },
    delete(key: string) {
      ipcRenderer.sendSync('remove-store', key);
    },
  },
  providers: {
    getProviderType: () => ipcRenderer.invoke('providers:getProviderType'),
    getList: (refresh: boolean = false): Promise<ProviderInfo[]> =>
      ipcRenderer.invoke('providers:getProviders', refresh),
    delete: (id: string) => ipcRenderer.invoke('providers:delete', id),
    createOrUpdate: (input: Providers) =>
      ipcRenderer.invoke('providers:createOrUpdate', input),
    getModels: (id: string) => ipcRenderer.invoke('providers:getModels', id),
    getLLMModels: () => ipcRenderer.invoke('providers:getLLMModels'),
    getEmbeddingModels: () =>
      ipcRenderer.invoke('providers:getEmbeddingModels'),
    getRerankerModels: () => ipcRenderer.invoke('providers:getRerankerModels'),
    getDefaultLLM: () => ipcRenderer.invoke('providers:getDefaultLLM'),
    getTTSModels: () => ipcRenderer.invoke('providers:getTTSModels'),
    getSTTModels: () => ipcRenderer.invoke('providers:getSTTModels'),
    getWebSearchProviders: () =>
      ipcRenderer.invoke('providers:getWebSearchProviders'),
    getImageGenerationProviders: () =>
      ipcRenderer.invoke('providers:getImageGenerationProviders'),
  },
  kb: {
    save(pathOrUrl: string) {
      const res = ipcRenderer.sendSync('kb:save', pathOrUrl);
      return res;
    },
    create(input: KnowledgeBaseCreateInput) {
      const res = ipcRenderer.sendSync('kb:create', input);
      return res;
    },
    update(id: string, input: KnowledgeBaseUpdateInput) {
      const res = ipcRenderer.sendSync('kb:update', id, input);
      return res;
    },
    delete(kbId: string) {
      const res = ipcRenderer.sendSync('kb:delete', kbId);
      return res;
    },
    deleteItem(kbItemId: string | string[]) {
      const res = ipcRenderer.sendSync('kb:delete-item', kbItemId);
      return res;
    },
    queue(input: { kbId: string; config: Record<string, any> }) {
      ipcRenderer.send('kb:queue', input);
    },
    query: (kbId: string, query: string, options: Record<string, any>) =>
      ipcRenderer.invoke('kb:query', kbId, query, options),
    getItem(kbItemId: string): {
      pageContent: string;
      metadata: any;
      chunks: KnowledgeBaseItemChunk[];
    } {
      const res = ipcRenderer.sendSync('kb:get-item', kbItemId);
      return res;
    },
    updateItem(input: { kbItemId: string; data: any }) {
      const res = ipcRenderer.sendSync('kb:update-item', input);
      return res;
    },

    get(input) {
      const res = ipcRenderer.sendSync('kb:get', input);
      return res;
    },
    restart(kbId: string) {
      ipcRenderer.send('kb:restart', kbId);
    },
  },
  tools: {
    getList: (
      filter: string | undefined = undefined,
      type: 'all' | 'built-in' | 'mcp' = 'all',
    ): Promise<ToolInfo[]> => ipcRenderer.invoke('tools:getList', filter, type),
    getMcpList: (
      filter: string | undefined = undefined,
    ): Promise<McpServerInfo[]> =>
      ipcRenderer.invoke('tools:getMcpList', filter),
    update: (toolName, args) =>
      ipcRenderer.invoke('tools:update', toolName, args),
    invoke: (
      toolName: string,
      args: any,
      outputFormat: 'default' | 'markdown' = 'default',
    ) => ipcRenderer.invoke('tools:invoke', toolName, args, outputFormat),
    invokeAsync: (
      toolName: string,
      args: any,
      outputFormat: 'default' | 'markdown' = 'default',
    ) => ipcRenderer.invoke('tools:invokeAsync', toolName, args, outputFormat),
    webSearch: (
      provider: string,
      search: string,
      limit: number = 10,
      outputFormat: string = 'defalut',
    ) =>
      ipcRenderer.invoke(
        'tools:webSearch',
        provider,
        search,
        limit,
        outputFormat,
      ),
    addMcp: (data: { name: string; url: string }) =>
      ipcRenderer.invoke('tools:addMcp', data),
    deleteMcp: (name: string) => ipcRenderer.invoke('tools:deleteMcp', name),
    refreshMcp: (name: string) => ipcRenderer.invoke('tools:refreshMcp', name),
    getCodeSandboxSetup: (path: string, chatId?: string) =>
      ipcRenderer.invoke('tools:getCodeSandboxSetup', path, chatId),
  },
  agents: {
    getList(filter?: string) {
      const res = ipcRenderer.sendSync('agent:getList', filter);
      return res;
    },
    create: (data: any) => ipcRenderer.invoke('agent:create', data),
    update: (data: any) => ipcRenderer.invoke('agent:update', data),
    delete: (id: string) => ipcRenderer.invoke('agent:delete', id),
    addRemoteAgent: (data: any) =>
      ipcRenderer.invoke('agent:addRemoteAgent', data),
    invoke(llmProvider: string, name: string, input: any) {
      const res = ipcRenderer.sendSync(
        'agent:invoke',
        llmProvider,
        name,
        input,
      );
      return res;
    },
    invokeAsync(name: string, input: any) {
      ipcRenderer.send('agent:invokeAsync', name, input);
    },
  },
  plugins: {
    get: (id: string) => ipcRenderer.invoke('plugins:get', id),
    getList: () => ipcRenderer.invoke('plugins:getList'),
    delete: (id: string) => ipcRenderer.invoke('plugins:delete', id),
    reload: (id: string) => ipcRenderer.invoke('plugins:reload', id),
    setEnable: (id: string, enable: boolean) =>
      ipcRenderer.invoke('plugins:setEnable', id, enable),
    import: (path: string) => ipcRenderer.invoke('plugins:import', path),
    create: (data: any) => ipcRenderer.invoke('plugins:create', data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke('plugins:update', id, data),
  },
  explores: {
    getList() {
      const res = ipcRenderer.sendSync('explores:getList');
      return res;
    },
  },
  prompts: {
    createPrompt: (prompt: Prompt, groupId: string | undefined) =>
      ipcRenderer.invoke('prompts:createPrompt', prompt, groupId),
    updatePrompt: (prompt: Prompt) =>
      ipcRenderer.invoke('prompts:updatePrompt', prompt),
    deletePrompt: (promptId: string) =>
      ipcRenderer.invoke('prompts:deletePrompt', promptId),
    getPrompts: (
      groupId: string | undefined,
      role: string | undefined = undefined,
    ) => ipcRenderer.invoke('prompts:getPrompts', groupId, role),
    getGroups: () => ipcRenderer.invoke('prompts:getGroups'),
    createGroup: (group: PromptGroup) =>
      ipcRenderer.invoke('prompts:createGroup', group),
    updateGroup: (group: PromptGroup) =>
      ipcRenderer.invoke('prompts:updateGroup', group),
    deleteGroup: (groupId: string) =>
      ipcRenderer.invoke('prompts:deleteGroup', groupId),
  },
  instances: {
    getList: () => ipcRenderer.invoke('instances:getList'),
    get: (id: string) => ipcRenderer.invoke('instances:get', id),
    create: (instance: Instances) =>
      ipcRenderer.invoke('instances:create', instance),
    update: (id: string, instance: Instances) =>
      ipcRenderer.invoke('instances:update', id, instance),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    run: (id: string) => ipcRenderer.invoke('instances:run', id),
    stop: (id: string) => ipcRenderer.invoke('instances:stop', id),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
