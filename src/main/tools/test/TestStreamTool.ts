import { BaseTool } from '@/main/tools/BaseTool';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { z } from 'zod';

export class TestStreamTool extends BaseTool {
  schema = z.object({ time: z.number().describe('输出次数').min(10) });

  name: string = 'test_stream';

  description: string = '测试流式输出';

  constructor() {
    super();
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    let last_chunk;
    for await (const chunk of stream) {
      last_chunk = chunk;
    }
    return last_chunk;
  }

  async stream(
    input: z.infer<typeof this.schema>,
    config?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    let that = this;
    async function* generateStream() {
      for (let i = 0; i < input.time; i++) {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, 1000);
        });
        yield `test: ${i} [${new Date().toISOString()}]\n`;
      }
      // 结束信号
      yield 'end';
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}
