import { Calculator } from '@langchain/community/tools/calculator';
import { SearchApi } from '@langchain/community/tools/searchapi';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { In, Like, Repository } from 'typeorm';
import { DuckDuckGoSearchParameters } from '@langchain/community/tools/duckduckgo_search';
import { execSync } from 'child_process';

import {
  GoogleRoutesAPI,
  GoogleRoutesAPIParams,
} from '@langchain/community/tools/google_routes';
import { TerminalTool } from './TerminalTool';
import { DateTimeTool } from './DateTimeTool';
import 'reflect-metadata';
import { dbManager } from '../db';
import Settings from '../../entity/Settings';
import { DuckDuckGoSearchTool } from './DuckDuckGoSearch';
import {
  WikipediaQueryRun,
  WikipediaQueryRunParams,
} from '@langchain/community/tools/wikipedia_query_run';
import { DallEAPIWrapper, DallEAPIWrapperParams } from '@langchain/openai';
import {
  GooglePlacesAPI,
  GooglePlacesAPIParams,
} from '@langchain/community/tools/google_places';
import { FormSchema } from '../../types/form';
import { isArray, isObject, isString, isUrl } from '../utils/is';
import * as path from 'path';
import { SocialMediaSearch } from './SocialMediaSearch';
import { FileToText } from './FileToText';
import { NodejsVM } from './NodejsVM';
import { Vectorizer } from './VectorizerAI';
import { WebLoader } from './WebLoader';
import { RemoveBackground } from './RemoveBackground';
import { SpeechToText } from './SpeechToText';
import { RapidOcrTool } from './RapidOcr';
import { SearxngSearchTool } from './SearxngSearchTool';

import { PythonInterpreterTool } from './PythonInterpreter';
import { DallE } from './DallE';
import { AskHuman } from './AskHuman';
import { Ideogram } from './Ideogram';
import {
  CreateDirectory,
  DeleteFile,
  FileRead,
  FileSystemToolKit,
  FileWrite,
  ListDirectory,
  MoveFile,
  SearchFiles,
} from './FileSystemTool';
import { Midjourney } from './Midjourney';
import { TextToSpeech } from './TextToSpeech';
import { ComfyuiTool } from './ComfyuiTool';
import { WebSearchEngine } from '@/types/webSearchEngine';
import { v4 as uuidv4 } from 'uuid';
import { WebSearchTool } from './WebSearchTool';
import { TestTool } from './TestTool';
import { z, ZodObject } from 'zod';
import { BaseTool, BaseToolKit } from './BaseTool';
import { KnowledgeBaseQuery } from './KnowledgeBaseQuery';
import fs from 'fs';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from './mcp/StdioClientTransport';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { McpServers, Tools } from '@/entity/Tools';

import {
  tool as LangchainTool,
  Tool,
  StructuredTool,
} from '@langchain/core/tools';
import { runCommand } from '../utils/exec';
import { Translate } from './Translate';
import { TavilySearchTool } from './TavilySearch';
import { UnixTimestampConvert } from './UnixTimestamp';
import { BrowserUseTool } from './BrowserUse';
import { Vision } from './Vision';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { SleepTool } from './Sleep';
import { appManager } from '../app/AppManager';
import { BraveSearchTool } from './websearch/BraveSearch';
import { ArxivTool } from './Arxiv';
import { FireCrawl } from './FireCrawl';
import { jsonSchemaToZod } from '../utils/jsonSchemaToZod';
import { BFLImageEditing, BFLImageGeneration, BFLToolkit } from './BFLToolkit';
import { ReplicateToolkit } from './ReplicateToolkit';
import { ViduToolKit } from './Vidu';
import { splitContextAndFiles } from '@/renderer/utils/ContentUtils';
import { CodeSandbox } from './CodeSandbox';
import { getDataPath } from '../utils/path';
import { BaseManager } from '../BaseManager';
import { channel } from '../ipc/IpcController';
import { ErrorTest } from './ErrorTest';
import { RedNoteToolkit } from './RedNoteToolkit';
import { MinimaxToolkit } from './MinimaxToolkit';
import { ElevenLabsToolkit } from './ElevenLabsToolkit';
import { Think } from './ThinkTool';
import { BilibiliToolkit } from './social-media/BilibiliToolkit';
import { KnowledgeBaseToolkit } from './KnowledgeBaseToolkit';
import { AutoToolToolkit } from './AutoToolkit';

