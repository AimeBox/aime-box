import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';

import { TavilySearchAPIRetriever } from '@langchain/community/retrievers/tavily_search_api';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import fetch from 'node-fetch';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { HttpsProxyAgent } from 'https-proxy-agent';
import settingsManager from '../settings';

export interface TavilySearchParameters extends ToolParams {
  apiKey: string;
  maxResults: number;
  kwargs?: Record<string, unknown>;
}

export class TavilySearchTool extends Tool {
  static lc_name() {
    return 'TavilySearch';
  }

  name: string;

  description: string;

  officialLink: string;

  apiKey: string;

  maxResults: number;

  kwargs?: Record<string, unknown>;

  constructor(fields?: TavilySearchParameters) {
    super(fields);
    const { apiKey } = fields ?? {};
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'tavily_search',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value:
        'A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.',
    });
    Object.defineProperty(this, 'officialLink', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'https://app.tavily.com/home',
    });
    Object.defineProperty(this, 'maxResults', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 5,
    });
    Object.defineProperty(this, 'apiKey', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'kwargs', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: {},
    });
    this.maxResults = fields?.maxResults ?? this.maxResults;
    this.kwargs = fields?.kwargs ?? this.kwargs;
    this.apiKey = fields?.apiKey ?? getEnvironmentVariable('TAVILY_API_KEY');
  }

  async _call(input: string, runManager, config): Promise<any> {
    const proxy = settingsManager.getPorxy();

    const body = {
      query: input,
      max_results: this.maxResults,
      api_key: this.apiKey,
    };
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      agent: proxy ? new HttpsProxyAgent(proxy) : false,
      body: JSON.stringify({ ...body, ...this.kwargs }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(
        `Request failed with status code ${response.status}: ${json.error || json.detail}`,
      );
    }
    if (!Array.isArray(json.results)) {
      throw new Error(`Could not parse Tavily results. Please try again.`);
    }
    return JSON.stringify(json.results);
  }
}
