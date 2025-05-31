import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isObject, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import settingsManager from '../settings';
import { getDataPath } from '../utils/path';
import { chromium } from 'playwright';
import { WebSearchEngine } from '@/types/webSearchEngine';
import { v4 as uuidv4 } from 'uuid';
import { DuckDuckGoSearchTool } from './DuckDuckGoSearch';
import { SearxngSearchTool } from './SearxngSearchTool';
import { TavilySearchTool } from './TavilySearch';
import { SerpAPI } from '@langchain/community/tools/serpapi';
import { BaseTool } from './BaseTool';
import { BraveSearchTool } from './websearch/BraveSearch';

export interface WebSearchToolParameters extends ToolParams {
  provider?: string;
  limit: number;
}

export class WebSearchTool extends BaseTool {
  schema = z.object({
    query: z.string().describe('The query to search the web for.'),
  });

  name: string = 'web_search';

  description: string = 'Search the web for information.';

  provider?: string;

  limit: number = 10;

  constructor(params?: WebSearchToolParameters) {
    super(params);

    this.provider = params?.provider;
    this.limit = params?.limit ?? 10;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<any> {
    try {
      const settings = settingsManager.getSettings();
      const httpAgent = settingsManager.getHttpAgent();
      if (!this.provider && settings.defaultWebSearchEngine) {
        this.provider = settings.defaultWebSearchEngine.split('@')[1];
      }
      if (
        settings.webSearchEngine.zhipu.apiKey &&
        this.provider == WebSearchEngine.ZhuPu
      ) {
        const msg = [
          {
            role: 'user',
            content: input.query,
          },
        ];
        const tool = 'web-search-pro';
        const url = 'https://open.bigmodel.cn/api/paas/v4/tools';
        const request_id = uuidv4();
        const data = {
          request_id: request_id,
          tool: tool,
          stream: false,
          messages: msg,
        };
        const options = {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${settings.webSearchEngine.zhipu.apiKey}`,
          },
          body: JSON.stringify(data),
        };
        const res = await fetch(url, options);
        const resjson = await res.json();
        if (resjson.choices[0].finish_reason == 'stop') {
          const restext = JSON.stringify(
            resjson.choices[0].message.tool_calls.find(
              (x) => x.type == 'search_result',
            )?.search_result,
          );
          return restext;
        } else {
          throw resjson.choices[0].finish_reason;
        }
      } else if (this.provider == WebSearchEngine.DuckDuckGo) {
        const d = new DuckDuckGoSearchTool({ maxResults: this.limit });
        const res = await d.invoke(input.query);
        return res;
      } else if (
        this.provider == WebSearchEngine.Searxng &&
        settings.webSearchEngine.searxng.apiBase
      ) {
        const d = new SearxngSearchTool({
          apiBase: settings.webSearchEngine.searxng.apiBase,
          params: { numResults: this.limit },
        });
        const res = await d.invoke(input.query);
        return res;
      } else if (
        this.provider == WebSearchEngine.Tavily &&
        settings.webSearchEngine.searxng.apiBase
      ) {
        const d = new TavilySearchTool({
          apiKey: settings.webSearchEngine.tavily.apiKey,
          maxResults: this.limit,
        });
        const res = await d.invoke({ query: input.query });
        return res;
      } else if (
        this.provider == WebSearchEngine.Serpapi &&
        settings.webSearchEngine.serpapi.apiKey
      ) {
        const d = new SerpAPI(settings.webSearchEngine.serpapi.apiKey);
        const res = await d.invoke(input.query);
        return res;
      } else if (
        this.provider == WebSearchEngine.Brave &&
        settings.webSearchEngine.brave.apiKey
      ) {
        const d = new BraveSearchTool({
          apiKey: settings.webSearchEngine.brave.apiKey,
        });
        const res = await d.invoke({ query: input.query });
        return res;
      }
      return 'config has error';
    } catch (err) {
      if (isObject(err)) return JSON.stringify(err);
      return err.message;
    }
  }
}
