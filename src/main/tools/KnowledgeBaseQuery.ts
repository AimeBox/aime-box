import { IterableReadableStream } from '@langchain/core/utils/stream';
import { BaseTool } from './BaseTool';
import { z } from 'zod';
import { ToolParams } from '@langchain/core/tools';
import { kbManager } from '../knowledgebase';
import { dbManager } from '../db';
import { KnowledgeBase } from '@/entity/KnowledgeBase';

interface KnowledgeBaseQueryParameters extends ToolParams {
  knowledgebaseIds?: string[] | undefined;
  limit?: number;
}

export class KnowledgeBaseQuery extends BaseTool {
  schema = z.object({
    knowledgebaseIds: z
      .array(z.string())
      .optional()
      .describe('knowledgebase id'),
    question: z.string().describe('question'),
  });

  output = 'path\n├── file-1.mp4\n├── file-2.mp4\n├── ...';

  name: string = 'knowledgebase-query';

  description: string =
    'find the context related to the question from the knowledge base.';

  knowledgebaseIds?: string[] | undefined;

  limit?: number;

  constructor(params?: KnowledgeBaseQueryParameters) {
    super(params);
    this.knowledgebaseIds = params?.knowledgebaseIds;
    this.limit = params?.limit ?? 10;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string[] | string> {
    const stream = await this.stream(input, config);
    let output = '';
    for await (const chunk of stream) {
      output += chunk;
    }
    return output || 'No result found';
  }

  private escapeXmlAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async stream(
    input: z.infer<typeof this.schema>,
    options,
  ): Promise<IterableReadableStream<any>> {
    if (!input.question) {
      throw new Error('question is required');
    }
    const that = this;
    async function* generateStream() {
      if (!that.knowledgebaseIds) {
        const kb_repository = dbManager.dataSource.getRepository(KnowledgeBase);
        that.knowledgebaseIds = (await kb_repository.find()).map((x) => x.id);
      }
      if (that.knowledgebaseIds.length > 0) {
        for (const kbId of that.knowledgebaseIds) {
          try {
            const result = await kbManager.query(
              kbId,
              input.question as string,
              {
                k: that.limit,
              },
            );
            const output = result
              .filter(
                (x) =>
                  x.score > 0.5 &&
                  (!x.reranker_score || x.reranker_score > 0.5),
              )
              .map(
                (x) =>
                  `<content title="${that.escapeXmlAttribute(x.document.metadata.title || '')}" src="${that.escapeXmlAttribute(x.document.metadata.source || '')}">\n${x.document.pageContent}\n</content>`,
              );

            yield output.join('\n');
          } catch {}
        }
      }
      yield '';
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