export interface ToolInfo extends Tools {
  id: string;
  schema: any;
  status: 'success' | 'error' | 'pending';
  parameters: object | undefined;
  officialLink?: string | undefined;
  configSchema?: FormSchema[] | undefined;
  tags?: string[] | undefined;
  tools: ToolInfo[];
}

export interface McpServerInfo extends McpServers {
  tools: ToolInfo[];
  status: 'activated' | 'deactivated' | 'pending';
}

export class ToolsManager extends BaseManager {
  public tools: ToolInfo[];

  public builtInToolsClassType: any[] = [];

  public mcpServerInfos: McpServerInfo[] = [];

  public mcpClients: Client[] = [];

  public toolRepository: Repository<Tools>;

  public mcpServerRepository: Repository<McpServers>;

  public async registerTool(ClassType) {
    try {
      const parent = Object.getPrototypeOf(ClassType);
      if (parent?.name == BaseToolKit.name) {
        let toolKit: BaseToolKit = Reflect.construct(ClassType, []);
        let toolKitEntity = await this.toolRepository.findOne({
          where: { name: toolKit.name, is_toolkit: true },
        });
        if (!toolKitEntity) {
          toolKitEntity = new Tools(
            toolKit.name,
            toolKit.description,
            'built-in',
          );
          toolKitEntity.enabled = true;
          toolKitEntity.toolkit_name = toolKit.name;
        }
        toolKitEntity.is_toolkit = true;
        await this.toolRepository.save(toolKitEntity);

        const toolkitConfig = toolKitEntity.config ?? {};

        toolKit = Reflect.construct(ClassType, [toolkitConfig]);

        const toolKit_tools = [];

        for (const tool of toolKit.getTools()) {
          this.builtInToolsClassType.push({
            name: tool.name,
            classType: tool.constructor,
          });
          let ts = await this.toolRepository.findOne({
            where: { name: tool.name },
          });
          if (!ts) {
            ts = new Tools(tool.name, tool.description, 'built-in');
            ts.enabled = false;
            ts.toolkit_name = tool.toolKitName || tool.name;
            ts.is_toolkit = false;
            await this.toolRepository.save(ts);
          } else {
            ts.description = tool.description;
            ts.is_toolkit = false;
            await this.toolRepository.save(ts);
            const vj = ts.config ?? {};
          }
          if (this.tools.find((x) => x.name == ts.name)) {
            this.tools = this.tools.filter((x) => x.name != ts.name);
          }
          toolKit_tools.push({
            ...ts,
            id: ts.name,
            //parameters: params,
            status: 'success',
            toolkit_name: tool.toolKitName || tool.name,
            schema: zodToJsonSchema(tool.schema),
            officialLink: tool.officialLink,
            configSchema: tool.configSchema,
          } as ToolInfo);
        }
        let params;

        if (toolKit.configSchema) {
          params = {};
          toolKit.configSchema.forEach((item) => {
            params[item.field] = toolkitConfig[item.field] || item.defaultValue;
          });
        }
        this.tools.push({
          ...toolKitEntity,
          id: toolKit.name,
          parameters: params,
          status: 'success',
          toolkit_name: toolKit.name,
          officialLink: toolKit.officialLink,
          configSchema: toolKit.configSchema,
          tools: toolKit_tools,
        } as ToolInfo);
      } else {
        let ts;
        let tool: BaseTool = Reflect.construct(ClassType, []);
        this.builtInToolsClassType.push({
          name: tool.name,
          classType: ClassType,
        });
        ts = await this.toolRepository.findOne({
          where: { name: tool.name },
        });
        let params;
        if (!ts) {
          ts = new Tools(tool.name, tool.description, 'built-in');
          ts.enabled = false;
          ts.is_toolkit = false;
          ts.toolkit_name = tool.toolKitName || tool.name;

          await this.toolRepository.save(ts);
        } else {
          ts.description = tool.description;
          ts.is_toolkit = false;
          await this.toolRepository.save(ts);
          const vj = ts.config ?? {};
          if (tool.configSchema) {
            params = {};
            tool.configSchema.forEach((item) => {
              params[item.field] = vj[item.field] || item.defaultValue;
            });
          }

          // Object.keys(vj).forEach((key) => {
          //   if (Object.keys(vj).includes(key)) {
          //     params[key] = vj[key];
          //   }
          // });

          //params = { ...params, ...JSON.parse(ts.value) };
        }
        if (this.tools.find((x) => x.name == ts.name)) {
          this.tools = this.tools.filter((x) => x.name != ts.name);
        }

        if (params) {
          tool = Reflect.construct(ClassType, params ? [params] : []);
        }
        if (this.tools.find((x) => x.name == tool.name)) {
          this.tools = this.tools.filter((x) => x.name != tool.name);
        }
        this.tools.push({
          ...ts,
          id: ts.name,
          parameters: params,
          status: 'success',
          toolkit_name: tool.toolKitName || tool.name,
          schema: zodToJsonSchema(tool.schema),
          officialLink: tool.officialLink,
          configSchema: tool.configSchema,
          tags: tool?.tags || [],
        } as ToolInfo);
      }
    } catch (err) {
      // if (ts) {
      //   this.tools.push({
      //     ...ts,
      //     // parameters: params,
      //     status: 'error',
      //     // schema: zodToJsonSchema(tool.schema),
      //     // officialLink: tool.officialLink,
      //     // configSchema: tool.configSchema,
      //   } as ToolInfo);
      // }
      console.error(`register '${ClassType.name}' tool fail, ${err.message}`);
    }
  }

