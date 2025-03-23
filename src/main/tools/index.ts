import { Calculator } from '@langchain/community/tools/calculator';
import { SearchApi } from '@langchain/community/tools/searchapi';

import {
  TavilySearchResults,
  type TavilySearchAPIRetrieverFields,
} from '@langchain/community/tools/tavily_search';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { In, Like, Repository } from 'typeorm';
import { DuckDuckGoSearchParameters } from '@langchain/community/tools/duckduckgo_search';
import { SearxngSearch } from '@langchain/community/tools/searxng_search';
import {
  GoogleRoutesAPI,
  GoogleRoutesAPIParams,
} from '@langchain/community/tools/google_routes';
import { CmdTool } from './CmdTool';
import { DateTimeTool } from './DateTimeTool';
import 'reflect-metadata';
import settingsManager from '../settings';
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
import { FileRead, FileWrite, ListDirectory } from './FileSystemTool';
import { Midjourney } from './Midjourney';
import { TextToSpeech } from './TextToSpeech';
import { ComfyuiTool } from './ComfyuiTool';
import { WebSearchEngine } from '@/types/webSearchEngine';
import { v4 as uuidv4 } from 'uuid';
import { WebSearchTool } from './WebSearchTool';
import { ChartjsTool } from './Chartjs';
import { z, ZodObject } from 'zod';
import { BaseTool } from './BaseTool';
import { KnowledgeBaseQuery } from './KnowledgeBaseQuery';
import fs from 'fs';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket';
import { createSmitheryUrl, MultiClient } from '@smithery/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
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

export interface ToolInfo extends Tools {
  id: string;
  schema: any;
  status: 'success' | 'error' | 'pending';
  parameters: object | undefined;
  officialLink?: string | undefined;
  configSchema?: FormSchema[] | undefined;
}

export interface McpServerInfo extends McpServers {
  tools: ToolInfo[];
}

export class ToolsManager {
  public tools: ToolInfo[];

  public builtInToolsClassType: any[] = [];

  public mcpServerInfos: McpServerInfo[] = [];

  public mcpClients: Client[] = [];

  public toolRepository: Repository<Tools>;

  public mcpServerRepository: Repository<McpServers>;

  constructor() {}

