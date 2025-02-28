import {
  DuckDuckGoSearch,
  DuckDuckGoSearchParameters,
} from '@langchain/community/tools/duckduckgo_search';
import { SafeSearchType, search, SearchOptions } from 'duck-duck-scrape';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class DuckDuckGoSearchTool extends DuckDuckGoSearch {
  private _searchOptions?: SearchOptions;

  private _maxResults: number | undefined;

  constructor(params?: DuckDuckGoSearchParameters) {
    super(params);
    const { searchOptions, maxResults } = params ?? {};
    this._searchOptions = searchOptions;
    if (!this._searchOptions) {
      this._searchOptions = {
        safeSearch: SafeSearchType.STRICT,
        locale: settingsManager.getLanguage()?.toLowerCase(),
      } as SearchOptions;
    }
    this._maxResults = maxResults || this._maxResults;
  }

  async _call(input: string): Promise<string> {
    const httpProxy = settingsManager.getHttpAgent();
    const { results } = await search(input, this._searchOptions, {
      agent: httpProxy ?? false,
    });
    return JSON.stringify(
      results
        .map((result) => ({
          title: result.title,
          link: result.url,
          snippet: result.description,
        }))
        .slice(0, this._maxResults),
    );
  }
}
