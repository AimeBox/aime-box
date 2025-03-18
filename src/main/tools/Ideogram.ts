import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString, isUrl } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { PlaywrightWebBaseLoader } from '@langchain/community/document_loaders/web/playwright';
import settingsManager from '../settings';
import { getDataPath } from '../utils/path';
import { chromium } from 'playwright';

import fetch from 'node-fetch';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';

export interface IdeogramParameters extends ToolParams {
  apiKey: string;

  apiBase: string;

  model: string;
}

export class Ideogram extends BaseTool {
  schema = z.object({
    prompt: z.string().describe('The prompt to use to generate the image.'),
    negative_prompt: z
      .string()
      .optional()
      .describe(
        'Description of what to exclude from an image. Descriptions in the prompt take precedence to descriptions in the negative prompt.',
      ),
    aspect_ratio: z
      .enum([
        'ASPECT_10_16',
        'ASPECT_16_10',
        'ASPECT_9_16',
        'ASPECT_16_9',
        'ASPECT_3_2',
        'ASPECT_2_3',
        'ASPECT_4_3',
        'ASPECT_3_4',
        'ASPECT_1_1',
        'ASPECT_1_3',
        'ASPECT_3_1',
      ])
      .optional()
      .default('ASPECT_1_1')
      .describe(
        'The aspect ratio to use for image generation, which determines the image’s resolution',
      ),
    style_type: z
      .enum(['GENERAL', 'REALISTIC', 'DESIGN', 'RENDER_3D', 'ANIME'])
      .optional()
      .describe('The style type to generate with'),
    // resolution: z
    //   .enum([])
    //   .optional()
    //   .describe(
    //     'The resolution to use for image generation, represented in width x height',
    //   ),
  });

  configSchema: FormSchema[] = [
    {
      label: 'Api Key',
      field: 'apiKey',
      component: 'InputPassword',
    },
    {
      label: 'Api Base',
      field: 'apiBase',
      defaultValue: 'https://api.ideogram.ai',
      component: 'Input',
    },
    {
      label: t('common.model'),
      field: 'model',
      component: 'Select',
      defaultValue: 'V_2',
      componentProps: {
        options: [
          { label: 'V_1', value: 'V_1' },
          { label: 'V_1_TURBO', value: 'V_1_TURBO' },
          { label: 'V_2', value: 'V_2' },
          { label: 'V_2_TURBO', value: 'V_2_TURBO' },
          { label: 'V_2A', value: 'V_2A' },
          { label: 'V_2A_TURBO', value: 'V_2A_TURBO' },
        ],
      },
    },
  ];

  name: string = 'ideogram';

  description: string = 'Generate images with Ideogram';

  officialLink: string = 'https://ideogram.ai/manage-api';

  apiKey: string = 'NULL';

  apiBase: string = 'https://api.ideogram.ai';

  model: string = 'V_2';

  constructor(params?: IdeogramParameters) {
    super(params);
    this.apiKey = params?.apiKey;
    this.apiBase = params?.apiBase;
    this.model = params?.model;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'Api-Key': this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        image_request: {
          model: this.model,
          magic_prompt_option: 'AUTO',
          prompt: input.prompt,
          aspect_ratio: input.aspect_ratio,
          style_type: input.style_type,
          //seed: 889978,
          negative_prompt: input.negative_prompt,
        },
      }),
    };

    const url = `${this.apiBase.replace(/\/+$/, '')}/generate`;
    const res = await fetch(url, options);
    const resJson = await res.json();

    return resJson.data.map(
      (x) => `https://wsrv.nl/?url=${encodeURIComponent(x.url)}`,
    );
  }
}
