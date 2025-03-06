import { IterableReadableStream } from '@langchain/core/utils/stream';
import { BaseTool } from './BaseTool';
import { z } from 'zod';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { ToolParams } from '@langchain/core/tools';
import { kbManager } from '../knowledgebase';

interface KnowledgeBaseQueryParameters extends ToolParams {
  knowledgebaseIds?: string[] | undefined;
  limit?: number;
}

export class KnowledgeBaseQuery extends BaseTool {
  schema = z.object({
    knowledgebaseIds: z
      .optional(z.array(z.string()))
      .describe('knowledgebase id'),
    question: z.string().describe('question'),
  });

  output = 'path\n├── file-1.mp4\n├── file-2.mp4\n├── ...';

  name: string = 'knowledgebase-query';

  description: string = 'input the question to query from knowledgebase';

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
    return output;
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
      for (const kbId of that.knowledgebaseIds) {
        try {
          const result = await kbManager.query(kbId, input.question as string, {
            k: that.limit,
          });
          const output = result
            .filter(
              (x) =>
                x.score > 0.5 && (!x.reranker_score || x.reranker_score > 0.5),
            )
            .map(
              (x) =>
                `<content>\n${x.document.metadata.title ? `TITLE:[${x.document.metadata.title}](${x.document.metadata.source})\n` : ''}\nPAGE CONTENT:\n${x.document.pageContent}\n</content>`,
            );

          yield output.join('\n');
        } catch {}
      }
      yield '';
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
