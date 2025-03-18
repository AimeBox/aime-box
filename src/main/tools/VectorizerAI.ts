import { Tool, ToolParams } from '@langchain/core/tools';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { Transformers } from '../utils/transformers';
import FormData from 'form-data';
import fetch, { Response } from 'node-fetch';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { z } from 'zod';
import { t } from 'i18next';

export interface VectorizerParameters extends ToolParams {
  apiKeyName: string;

  apiKey: string;

  mode: string;
}

export class Vectorizer extends BaseTool {
  schema = z.object({
    image: z.string().describe('The image to vectorize'),
  });
  configSchema: FormSchema[] = [
    {
      label: 'Api Key Name',
      field: 'apiKeyName',
      component: 'Input',
    },
    {
      label: 'Api Key',
      field: 'apiKey',
      component: 'InputPassword',
    },
    {
      label: t('common.mode'),
      field: 'mode',
      component: 'Select',
      defaultValue: 'production',
      componentProps: {
        options: [
          { label: 'Test', value: 'test' },
          { label: 'Preview', value: 'preview' },
          { label: 'Production', value: 'production' },
        ],
      },
    },
  ];

  name: string = 'vectorizer';

  description: string =
    'A tool to quickly and easily convert PNG and JPG images to SVG vector graphics';

  apiKeyName: string;

  apiKey: string;

  officialLink: string = 'https://vectorizer.ai/account';

  mode: string;

  constructor(params?: VectorizerParameters) {
    super(params);
    this.apiKey = params?.apiKey;
    this.apiKeyName = params?.apiKeyName;
    this.mode = params?.mode || 'production';
  }

  async _call(input: string, runManager, config): Promise<string> {
    // 构建Basic Auth header
    const auth = `Basic ${Buffer.from(`${this.apiKeyName}:${this.apiKey}`).toString('base64')}`;
    const form = new FormData();
    form.append('image', fs.createReadStream(input)); // 将文件添加到 FormData
    form.append('mode', this.mode);
    const res = await fetch('https://vectorizer.ai/api/v1/vectorize', {
      method: 'POST',
      headers: {
        Authorization: auth,
      },
      body: form,
    });
    if (res.ok) {
      const buffer: Buffer = await res.buffer();

      // 将 buffer 写到文件 result.svg
      // fs.writeFileSync('result.svg', buffer);
      const xml = buffer.toString();
      return xml;
    } else {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return '';
  }
}
