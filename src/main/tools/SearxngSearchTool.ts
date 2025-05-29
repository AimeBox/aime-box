import { FormSchema } from '@/types/form';
import { SearxngSearch } from '@langchain/community/tools/searxng_search';
import { BaseTool } from './BaseTool';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ToolSchemaBase } from '@langchain/core/tools';
import { z } from 'zod';

interface SearxngSearchParams {
  /**
   * @default 10
   * Number of results included in results
   */
  numResults?: number;
  /** Comma separated list, specifies the active search categories
   * https://docs.searxng.org/user/configured_engines.html#configured-engines
   */
  categories?: string;
  /** Comma separated list, specifies the active search engines
   * https://docs.searxng.org/user/configured_engines.html#configured-engines
   */
  engines?: string;
  /** Code of the language. */
  language?: string;
  /** Search page number. */
  pageNumber?: number;
  /**
   * day / month / year
   *
   * Time range of search for engines which support it. See if an engine supports time range search in the preferences page of an instance.
   */
  timeRange?: number;
  /**
   * Throws Error if format is set anything other than "json"
   * Output format of results. Format needs to be activated in search:
   */
  format?: 'json';
  /** Open search results on new tab. */
  resultsOnNewTab?: 0 | 1;
  /** Proxy image results through SearXNG. */
  imageProxy?: boolean;
  autocomplete?: string;
  /**
   * Filter search results of engines which support safe search. See if an engine supports safe search in the preferences page of an instance.
   */
  safesearch?: 0 | 1 | 2;
}

export class SearxngSearchTool extends BaseTool {
  schema = z.object({
    query: z.string().describe('The search query to perform'),
  });

  name: string = 'searxng_search';

  description: string =
    'A meta search engine. Useful for when you need to answer questions about current events. Input should be a search query. Output is a JSON array of the query results';

  configSchema: FormSchema[] = [
    {
      label: 'API Base',
      field: 'apiBase',
      component: 'Input',
      required: true,
      defaultValue: 'https://searxng.org',
    },
  ];

  apiBase?: string;

  params: SearxngSearchParams;

  constructor(params: any) {
    super(params);
    this.apiBase =
      params?.apiBase ||
      getEnvironmentVariable('SEARXNG_API_BASE') ||
      'https://searxng.org';
    this.params = {
      numResults: 10,
      format: 'json',
    };
  }

  buildUrl(path: string, parameters: any, baseUrl: string) {
    const nonUndefinedParams = Object.entries(parameters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, value.toString()]); // Avoid string conversion
    const searchParams = new URLSearchParams(nonUndefinedParams);
    return `${baseUrl}/${path}?${searchParams}`;
  }

  async _call(input: z.infer<typeof this.schema>, runManager, config) {
    const queryParams = {
      q: input.query,
      ...this.params,
    };
    const url = this.buildUrl('search', queryParams, this.apiBase);
    const maxTryTime = 3;

    for (let index = 0; index < maxTryTime; index++) {
      const res = await this.search(url);
      if (res != 'No good results found.') {
        return res;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    throw new Error('No good results found.');
  }

  async search(url: string) {
    const resp = await fetch(url, {
      method: 'POST',
      // headers: this.headers,
      signal: AbortSignal.timeout(10 * 1000), // 5 seconds
    });
    if (!resp.ok) {
      throw new Error(resp.statusText);
    }
    const res = await resp.json();
    if (
      !res.results.length &&
      !res.answers.length &&
      !res.infoboxes.length &&
      !res.suggestions.length
    ) {
      return 'No good results found.';
    } else if (res.results.length) {
      const response = [];
      res.results.forEach((r) => {
        response.push(
          JSON.stringify({
            title: r.title || '',
            link: r.url || '',
            snippet: r.content || '',
          }),
        );
      });
      return `[${response.slice(0, this.params?.numResults).join(', ')}]`;
    } else if (res.answers.length) {
      return res.answers[0];
    } else if (res.infoboxes.length) {
      return res.infoboxes[0]?.content.replaceAll(/<[^>]+>/gi, '');
    } else if (res.suggestions.length) {
      let suggestions = 'Suggestions: ';
      res.suggestions.forEach((s) => {
        suggestions += `${s}, `;
      });
      return `[${suggestions}]`;
    } else {
      return 'No good results found.';
    }
  }
}