  public async unregisterTool(ClassType) {
    const { name } = ClassType;
    this.tools = this.tools.filter((x) => x.name != name);
  }

  @channel('tools:getList')
  public getList(
    filter: string = undefined,
    type: 'all' | 'built-in' | 'mcp' = 'all',
  ): ToolInfo[] {
    const { tools } = this;
    let list = [];

    if (type == 'all' || type == 'built-in') {
      list.push(...tools.filter((x) => x.type == 'built-in'));
    }
    if (type == 'all' || type == 'mcp') {
      for (const mcpServerInfo of this.mcpServerInfos) {
        list.push(...mcpServerInfo.tools);
      }
    }
    if (filter) {
      list = list.filter(
        (x) =>
          x.name?.toLowerCase().indexOf(filter) > -1 ||
          x.description?.toLowerCase().indexOf(filter) > -1,
      );
    }
    return list;
  }

  public buildTool = async (tool: Tools, config?: any): Promise<BaseTool> => {
    try {
      if (tool.type == 'mcp') {
        let mcpClient = this.mcpClients.find(
          (x) => x.getServerVersion().name == tool.mcp_id,
        );
        if (!mcpClient || mcpClient.transport === undefined) {
          const mcpServer = await this.mcpServerRepository.findOne({
            where: { id: tool.mcp_id },
          });
          await this.refreshMcp(mcpServer);
          mcpClient = this.mcpClients.find(
            (x) => x.getServerVersion().name == tool.mcp_id,
          );
        }
        const _tool = (await mcpClient.listTools()).tools.find(
          (x) => x.name == tool.name.split('@')[0],
        );
        console.log(_tool.inputSchema);
        const schema = jsonSchemaToZod(_tool.inputSchema);
        return LangchainTool(
          async (input): Promise<string> => {
            const result = {};

            // 遍历输入对象的所有属性
            for (const key in input) {
              if (Object.prototype.hasOwnProperty.call(input, key)) {
                // 如果值是空字符串，则设置为undefined
                result[key] = input[key] === '' ? undefined : input[key];
              }
            }
            try {
              const res = await mcpClient.callTool(
                {
                  name: _tool.name,
                  arguments: result,
                },
                undefined,
                {
                  timeout: 1000 * 60 * 60,
                },
              );
              if (res.content instanceof String) {
                return res.content.toString();
              } else if (res.content instanceof Array) {
                const item = res.content.find((x) => x.type == 'text');
                if (item) {
                  return item.text;
                } else {
                  return null;
                }
              }
            } catch (err) {
              console.error(err);
              throw new Error(err.message);
            }
            return '';
          },
          {
            name: _tool.name,
            description: _tool.description,
            schema: schema,
          },
        );
      } else if (tool.type == 'built-in') {
        const toolkit = this.tools.find(
          (x) => x.tools?.find((t) => t.id == tool.name) && x.is_toolkit,
        );

        if (!toolkit) {
          const params = config || tool.config ? [tool.config] : [];
          const baseTool = Reflect.construct(
            this.builtInToolsClassType.find((x) => x.name == tool.name)
              .classType,
            params,
          ) as BaseTool;

          return baseTool;
        } else {
          const _tool = toolkit.tools.find((x) => x.id == tool.name);
          const params = config || toolkit.config ? [toolkit.config] : [];
          const baseTool = Reflect.construct(
            this.builtInToolsClassType.find((x) => x.name == tool.name)
              .classType,
            params,
          ) as BaseTool;

          return baseTool;
        }
      }
    } catch (err) {
      console.error('buildTool error', err);
    }

    return null;
  };