  public async registerTool(ClassType, params: undefined | any = undefined) {
    let ts;
    try {
      let tool = Reflect.construct(ClassType, params ? [params] : []);
      this.builtInToolsClassType.push({
        name: tool.name,
        classType: ClassType,
      });
      ts = await this.toolRepository.findOne({
        where: { name: tool.name },
      });
      if (!ts) {
        ts = new Tools(tool.name, tool.description, 'built-in', params);
        ts.enabled = false;
        ts.toolkit_name = tool.toolKitName;

        await this.toolRepository.save(ts);
      } else {
        const vj = ts.config ?? {};
        if (params) {
          Object.keys(params).forEach((key) => {
            if (Object.keys(vj).includes(key)) {
              params[key] = vj[key];
            }
          });
        }

        //params = { ...params, ...JSON.parse(ts.value) };
      }
      if (this.tools.find((x) => x.name == ts.name)) {
        this.tools = this.tools.filter((x) => x.name != ts.name);
      }

      if (params) {
        const ss = Object.entries(params);
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
        schema: zodToJsonSchema(tool.schema),
        officialLink: tool.officialLink,
        configSchema: tool.configSchema,
      } as ToolInfo);
    } catch (err) {
      if (ts) {
        this.tools.push({
          ...ts,
          parameters: params,
          status: 'error',
          // schema: zodToJsonSchema(tool.schema),
          // officialLink: tool.officialLink,
          // configSchema: tool.configSchema,
        } as ToolInfo);
      }
      console.error(`register '${ClassType.name}' tool fail, ${err.message}`);
    }
  }

  public async unregisterTool(ClassType) {
    const { name } = ClassType;
    this.tools = this.tools.filter((x) => x.tool.name != name);
  }

  public getList(
    filter: string = undefined,
    type: 'all' | 'built-in' | 'mcp' = 'all',
  ): ToolInfo[] {
    let { tools } = this;
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

  public getTools(): BaseTool[] {
    return this.tools.map((x) => x.tool);
  }

  public queryTools = (text: string): Tool[] => {
    return [];
  };

  public buildTool = async (tool: Tools, config: any): Promise<BaseTool> => {
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
      const schema = this.jsonSchemaToZod(_tool.inputSchema);
      console.log(zodToJsonSchema(schema));
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
            const res = await mcpClient.callTool({
              name: _tool.name,
              arguments: result,
            });
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
      const baseTool = Reflect.construct(
        this.builtInToolsClassType.find((x) => x.name == tool.name).classType,
        tool.config ? [tool.config] : [],
      ) as BaseTool;

      return baseTool;
    }
    return null;
  };

  private jsonSchemaToZod(schema: any) {
    if (!schema || typeof schema !== 'object') {
      return z.any();
    }

    // 处理基本类型
    if (schema.type === 'string') {
      let validator;
      if (schema.enum) {
        validator = z.enum(schema.enum);
      } else {
        validator = z.string();
        if (schema.pattern)
          validator = validator.regex(new RegExp(schema.pattern));
        if (schema.minLength !== undefined)
          validator = validator.min(schema.minLength);
        if (schema.maxLength !== undefined)
          validator = validator.max(schema.maxLength);
      }

      if (schema.description)
        validator = validator.describe(schema.description);
      validator.default = undefined;

      return z.optional(validator);
    } else if (schema.type === 'number' || schema.type === 'integer') {
      let validator;
      if (schema.enum) {
        validator = z.enum(schema.enum);
      } else {
        validator = schema.type === 'integer' ? z.number().int() : z.number();
        if (schema.minimum !== undefined)
          validator = validator.gte(schema.minimum);
        if (schema.maximum !== undefined)
          validator = validator.lte(schema.maximum);
      }

      if (schema.description)
        validator = validator.describe(schema.description);
      validator.default = undefined;
      return z.optional(validator);
    } else if (schema.type === 'boolean') {
      let validator;
      if (schema.enum) {
        validator = z.enum(schema.enum);
      } else {
        validator = z.boolean();
      }

      if (schema.description)
        validator = validator.describe(schema.description);
      validator.default = undefined;
      return z.optional(validator);
    } else if (schema.type === 'null') {
      let validator = z.null();
      if (schema.description)
        validator = validator.describe(schema.description);
      validator.default = undefined;
      return z.optional(validator);
    } else if (schema.type === 'array') {
      const itemValidator = schema.items
        ? this.jsonSchemaToZod(schema.items)
        : z.any();
      let validator = z.array(itemValidator);
      if (schema.minItems !== undefined)
        validator = validator.min(schema.minItems);
      if (schema.maxItems !== undefined)
        validator = validator.max(schema.maxItems);
      if (schema.description)
        validator = validator.describe(schema.description);
      validator.default = undefined;
      return z.optional(validator);
    } else if (schema.type === 'object') {
      const shape = {};
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          shape[key] = this.jsonSchemaToZod(propSchema);
        }
      }

      let validator = z.object(shape);

      // 处理必填字段
      if (schema.required && Array.isArray(schema.required)) {
        const required = {};
        for (const key of schema.required) {
          if (shape[key]) {
            required[key] = shape[key];
          }
        }
        validator = validator.required(required);
      }
      if (schema.description)
        validator = validator.describe(schema.description);
      return validator;
    }

    // 处理复合类型
    if (schema.anyOf) {
      return z.union(schema.anyOf.map((s) => this.jsonSchemaToZod(s)));
    } else if (schema.allOf) {
      return schema.allOf.reduce(
        (acc, s) => acc.and(this.jsonSchemaToZod(s)),
        z.object({}),
      );
    } else if (schema.oneOf) {
      return z.union(schema.oneOf.map((s) => this.jsonSchemaToZod(s)));
    }

    return z.any();
  }

  public buildTools = async (toolNames: String[]): Promise<BaseTool[]> => {
    if (isArray(toolNames)) {
      const tools = await this.toolRepository.find({
        where: { name: In(toolNames) },
      });
      return Promise.all(tools.map((x) => this.buildTool(x, x.config)));
    }
    return [];
  };

  public init = async () => {
    this.toolRepository = dbManager.dataSource.getRepository(Tools);
    this.mcpServerRepository = dbManager.dataSource.getRepository(McpServers);
    await this.refresh();
    this.refreshMcpList();
    if (!ipcMain) return;
    ipcMain.handle(
      'tools:getList',
      (
        event,
        filter: string = undefined,
        type: 'all' | 'built-in' | 'mcp' = 'all',
      ) => this.getList(filter, type),
    );
    ipcMain.handle('tools:getMcpList', (event, filter: string = undefined) =>
      this.getMcpList(filter),
    );
    ipcMain.handle('tools:refreshMcp', async (event, id: string) => {
      const ts = await this.mcpServerRepository.findOne({
        where: { id },
      });
      if (ts) {
        await this.refreshMcp(ts);
      }
    });
    ipcMain.handle(
      'tools:invoke',
      async (
        event,
        toolName: string,
        arg: any,
        outputFormat: 'default' | 'markdown' = 'default',
      ) => {
        try {
          const res = await this.invoke(toolName, arg, outputFormat);
          return res;
        } catch (e) {
          if (e.message) {
            return e.message;
          } else {
            return e;
          }
        }
      },
    );
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
    ipcMain.on(
      'tools:update',
      async (event, input: { toolName: string; arg: any }) => {
        const res = await this.update(input.toolName, input.arg);
        event.returnValue = res;
      },
    );
    ipcMain.handle(
      'tools:webSearch',
      (
        event,
        provider: WebSearchEngine,
        search: string,
        limit: number = 10,
        outputFormat: 'default' | 'markdown' = 'default',
      ) => this.webSearch(provider, search, limit, outputFormat),
    );
    ipcMain.handle('tools:addMcp', (event, data: any) => this.addMcp(data));
    ipcMain.handle('tools:deleteMcp', (event, name: string) =>
      this.deleteMcp(name),
    );
  };

  public webSearch = async (
    provider: WebSearchEngine,
    search: string,
    limit: number = 10,
    outputFormat: 'default' | 'markdown' = 'default',
  ): Promise<string> => {
    const tool = new WebSearchTool({ provider: provider, limit: limit });
    let resJson = await tool.invoke(search);
    if (isString(resJson)) {
      try {
        resJson = JSON.parse(resJson);
      } catch {}
    }
    if (outputFormat == 'default') return resJson;
    else if (outputFormat == 'markdown') return this.toMarkdown(resJson);
  };

  public refresh = async () => {
    this.tools = [];

    // await this.registerTool(new CmdTool());
    await this.registerTool(ChartjsTool);
    await this.registerTool(CmdTool);
    await this.registerTool(Calculator);
    await this.registerTool(DateTimeTool);
    await this.registerTool(Translate);
    await this.registerTool(UnixTimestampConvert);
    // await this.registerTool(SearchApi, { apiKey: 'NULL' });
    // await this.registerTool(TavilySearchResults, {
    //   apiKey: 'NULL',
    //   maxResults: 3,
    //   kwargs: {},
    // } as TavilySearchAPIRetrieverFields);
    await this.registerTool(DuckDuckGoSearchTool, {
      maxResults: 3,
    } as DuckDuckGoSearchParameters);
    await this.registerTool(SearxngSearchTool, { apiBase: 'NULL' });
    // await this.registerTool(VideoToText, {
    //   ffmpegPath: 'NULL',
    // } as VideoToTextParameters);

    await this.registerTool(DallE, {
      n: 1, // Default
      modelName: 'dall-e-3', // Default
      apiKey: 'NULL', // Default
    });
    await this.registerTool(RapidOcrTool);
    await this.registerTool(PythonInterpreterTool, {
      pythonPath: '',
      keepVenv: false,
    });

    await this.registerTool(GoogleRoutesAPI, {
      apiKey: 'NULL',
    } as GoogleRoutesAPIParams);
    await this.registerTool(GooglePlacesAPI, {
      apiKey: 'NULL',
    } as GooglePlacesAPIParams);
    await this.registerTool(WikipediaQueryRun, {
      topKResults: 3,
      maxDocContentLength: 4000,
      baseUrl: 'https://en.wikipedia.org/w/api.php',
    } as WikipediaQueryRunParams);

    await this.registerTool(SocialMediaSearch);
    await this.registerTool(FileToText);
    await this.registerTool(NodejsVM, { sensitive: true });
    await this.registerTool(Vectorizer, {
      apiKeyName: '',
      apiKey: '',
      mode: 'test',
    });
    await this.registerTool(WebLoader, {
      headless: false,
      useJina: false,
    });
    await this.registerTool(RemoveBackground);
    await this.registerTool(SpeechToText);
    await this.registerTool(Ideogram, {
      apiKey: '',
      apiBase: 'https://api.ideogram.ai',
      model: 'V_2',
    });
    await this.registerTool(Midjourney, {
      apiKey: '',
      apiBase: '',
      mode: 'relax',
    });
    await this.registerTool(ComfyuiTool, {
      defaultApiBase: 'http://127.0.0.1:8188',
    });
    await this.registerTool(AskHuman);

    await this.registerTool(FileWrite);
    await this.registerTool(FileRead);
    await this.registerTool(ListDirectory);
    await this.registerTool(TextToSpeech, {
      model: 'matcha-icefall-zh-baker@local',
    });
    await this.registerTool(WebSearchTool);
    await this.registerTool(KnowledgeBaseQuery);
    await this.registerTool(TavilySearchTool);
  };

  public update = async (toolName: string, arg: any) => {
    const tv = await this.toolRepository.findOne({
      where: { name: toolName },
    });
    if (!tv) {
      throw new Error(`${toolName} not found`);
    }
    tv.config = arg;
    await this.toolRepository.save(tv);
    await this.refresh();
  };

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
        return `![](file:///${res.replace(/\\/g, '/')})`;
      }
      return res;
    }
  }

  public invoke = async (
    toolName: string,
    arg: any,
    outputFormat: 'default' | 'markdown' = 'default',
  ) => {
    const tool = await this.toolRepository.findOne({
      where: { name: toolName },
    });
    //const tool = this.tools.find((x) => x.name == toolName);

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

      console.log(`tool:${toolName}`, output);

      if (outputFormat == 'default') return output;
      else if (outputFormat == 'markdown') {
        return this.toMarkdown(output);
      }
    }
    throw new Error(`${toolName} no found`);
  };

  private objectToMarkDown = (input: any) => {
    if (isString(input)) {
      return input;
    } else if (isObject(input)) {
      let text = '';
      const entries = Object.entries(input);
      entries.forEach((item) => {
        const key = item[0];
        const value = item[1];
        text += `**${key}**:\n${value}\n`;
      });
      return text;
    }
    return input;
  };

  public addMcp = async (data: {
    id?: string;
    name: string;
    command?: string;
    env?: any;
    type: 'sse' | 'stdio' | 'ws';
    config?: any;
    enabled?: boolean;
  }) => {
    //const transport = this.createTransport(data.url, {});
    let mcpClient;
    try {
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
        const _tools = await this.toolRepository.find({
          where: { mcp_id: serverName },
        });
        if (_tools.length > 0) {
          await this.toolRepository.delete(_tools.map((x) => x.name));
        }
        let toolList = [];
        for (const tool of tools) {
          let t = new Tools(
            `${tool.name}@${ts.id}`,
            tool.description,
            'mcp',
            {},
          );
          t.enabled = true;
          t.mcp_id = ts.id;
          t.toolkit_name = data.name;
          toolList.push(t);
        }
        await this.toolRepository.save(toolList);
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
        await client.close();
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
  };

  public deleteMcp = async (id: string) => {
    const ts = await this.mcpServerRepository.findOne({
      where: { id: id },
    });
    if (ts) {
      const client = this.mcpClients.find(
        (x) => x.getServerVersion().name == ts.id,
      );
      if (client) {
        await client.close();
        this.mcpClients = this.mcpClients.filter(
          (x) => x.getServerVersion().name != id,
        );
      }
      this.mcpServerInfos = this.mcpServerInfos.filter((x) => x.id != id);
      await this.mcpServerRepository.delete(ts.id);
    }
  };

  public getMcpList = async (filter: string = undefined) => {
    return this.mcpServerInfos;
  };

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

  public refreshMcp = async (mcpServer: McpServers): Promise<McpServerInfo> => {
    this.mcpServerInfos = this.mcpServerInfos.filter(
      (x) => x.id != mcpServer.id,
    );
    let mcpServerInfo;
    if (!mcpServer.enabled) {
      mcpServerInfo = {
        ...mcpServer,
        tools: [],
      } as McpServerInfo;
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

        for (const tool of _tools) {
          const mcpTool = _mcpTools.find(
            (x) => x.name == tool.name.split('@')[0],
          );
          const toolInfo = { ...tool } as ToolInfo;
          toolInfo.id = tool.name;
          toolInfo.name = mcpTool.name;
          toolInfo.description = mcpTool.description;
          toolInfo.schema = mcpTool.inputSchema;
          toolInfos.push(toolInfo);
        }
        this.mcpClients = this.mcpClients.filter(
          (x) => x.getServerVersion().name != mcpServer.id,
        );
        this.mcpClients.push(client);
        mcpServer.version = client.getServerVersion().version;
        await this.mcpServerRepository.save(mcpServer);
        console.log('loaded success ' + mcpServer.id);
      } catch (err) {
        mcpServer.enabled = false;
        await this.mcpServerRepository.save(mcpServer);
        console.error('loaded failed ' + mcpServer.id, err);
      }

      mcpServerInfo = { ...mcpServer, tools: toolInfos };
    }

    this.mcpServerInfos.push(mcpServerInfo);
    return mcpServerInfo;
  };

  private createTransport(smitheryServerUrl, config) {
    return new WebSocketClientTransport(
      createSmitheryUrl(`${smitheryServerUrl}/ws`, config),
    );
  }

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
          transport.c;
        } else {
          transport = new StdioClientTransport({
            command: command,
            args,
            env,
          });
        }
      } else if (type == 'sse') {
        transport = new SSEClientTransport(
          createSmitheryUrl(`${command}`, config),
        );
      } else if (type == 'ws') {
        transport = new WebSocketClientTransport(
          createSmitheryUrl(`${command}`, config),
        );
      }
      // transport.onclose = () => {
      //   this.mcpClients = this.mcpClients.filter(
      //     (x) => x.getServerVersion().name != mcpName,
      //   );
      // };
      await client.connect(transport);
    }

    return client;
  }
}

export const toolsManager = new ToolsManager();
