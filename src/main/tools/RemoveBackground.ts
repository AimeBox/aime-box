/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, StructuredTool, ToolParams } from '@langchain/core/tools';
import { HuggingFaceTransformersEmbeddings } from '../embeddings/HuggingFaceTransformersEmbeddings';

import { Transformers } from '../utils/transformers';
import { z } from 'zod';
import { isUrl } from '../utils/is';
import fs from 'fs';
import path from 'path';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';

export interface RemoveBackgroundParameters extends ToolParams {
  modelName: string;
}

export class RemoveBackground extends BaseTool {
  schema = z.object({
    pathOrUrl: z.string().describe('local file or folder path, or Url '),
    outputFormat: z.optional(z.enum(['base64', 'file'])).default('file'),
    outputPath: z.optional(
      z
        .string()
        .describe('if outputFormat is file ,this path for save png file'),
    ),
  });

  configSchema: FormSchema[] = [
    {
      label: t('common.model'),
      field: 'modelName',
      component: 'Select',
      defaultValue: 'rmbg-1.4',
      componentProps: {
        options: [
          { label: 'rmbg-2.0', value: 'rmbg-2.0' },
          { label: 'rmbg-1.4', value: 'rmbg-1.4' },
        ],
      },
    },
  ];

  name = 'remove-background';

  description = 'Remove Image Background';

  modelName: string;

  output = 'c:\\windows\\...';

  constructor(params?: RemoveBackgroundParameters) {
    super(params);
    this.modelName = params?.modelName;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const buffer = await new Transformers({
      task: 'image-segmentation',
      modelName: this.modelName ?? 'rmbg-1.4',
    }).rmbg(input.pathOrUrl);
    if (input.outputFormat == 'base64') {
      const base64String = buffer.toString('base64');
      return `data:image/png;base64,${base64String}`;
    } else {
      if (!input.outputPath)
        input.outputPath = path.join(getTmpPath(), `${uuidv4()}.png`);
      fs.writeFileSync(input.outputPath, buffer);
      return input.outputPath;
    }
  }
}