  public buildTools = async (
    toolNames: String[],
    toolConfig?: Record<string, any>,
  ): Promise<BaseTool[]> => {
    if (isArray(toolNames)) {
      const tools = await this.toolRepository.find({
        where: { name: In(toolNames) },
      });
      const buildedTools: BaseTool[] = [];
      for (const tool of tools) {
        const buildedTool = await this.buildTool(tool, toolConfig?.[tool.name]);
        if (buildedTool) {
          buildedTools.push(buildedTool);
        } else {
          throw new Error(`build tool ${tool.name} failed`);
        }
      }

      return buildedTools;
    }
    return [];
  };

  public init = async () => {
    this.toolRepository = dbManager.dataSource.getRepository(Tools);
    this.mcpServerRepository = dbManager.dataSource.getRepository(McpServers);
    await this.refresh();
    this.refreshMcpList();
    if (!ipcMain) return;
    this.registerIpcChannels();

    // ipcMain.handle(
    //   'tools:getList',
    //   (
    //     event,
    //     filter: string = undefined,
    //     type: 'all' | 'built-in' | 'mcp' = 'all',
    //   ) => this.getList(filter, type),
    // );
    // ipcMain.handle('tools:getMcpList', (event, filter: string = undefined) =>
    //   this.getMcpList(filter),
    // );
    ipcMain.handle(
      'tools:refreshMcp',
      async (event, id: string): Promise<McpServerInfo> => {
        const ts = await this.mcpServerRepository.findOne({
          where: { id },
        });
        if (ts) {
          return await this.refreshMcp(ts);
        }
        return null;
      },
    );
    // ipcMain.handle(
    //   'tools:invoke',
    //   async (
    //     event,
    //     toolName: string,
    //     arg: any,
    //     outputFormat: 'default' | 'markdown' = 'default',
    //   ) => {
    //     try {
    //       const res = await this.invoke(toolName, arg, outputFormat);
    //       return res;
    //     } catch (e) {
    //       if (e.message) {
    //         return e.message;
    //       } else {
    //         return e;
    //       }
    //     }
    //   },
    // );
    ipcMain.on(
      'tools:invokeAsync',
      async (
        event,
        toolName: string,
        arg: any,
        outputFormat: 'default' | 'markdown' = 'default',
      ) => {
        try {
          const res = await this.invoke(toolName, arg, outputFormat);
          event.sender.send('tools:invokeAsync', res);
          event.returnValue = res;
        } catch (e) {
          const err = e.message || e;
          event.sender.send('tools:invokeAsync', err);
          event.returnValue = err;
        }
      },
    );
    // ipcMain.on(
    //   'tools:update',
    //   async (event, input: { toolName: string; arg: any }) => {
    //     const res = await this.update(input.toolName, input.arg);
    //     event.returnValue = res;
    //   },
    // );
    // ipcMain.handle(
    //   'tools:webSearch',
    //   (
    //     event,
    //     provider: WebSearchEngine,
    //     search: string,
    //     limit: number = 10,
    //     outputFormat: 'default' | 'markdown' = 'default',
    //   ) => this.webSearch(provider, search, limit, outputFormat),
    // );
    //ipcMain.handle('tools:addMcp', (event, data: any) => this.addMcp(data));
    // ipcMain.handle('tools:deleteMcp', (event, name: string) =>
    //   this.deleteMcp(name),
    // );
    // ipcMain.handle(
    //   'tools:getCodeSandboxSetup',
    //   (event, path: string, chatId?: string) =>
    //     this.getCodeSandboxSetup(path, chatId),
    // );
  };

  @channel('tools:webSearch')
  async webSearch(
    provider: WebSearchEngine,
    search: string,
    limit: number = 10,
    outputFormat: 'default' | 'markdown' = 'default',
  ): Promise<string> {
    const tool = new WebSearchTool({ provider: provider, limit: limit });
    let resJson = await tool.invoke({ query: search });
    if (isString(resJson)) {
      try {
        resJson = JSON.parse(resJson);
      } catch {}
    }
    if (outputFormat == 'default') return resJson;
    else if (outputFormat == 'markdown') return this.toMarkdown(resJson);
    return resJson;
  }

