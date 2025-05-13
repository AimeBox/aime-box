import { Tool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import iconv from 'iconv-lite';
import { BraveSearch } from '@langchain/community/tools/brave_search';
import fetch from 'node-fetch';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import settingsManager from '@/main/settings';
import { parseStringPromise } from 'xml2js';

export interface ArxivParameters extends ToolParams {}

export class ArxivTool extends BaseTool {
  schema = z.object({
    query: z.string().describe('The search query to search for.'),
    field: z
      .enum(['all', 'title', 'author', 'id'])
      .default('all')
      .describe('The field to search in.'),
    limit: z.number().optional().describe('The number of results to return.'),
  });

  configSchema: FormSchema[] = [];

  name: string = 'arxiv_search';

  description: string = 'fetching and searching papers.';

  officialLink: string = 'https://info.arxiv.org/about/index.html';

  apiKey: string;

  maxResults: number;

  kwargs?: Record<string, unknown>;

  constructor(fields?: ArxivParameters) {
    super(fields);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<any> {
    const proxy = settingsManager.getPorxy();
    const limit = input.limit ?? 10;
    const headers = {
      // 'X-Subscription-Token': this.apiKey,
      // Accept: 'application/json',
    };
    let field: 'all' | 'ti' | 'au' | 'id' = 'all';
    if (input.field === 'all') field = 'all';
    else if (input.field === 'title') field = 'ti';
    else if (input.field === 'author') field = 'au';
    else if (input.field === 'id') field = 'id';

    const searchUrl = new URL(
      `http://export.arxiv.org/api/query?search_query=${field}:"${encodeURIComponent(input.query)}"&sortBy=lastUpdatedDate&sortOrder=descending&max_results=${limit}`,
    );
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      agent: proxy ? new HttpsProxyAgent(proxy) : false,
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const parsedResponse = await response.text();
    if (!response.ok) {
      throw new Error(`Request failed with status code ${response.status}`);
    }
    const result = await parseStringPromise(parsedResponse, {
      explicitArray: false,
    });
    const finalResults = result.feed.entry.map((x) => {
      return {
        id: x.id,
        title: x.title,
        summary: x.summary,
        author: x.author.map((a) => a.name).join(','),

        link: x.link
          .filter((a) => a['$'].type == 'application/pdf')
          .map((a) => a['$'].href)
          .join(','),
        updated: x.updated,
        published: x.published,
        //category: x.category,
      };
    });

    return JSON.stringify(finalResults);
  }
}
