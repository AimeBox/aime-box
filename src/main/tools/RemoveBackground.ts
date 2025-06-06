/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  Tool,
  StructuredTool,
  ToolParams,
  ToolRunnableConfig,
} from '@langchain/core/tools';

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
import { saveFile } from '../utils/common';

export interface RemoveBackgroundParameters extends ToolParams {
  modelName: string;
}

export class RemoveBackground extends BaseTool {
  schema = z.object({
    pathOrUrl: z.string().describe('local file or folder path, or Url '),
    // outputFormat: z.optional(z.enum(['base64', 'file'])).default('file'),
    savePath: z.string().optional().describe('save png file path'),
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

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<string> {
    const buffer = await new Transformers({
      task: 'image-segmentation',
      modelName: this.modelName ?? 'rmbg-1.4',
    }).rmbg(input.pathOrUrl);

    const filePath = await saveFile(buffer, `${uuidv4()}.png`, config);
    return `<file>${filePath}</file>`;
  }
}