  public refresh = async () => {
    this.tools = [];

    // await this.registerTool(new CmdTool());
    if (!app.isPackaged) {
      await this.registerTool(SleepTool);
      await this.registerTool(ErrorTest);
      await this.registerTool(TestTool);
      await this.registerTool(NodejsVM);
    }
    await this.registerTool(BrowserUseTool);
    await this.registerTool(TerminalTool);
    await this.registerTool(Calculator);
    await this.registerTool(DateTimeTool);
    await this.registerTool(Translate);
    await this.registerTool(UnixTimestampConvert);
    await this.registerTool(Vision);
    await this.registerTool(DuckDuckGoSearchTool);
    await this.registerTool(SearxngSearchTool);
    await this.registerTool(DallE);
    await this.registerTool(RapidOcrTool);
    await this.registerTool(PythonInterpreterTool);

    // await this.registerTool(GoogleRoutesAPI);
    // await this.registerTool(GooglePlacesAPI);
    await this.registerTool(WikipediaQueryRun);

    await this.registerTool(SocialMediaSearch);
    await this.registerTool(FileToText);

    await this.registerTool(Vectorizer);
    await this.registerTool(WebLoader);
    await this.registerTool(RemoveBackground);
    await this.registerTool(SpeechToText);
    await this.registerTool(Ideogram);
    await this.registerTool(Midjourney);
    await this.registerTool(ComfyuiTool);
    await this.registerTool(AskHuman);
    await this.registerTool(FileSystemToolKit);

    await this.registerTool(TextToSpeech);
    await this.registerTool(WebSearchTool);
    await this.registerTool(KnowledgeBaseToolkit);
    await this.registerTool(TavilySearchTool);
    await this.registerTool(BraveSearchTool);
    await this.registerTool(FireCrawl);
    await this.registerTool(ArxivTool);

    await this.registerTool(BFLToolkit);
    await this.registerTool(ReplicateToolkit);
    await this.registerTool(ViduToolKit);
    await this.registerTool(CodeSandbox);

    await this.registerTool(RedNoteToolkit);
    await this.registerTool(BilibiliToolkit);
    await this.registerTool(MinimaxToolkit);
    await this.registerTool(ElevenLabsToolkit);
    await this.registerTool(AutoToolToolkit);
    await this.registerTool(Think);
  };

  @channel('tools:update')
  async update(toolName: string, arg: any) {
    const tv = await this.toolRepository.findOne({
      where: { name: toolName },
    });
    if (!tv) {
      throw new Error(`${toolName} not found`);
    }
    tv.config = arg;
    await this.toolRepository.save(tv);
    await this.refresh();
  }

  public toMarkdown(res: any) {
    let isJson = false;
    let resJson = {};
    try {
      if (isObject(res)) {
        resJson = res;
        isJson = true;
      } else if (isString(res)) {
        resJson = JSON.parse(res);
        isJson = true;
      } else if (isArray(res)) {
        resJson = res;
        isJson = true;
      }
    } catch {}
    if (isJson) {
      if (isArray(resJson)) {
        const list = [];
        resJson.forEach((item) => {
          list.push(this.objectToMarkDown(item));
        });
        return list;
      } else {
        return this.objectToMarkDown(resJson);
      }
    } else {
      if (res.startsWith('data:image/')) {
        return `![image](${res})`;
      } else if (isUrl(res)) {
        return `![](${res})`;
      } else if (fs.existsSync(res)) {
        return `![](file:///${res.replace(/\\/g, '/').replace(/ /g, '%20')})`;
      } else if (splitContextAndFiles(res)?.attachments.length > 0) {
        const { context, attachments } = splitContextAndFiles(res);
        let text = context;
        attachments.forEach((attachment) => {
          if (fs.existsSync(attachment.path) && attachment.type == 'file') {
            if (
              attachment.ext == '.png' ||
              attachment.ext == '.jpg' ||
              attachment.ext == '.jpeg' ||
              attachment.ext == '.gif' ||
              attachment.ext == '.webp' ||
              attachment.ext == '.mp4' ||
              attachment.ext == '.mp3' ||
              attachment.ext == '.wav' ||
              attachment.ext == '.ogg' ||
              attachment.ext == '.flac' ||
              attachment.ext == '.m4a'
            ) {
              text += `\n![](file:///${attachment.path.replace(/\\/g, '/').replace(/ /g, '%20')})`;
            } else {
              text += `\n[${attachment.name}](${attachment.path.replace(/\\/g, '/').replace(/ /g, '%20')})`;
            }
          } else if (attachment.type == 'folder') {
            text += `\n[${attachment.name}](${attachment.path.replace(/\\/g, '/').replace(/ /g, '%20')})`;
          }
        });
        return text;
      }
      return res;
    }
  }

