/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, StructuredTool } from '@langchain/core/tools';
import { HuggingFaceTransformersEmbeddings } from '../embeddings/HuggingFaceTransformersEmbeddings';

import { Transformers } from '../utils/transformers';
import { z } from 'zod';
import { isUrl } from '../utils/is';
import fs from 'fs';

export class RemoveBackground extends StructuredTool {
  schema = z.object({
    pathOrUrl: z.string().describe('local file or folder path, or Url '),
    outputFormat: z.optional(z.enum(['base64', 'file'])).default('base64'),
    outputPath: z.optional(
      z
        .string()
        .describe('if outputFormat is file ,this path for save png file'),
    ),
  });

  name = 'remove-background';

  description = 'Remove Image Background';

  output = 'c:\\windows\\...';

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const buffer = await new Transformers({
      task: 'image-segmentation',
      modelName: 'rmbg-1.4',
    }).rmbg(input.pathOrUrl);
    if (input.outputFormat == 'base64') {
      const base64String = buffer.toString('base64');
      return `data:image/png;base64,${base64String}`;
    } else {
      if (!input.outputPath) throw new Error('未选择保存的文件路径');
      fs.writeFileSync(input.outputPath, buffer);
      return input.outputPath;
    }
  }
}
