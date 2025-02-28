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

export interface IdeogramParameters extends ToolParams {
  apiKey: string;

  apiBase: string;

  model: string;
}

export class Ideogram extends StructuredTool {
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

  static lc_name() {
    return 'Ideogram';
  }

  name: string;

  description: string;

  officialLink: string;

  apiKey: string;

  apiBase: string;

  model: string;

  constructor(params?: IdeogramParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'Ideogram',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'view web page',
    });
    Object.defineProperty(this, 'apiKey', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'NULL',
    });
    Object.defineProperty(this, 'apiBase', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'https://api.ideogram.ai',
    });
    Object.defineProperty(this, 'model', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'V_2',
    });
    Object.defineProperty(this, 'officialLink', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'https://ideogram.ai/manage-api',
    });

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
