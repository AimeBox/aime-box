import { Tool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import iconv from 'iconv-lite';
import { BraveSearch } from '@langchain/community/tools/brave_search';
import fetch from 'node-fetch';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { BaseTool } from '../BaseTool';
import { FormSchema } from '@/types/form';
import settingsManager from '@/main/settings';

export interface BraveSearchParameters extends ToolParams {
  apiKey: string;
}

export class BraveSearchTool extends BaseTool {
  schema = z.object({
    query: z.string().describe('The search query to search for.'),
    type: z
      .enum(['web', 'news', 'images', 'videos', 'suggest', 'spellcheck'])
      .default('web')
      .optional(),
  });

  configSchema: FormSchema[] = [
    {
      label: 'Api Key',
      field: 'apiKey',
      component: 'InputPassword',
    },
    // {
    //   label: 'Max Results',
    //   field: 'maxResults',
    //   component: 'InputNumber',
    //   defaultValue: 5,
    // },
  ];

  name: string = 'brave_web_search';

  description: string =
    'a search engine. useful for when you need to answer questions about current events. input should be a search query.';

  officialLink: string = 'https://api-dashboard.search.brave.com/app/keys';

  apiKey: string;

  maxResults: number;

  kwargs?: Record<string, unknown>;

  constructor(fields?: BraveSearchParameters) {
    super(fields);
    const { apiKey } = fields ?? {};
    this.apiKey =
      apiKey ||
      settingsManager.getSettings().webSearchEngine.brave.apiKey ||
      getEnvironmentVariable('BRAVE_SEARCH_API_KEY');
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<any> {
    const proxy = settingsManager.getPorxy();

    const headers = {
      'X-Subscription-Token': this.apiKey,
      Accept: 'application/json',
    };
    const searchUrl = new URL(
      `https://api.search.brave.com/res/v1/${input.type || 'web'}/search?q=${encodeURIComponent(input.query)}`,
    );
    const response = await fetch(searchUrl, {
      headers,
      agent: proxy ? new HttpsProxyAgent(proxy) : false,
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const parsedResponse = await response.json();
    if (!response.ok) {
      throw new Error(
        `Request failed with status code ${response.status}: ${parsedResponse.error || parsedResponse.detail}`,
      );
    }
    const webSearchResults = parsedResponse.web?.results;
    const finalResults = Array.isArray(webSearchResults)
      ? webSearchResults.map((item) => ({
          title: item.title,
          link: item.url,
          snippet: item.description,
        }))
      : [];
    return JSON.stringify(finalResults);

    // const body = {
    //   query: input.query,
    //   max_results: this.maxResults,
    //   api_key: this.apiKey,
    // };
    // const response = await fetch('https://api.tavily.com/search', {
    //   method: 'POST',
    //   headers: {
    //     'content-type': 'application/json',
    //   },
    //   agent: proxy ? new HttpsProxyAgent(proxy) : false,
    //   body: JSON.stringify({ ...body, ...this.kwargs }),
    // });
    // const json = await response.json();
    // if (!response.ok) {
    //   throw new Error(
    //     `Request failed with status code ${response.status}: ${json.error || json.detail}`,
    //   );
    // }
    // if (!Array.isArray(json.results)) {
    //   throw new Error(`Could not parse Tavily results. Please try again.`);
    // }
    // return JSON.stringify(json.results);
  }
}
