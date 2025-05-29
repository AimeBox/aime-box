import { FireCrawlLoader } from '@langchain/community/document_loaders/web/firecrawl';
import { BaseTool } from './BaseTool';
import { ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { FormSchema } from '@/types/form';
import FirecrawlApp, {
  CrawlResponse,
  ScrapeResponse,
} from '@mendable/firecrawl-js';

export interface FireCrawlParameters extends ToolParams {
  apiKey: string;
}

export class FireCrawl extends BaseTool {
  name: string = 'firecrawl';

  description: string =
    'Firecrawl is an API service that takes a URL, crawls it, and converts it into clean markdown';

  apiKey: string;

  configSchema: FormSchema[] = [
    {
      label: 'Api Key',
      field: 'apiKey',
      component: 'InputPassword',
      required: true,
    },
  ];

  constructor(fields?: FireCrawlParameters) {
    super(fields);
    const { apiKey } = fields ?? {};
    this.apiKey = apiKey ?? getEnvironmentVariable('FIRECRAWL_API_KEY');
  }

  schema = z.object({
    url: z.string(),
    mode: z
      .enum(['scrape', 'crawl'])
      .default('scrape')
      .describe(
        'The mode to run the crawler in. Can be "scrape" for single urls or "crawl" for all accessible subpages',
      )
      .optional(),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const app = new FirecrawlApp({ apiKey: this.apiKey });

    if (input.mode == 'scrape') {
      const scrapeResult = (await app.scrapeUrl(input.url, {
        formats: ['markdown'],
      })) as ScrapeResponse;

      if (!scrapeResult.success) {
        throw new Error(`Failed to scrape: ${scrapeResult.error}`);
      }
      return scrapeResult.markdown;
    } else if (input.mode == 'crawl') {
      const crawlResult = (await app.crawlUrl(input.url, {
        limit: 100,
        scrapeOptions: {
          formats: ['markdown'],
        },
      })) as CrawlResponse;
      return crawlResult.url;
    } else {
      throw new Error('Invalid mode');
    }
  }
}