  @channel('tools:invoke')
  async invoke(
    toolName: string,
    arg: any,
    outputFormat: 'default' | 'markdown' = 'default',
  ) {
    const tool = await this.toolRepository.findOne({
      where: { name: toolName },
    });
    //const tool = this.tools.find((x) => x.name == toolName);
    const now = new Date();
    try {
      if (tool) {
        const _tool = await this.buildTool(tool, tool.config);
        let output = '';
        const toolOutputFormat = tool.outputFormat ?? 'markdown';

        if (toolOutputFormat == 'markdown') {
          const res = await _tool.stream(arg);
          for await (const chunk of res) {
            output += chunk;
          }
        } else if (toolOutputFormat == 'json') {
          output = await _tool.invoke(arg);
        }
        const time_cost = new Date().getTime() - now.getTime();
        console.log(`tool:${toolName}`, output, time_cost);

        if (outputFormat == 'default')
          return { output, time_cost, is_success: true };
        else if (outputFormat == 'markdown') {
          return {
            output: this.toMarkdown(output),
            time_cost,
            is_success: true,
          };
        }
      }
      throw new Error(`${toolName} no found`);
    } catch (e) {
      console.error('tools:invoke', e);
      const time_cost = new Date().getTime() - now.getTime();
      return { output: e?.message || e, time_cost, is_success: false };
    }

    return null;
  }

  private objectToMarkDown = (input: any) => {
    if (isString(input)) {
      return input;
    } else if (isObject(input)) {
      let text = '';
      const entries = Object.entries(input);
      entries.forEach((item) => {
        const key = item[0];
        const value = item[1];
        if (value != null) {
          if (isObject(value)) {
            text += `**${key}**:\n${JSON.stringify(value, null, 2)}\n`;
          } else if (isArray(value)) {
            text += `**${key}**:\n${JSON.stringify(value, null, 2)}\n`;
          } else {
            text += `**${key}**:\n${value?.toString() || ''}\n`;
          }
        }
      });
      return text;
    }
    return input;
  };

  @channel('tools:addMcp')
  async addMcp(data: {
    id?: string;
    name: string;
    command?: string;
    env?: any;
    type: 'sse' | 'stdio' | 'ws';
    config?: any;
    enabled?: boolean;
  }) {
    //const transport = this.createTransport(data.url, {});
    let mcpClient;
    try {
      if (data.id) {
        const client = this.mcpClients.find(
          (x) => x.getServerVersion().name == data.id,
        );
        if (client) {
          await client.transport?.close();
          await client.close();
        }
      }

      mcpClient = await this.getMcpClient(
        undefined,
        data.command,
        data.config,
        data.env,
        data.type as 'sse' | 'stdio' | 'ws',
      );
    } catch (err) {
      console.error(err);
      throw new Error('MCP server connect failed');
    }

    const { name: serverName, version: serverVersion } =
      await mcpClient.getServerVersion();
    let ts: McpServers;
    if (!data.id) {
      ts = new McpServers(
        serverName,
        data.name,
        undefined,
        data.type,
        data.command,
        data.config,
        data.env,
      );
      ts.version = serverVersion;
      ts.enabled = data.enabled;
    } else {
      ts = await this.mcpServerRepository.findOne({
        where: { id: data.id },
      });
      ts = { ...ts, ...data };
    }
    if (ts.enabled) {
      try {
        const { tools } = await mcpClient.listTools();
        ts.id = serverName;
        await mcpClient.transport?.close();
        await mcpClient.close();
        ts.enabled = true;
      } catch (err) {
        console.error(err);
        ts.enabled = false;
      }
    } else {
      const client = this.mcpClients.find(
        (x) => x.getServerVersion().name == ts.id,
      );
      if (client) {
        try {
          await client.transport.close();
          await client.close();
        } catch {}
        await mcpClient.transport?.close();
        await mcpClient.close();

        this.mcpClients = this.mcpClients.filter(
          (x) => x.getServerVersion().name != ts.id,
        );
      }
    }

    await this.mcpServerRepository.save(ts);
    await this.refreshMcp(ts);
    // Use the server tools with your LLM application

    // const tool = tools.find((x) => x.name == 'get_file_info');
    // if (tool) {
    //   const result = await client.callTool({
    //     name: tool.name,
    //     arguments: {
    //       path: 'C:\\Users\\Administrator\\Pictures\\3a0860be-9851-c0f2-fdef-856d234fa0a - 副本.png',
    //     },
    //   });
    //   console.log(result);
    // }
  }

