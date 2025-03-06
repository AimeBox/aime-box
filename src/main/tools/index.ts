import { StructuredTool, Tool, ToolParams } from '@langchain/core/tools';
import { Calculator } from '@langchain/community/tools/calculator';
import { SearchApi } from '@langchain/community/tools/searchapi';

import {
  TavilySearchResults,
  type TavilySearchAPIRetrieverFields,
} from '@langchain/community/tools/tavily_search';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Like } from 'typeorm';
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
import { RegisterToolSchema } from './RegisterTool';
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
import { ZodObject } from 'zod';
import { BaseTool } from './BaseTool';
import { KnowledgeBaseQuery } from './KnowledgeBaseQuery';
import fs from 'fs';

export interface ToolInfo {
  name: string;
  description: string;
  schema: any;
  parameters: object | undefined;
  tags?: string[] | undefined;
  officialLink?: string | undefined;
  configSchema?: FormSchema[] | undefined;
}

export class ToolsManager {
  public tools: { name: string; tool: BaseTool; parameters: any }[];

  public async registerTool(ClassType, params: undefined | any = undefined) {
    try {
      let tool = Reflect.construct(ClassType, params ? [params] : []);
      if (params) {
        const ss = Object.entries(params);
        const settings = dbManager.dataSource.getRepository(Settings);
        let ts = await settings.findOne({
          where: { id: `tools:${tool.name}` },
        });
        if (!ts) {
          ts = new Settings();
          ts.id = `tools:${tool.name}`;
          ts.value = JSON.stringify(params);
          await settings.save(ts);
        } else {
          const vj = JSON.parse(ts.value);
          Object.keys(params).forEach((key) => {
            if (Object.keys(vj).includes(key)) {
              params[key] = vj[key];
            }
          });

          //params = { ...params, ...JSON.parse(ts.value) };
        }
        tool = Reflect.construct(ClassType, params ? [params] : []);
        if (tool.name == 'video_to_text') {
          const keys = Object.keys(params);
          for (let index = 0; index < keys.length; index++) {
            const key = keys[index];

            const metadata = Reflect.getMetadata('toolfield', tool, key);
          }
        }
      }

      this.tools.push({ name: tool.name, tool, parameters: params });
    } catch (err) {
      console.error(`register '${ClassType.name}' tool fail, ${err.message}`);
    }
  }

  public async unregisterTool(ClassType) {
    const { name } = ClassType;
    this.tools = this.tools.filter((x) => x.tool.name != name);
  }

  // public async registerTool(
  //   tool: Tool,
  //   default_parameters: any | undefined = undefined,
  // ) {
  //   if (default_parameters) {
  //     const settings = dbManager.dataSource.getRepository(Settings);
  //     let ts = await settings.findOne({ where: { id: 'tools:' + tool.name } });
  //     if (!ts) {
  //       ts = new Settings();
  //       ts.id = 'tools:' + tool.name;
  //       ts.value = JSON.stringify(default_parameters);
  //       await settings.save(ts);
  //     }
  //     const parameters = JSON.parse(ts.value);
  //     Object.keys(parameters).forEach((key) => {
  //       tool[key] = parameters[key];
  //     });
  //     default_parameters = parameters;
  //   }

  //   this.tools.push({ tool, parameters: default_parameters });
  // }
  public getInfo(filter: string = undefined): ToolInfo[] {
    let { tools } = this;
    if (filter) {
      tools = tools.filter(
        (x) =>
          x.name?.toLowerCase().indexOf(filter) > -1 ||
          x.tool.description?.toLowerCase().indexOf(filter) > -1,
      );
    }
    const res = tools.map((x) => {
      const schema = zodToJsonSchema(x.tool.schema);
      return {
        name: x.name,
        description: x.tool.description,
        schema: schema,
        parameters: x.parameters,
        officialLink: x.tool['officialLink'],
        configSchema: x.tool.configSchema,
      } as ToolInfo;
    });
    return res;
  }

  public getTools(): BaseTool[] {
    return this.tools.map((x) => x.tool);
  }

  public queryTools = (text: string): Tool[] => {
    return [];
  };

  public init = async () => {
    await this.refresh();
    if (!ipcMain) return;
    ipcMain.on('tools:getInfo', (event, filter: string = undefined) => {
      event.returnValue = this.getInfo(filter);
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
    //await this.registerTool(ChartjsTool);
    await this.registerTool(CmdTool);
    await this.registerTool(Calculator);
    await this.registerTool(DateTimeTool);

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
      openAIApiKey: 'NULL', // Default
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
    await this.registerTool(SpeechToText, {
      ffmpegPath: '',
      model: 'sense-voice@local',
      apiKey: '',
    });
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
  };

  public update = async (toolName: string, arg: any) => {
    const settings = dbManager.dataSource.getRepository(Settings);
    let tv = await settings.findOne({ where: { id: `tools:${toolName}` } });
    if (!tv) {
      tv = new Settings();
      tv.id = `tools:${toolName}`;
    }
    tv.value = JSON.stringify(arg);
    await settings.save(tv);
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
        return `![](file://${res.replace(/\\/g, '/')})`;
      }
      return res;
    }
  }

  public invoke = async (
    toolName: string,
    arg: any,
    outputFormat: 'default' | 'markdown' = 'default',
  ) => {
    const tool = this.tools.find((x) => x.name == toolName);
    if (tool) {
      let output = '';
      const toolOutputFormat = tool.tool.outputFormat ?? 'markdown';
      if (toolOutputFormat == 'markdown') {
        const res = await tool.tool.stream(arg);
        for await (const chunk of res) {
          output += chunk;
        }
      } else if (toolOutputFormat == 'json') {
        output = await tool.tool.invoke(arg);
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
}

export const toolsManager = new ToolsManager();

// export const AToolField: PropertyDecorator = (formSchema: FormSchema) => {};
