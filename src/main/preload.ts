// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  OpenDialogOptions,
} from 'electron';
import { Chat, ChatOptions } from '../entity/Chat';
import { Providers } from '../entity/Providers';
import { ToolInfo } from './tools';
import {
  KnowledgeBaseCreateInput,
  KnowledgeBaseDocument,
  KnowledgeBaseItemChunk,
  KnowledgeBaseUpdateInput,
} from './knowledgebase';
import { GlobalSettings } from './settings';
import { ChatInputAsset, ChatInputExtend, ChatMode } from '@/types/chat';
import { Prompt, PromptGroup } from '@/entity/Prompt';

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
    showOpenDialog: (arg: OpenDialogOptions) =>
      ipcRenderer.invoke('app:showOpenDialog', arg),
    info: () => ipcRenderer.sendSync('app:info'),
    setTheme: (theme: 'system' | 'light' | 'dark') =>
      ipcRenderer.sendSync('app:setTheme', theme),
    clipboard: (text: string) => ipcRenderer.sendSync('app:clipboard', text),
    tts: (text: string) => ipcRenderer.send('app:tts', text),
    resetTTS: () => ipcRenderer.invoke('app:resetTTS'),
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
    create: (
      mode: ChatMode,
      providerModel?: string,
      agentName?: string,
    ): Promise<Chat | undefined> =>
      ipcRenderer.invoke('chat:create', mode, providerModel, agentName),
    update: (chat: Chat): Promise<Chat> =>
      ipcRenderer.invoke('chat:update', chat),
    export(input: { chatId: string; savePath: string }) {
      const res = ipcRenderer.sendSync('chat:export', input);
      return res;
    },
    getChat: (chatId: string) =>
      ipcRenderer.invoke('chat:get-chat', { chatId }),
    chatResquest(input: {
      chatId: string;
      content: string;
      extend: ChatInputExtend | any | undefined;
    }) {
      ipcRenderer.send('chat:chat-resquest', input);
    },
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
      ipcRenderer.sendSync('settings:deleteLocalModel', task, model),
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
    getList: (refresh: boolean = false): Promise<Providers[]> =>
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
    getInfo(filter: string | undefined = undefined): ToolInfo[] {
      const res = ipcRenderer.sendSync('tools:getInfo', filter);
      return res as ToolInfo[];
    },
    update(input) {
      const res = ipcRenderer.sendSync('tools:update', input);
      return res;
    },
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
  },
  agents: {
    getList(filter?: string) {
      const res = ipcRenderer.sendSync('agent:getList', filter);
      return res;
    },
    update: (name: string, config: any) =>
      ipcRenderer.invoke('agent:update', name, config),
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
    get(id: String) {
      const res = ipcRenderer.sendSync('plugins:get', id);
      return res;
    },
    getList() {
      const res = ipcRenderer.sendSync('plugins:getList');
      return res;
    },
    reload() {
      ipcRenderer.sendSync('plugins:reload');
    },
    setEnable(id: String, enable: boolean) {
      ipcRenderer.sendSync('plugins:setEnable', id, enable);
    },
    import(path: String) {
      ipcRenderer.sendSync('plugins:import', path);
    },
    delete(id: String) {
      ipcRenderer.sendSync('plugins:delete', id);
    },
    callSync(methodName: string, ...args: any[]) {
      const res = ipcRenderer.sendSync('plugins:callSync', methodName, ...args);
      return res;
    },
    call(methodName: string, ...args: any[]) {
      ipcRenderer.sendSync('plugins:call', methodName, ...args);
    },
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
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