  @channel('tools:deleteMcp')
  async deleteMcp(id: string) {
    const ts = await this.mcpServerRepository.findOne({
      where: { id: id },
    });
    if (ts) {
      const client = this.mcpClients.find(
        (x) => x.getServerVersion().name == ts.id,
      );
      if (client) {
        await client.transport.close();
        await client.close();
        this.mcpClients = this.mcpClients.filter(
          (x) => x.getServerVersion().name != id,
        );
      }
      this.mcpServerInfos = this.mcpServerInfos.filter((x) => x.id != id);
      await this.mcpServerRepository.delete(ts.id);
    }
  }

  @channel('tools:getMcpList')
  async getMcpList(filter: string = undefined) {
    return this.mcpServerInfos;
  }

  public refreshMcpList = async () => {
    const mcpServers = await this.mcpServerRepository.find();
    const tools = await this.toolRepository.find({
      where: { type: 'mcp' },
    });
    this.mcpServerInfos = mcpServers.map((x) => {
      return { ...x, tools: [] };
    });
    for (const mcpServer of mcpServers) {
      await this.refreshMcp(mcpServer);
    }
  };

  private updateMcpServerInfo = (mcpServerInfo: McpServerInfo) => {
    const _mcpServerInfo = this.mcpServerInfos.find(
      (x) => x.id == mcpServerInfo.id,
    );
    if (_mcpServerInfo) {
      this.mcpServerInfos = this.mcpServerInfos.filter(
        (x) => x.id != mcpServerInfo.id,
      );
    }
    this.mcpServerInfos.push(mcpServerInfo);
    appManager.sendEvent('tools:mcp-updated', mcpServerInfo);
  };

  public refreshMcp = async (mcpServer: McpServers): Promise<McpServerInfo> => {
    let mcpServerInfo: McpServerInfo = this.mcpServerInfos.find(
      (x) => x.id == mcpServer.id,
    );
    if (mcpServerInfo) {
      if (mcpServerInfo.status == 'pending') {
        return mcpServerInfo;
      }
      this.mcpServerInfos = this.mcpServerInfos.filter(
        (x) => x.id != mcpServer.id,
      );
    }
    mcpServerInfo = {
      ...mcpServer,
      tools: [],
      status: 'pending',
    } as McpServerInfo;
    this.updateMcpServerInfo(mcpServerInfo);
    const mcpClient = this.mcpClients.find(
      (x) => x.getServerVersion().name == mcpServer.id,
    );
    if (mcpClient) {
      await mcpClient.transport?.close();
      await mcpClient.close();

      this.mcpClients = this.mcpClients.filter(
        (x) => x.getServerVersion().name != mcpServer.id,
      );
    }
    if (!mcpServer.enabled) {
      mcpServerInfo = {
        ...mcpServer,
        tools: [],
        status: 'deactivated',
      } as McpServerInfo;
      this.updateMcpServerInfo(mcpServerInfo);
    } else {
      const toolInfos: ToolInfo[] = [];

      try {
        const client = await this.getMcpClient(
          mcpServer.id,
          mcpServer.command,
          mcpServer.config,
          mcpServer.env,
          mcpServer.type as 'sse' | 'stdio' | 'ws',
          true,
        );
        const { tools: _mcpTools } = await client.listTools();
        const _tools = await this.toolRepository.find({
          where: { mcp_id: mcpServer.id, type: 'mcp' },
        });
        if (_tools.length > 0) {
          await this.toolRepository.delete(_tools.map((x) => x.name));
        }
        const toolList = [];
        for (const mcpTool of _mcpTools) {
          const t = new Tools(
            `${mcpTool.name}@${mcpServer.id}`,
            mcpTool.description,
            'mcp',
            {},
          );
          t.enabled = true;
          t.mcp_id = mcpServer.id;
          t.toolkit_name = mcpServer.name;
          toolList.push(t);
          const toolInfo = { ...t } as ToolInfo;
          toolInfo.id = `${mcpTool.name}@${mcpServer.id}`;
          toolInfo.schema = mcpTool.inputSchema;
          toolInfos.push(toolInfo);
        }
        await this.toolRepository.save(toolList);
        this.mcpClients = this.mcpClients.filter(
          (x) => x.getServerVersion().name != mcpServer.id,
        );
        this.mcpClients.push(client);
        mcpServer.version = client.getServerVersion().version;
        mcpServer.description = client.getServerVersion().description;
        await this.mcpServerRepository.save(mcpServer);
        console.log(`loaded success ${mcpServer.id}`);
        mcpServerInfo = {
          ...mcpServer,
          tools: toolInfos,
          status: 'activated',
        } as McpServerInfo;
      } catch (err) {
        mcpServer.enabled = false;
        await this.mcpServerRepository.save(mcpServer);
        mcpServerInfo = {
          ...mcpServer,
          tools: toolInfos,
          status: 'deactivated',
        } as McpServerInfo;
        console.error(`loaded failed ${mcpServer.id}`, err);
      }

      this.updateMcpServerInfo(mcpServerInfo);
    }
    return mcpServerInfo;
  };

  private async getMcpClient(
    mcpName?: string,
    commandAndArgs?: string,
    config?: any,
    env?: any,
    type: 'sse' | 'stdio' | 'ws' = 'stdio',
    renew: boolean = false,
  ) {
    let client = mcpName
      ? this.mcpClients.find((y) => y.getServerVersion().name == mcpName)
      : undefined;

    if (!client || client.transport === undefined || renew) {
      client = new Client({ name: 'Test Client', version: '0.0.1' });

      const command = commandAndArgs.split(' ')[0];
      const args = commandAndArgs.split(' ').slice(1);
      if (Object.keys(config).length > 0) {
        args.push('--config', JSON.stringify(config));
      }
      let transport;
      if (type == 'stdio') {
        if (command.startsWith('python')) {
          const pythonPath = (
            await runCommand(`python -c 'import sys;print(sys.executable)'`)
          )
            .toString()
            .trim();
          const cwd = path.dirname(pythonPath);

          transport = new StdioClientTransport({
            command: command,
            args,
            env,
            cwd,
          });
        } else {
          transport = new StdioClientTransport({
            command: command,
            args,
            env,
          });
        }
      } else if (type == 'sse') {
        transport = new SSEClientTransport(this.createMcpUrl(command, config), {
          requestInit: {
            keepalive: true,
          },
        });
      } else if (type == 'ws') {
        transport = new WebSocketClientTransport(
          this.createMcpUrl(command, config),
        );
      }
      await client.connect(transport, { timeout: 1000 * 60 * 60 });
    }

    return client;
  }

  createMcpUrl(command: string, config: any) {
    const url = new URL(`${command}`);
    if (config) {
      const param =
        typeof window !== 'undefined'
          ? btoa(JSON.stringify(config))
          : Buffer.from(JSON.stringify(config)).toString('base64');
      url.searchParams.set('config', param);
    }
    return url;
  }

  @channel('tools:getCodeSandboxSetup')
  async getCodeSandboxSetup(_path: string, chatId: string) {
    const realPath = path.join(getDataPath(), 'chats', chatId, _path);
    function readFilesRecursively(dir, fileMap = {}, baseDir = dir) {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const relPath = `/${path.relative(baseDir, fullPath).replace(/\\/g, '/')}`;
        if (file.startsWith('.')) {
          return;
        }
        if (fs.statSync(fullPath).isDirectory()) {
          const dirName = path.basename(fullPath);
          if (!'node_modules'.includes(dirName)) {
            readFilesRecursively(fullPath, fileMap, baseDir);
          }
        } else {
          const ext = path.extname(fullPath);
          if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            fileMap[relPath] =
              `<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
  <image href="file://${fullPath}" x="0" y="0" height="200" width="200"/>
</svg>
`;
          } else {
            fileMap[relPath] = fs.readFileSync(fullPath, 'utf-8');
          }
        }
      });
      return fileMap;
    }
    const result = readFilesRecursively(realPath);
    return { files: result };
  }
}

export const toolsManager = new ToolsManager();
