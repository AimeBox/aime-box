import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';

import {
  DallEAPIWrapper,
  DallEAPIWrapperParams,
  OpenAIClient,
  ClientOptions,
} from '@langchain/openai';
import settingsManager from '../settings';
import { BaseTool, ToolTag } from './BaseTool';
import { FormSchema } from '@/types/form';
import { base64ToFile, downloadFile, saveFile } from '../utils/common';
import { getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';

export interface DallEParameters extends ToolParams {
  apiBase: string;
  apiKey: string;
  model: 'dall-e-3' | 'dall-e-2' | 'gpt-image-1';
}

export class DallE extends BaseTool {
  tags: string[] = [ToolTag.IMAGE];

  schema = z.object({
    prompt: z.string().describe('image prompt'),
    // quality: z
    //   .enum(['standard', 'hd'])
    //   .optional()
    //   .default('standard')
    //   .describe('Image Quality'),
    size: z
      .enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
      .optional()
      .default('1024x1024'),
    background: z
      .enum(['transparent', 'opaque', 'auto'])
      .optional()
      .default('auto'),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiBase',
      component: 'Input',
      label: 'API Base URL',
      defaultValue: 'https://api.openai.com/v1',
    },
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
    {
      field: 'model',
      component: 'Select',
      label: 'Model',
      defaultValue: 'dall-e-3',
      componentProps: {
        options: [
          { label: 'Dall-E 3', value: 'dall-e-3' },
          { label: 'Dall-E 2', value: 'dall-e-2' },
          { label: 'GPT-Image-1', value: 'gpt-image-1' },
        ],
      },
    },
  ];

  name: string = 'dalle';

  description: string =
    'A wrapper around OpenAI DALL-E API. Useful for when you need to generate images from a text description. Input should be an image description.';

  style?: 'natural' | 'vivid';

  n?: number = 1;

  apiBase: string;

  apiKey: string;

  client: OpenAIClient;

  model: 'dall-e-3' | 'dall-e-2' | 'gpt-image-1';

  constructor(params?: DallEParameters) {
    super(params);
    this.model = params?.model || 'dall-e-3';
    this.apiKey = params?.apiKey || 'NULL';
    this.apiBase = params?.apiBase || 'https://api.openai.com/v1';
    const clientConfig = {
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
      baseURL: this.apiBase,
      httpAgent: settingsManager.getHttpAgent(),
    } as ClientOptions;
    this.client = new OpenAIClient(clientConfig);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const generateImageFields = {
      model: this.model,
      prompt: input.prompt,
      n: 1,
      size: input.size,
      response_format: 'url' as 'url' | 'b64_json',
      style: this.style,
      // quality: input.quality,
      background: input.background,
    };

    if (this.model !== 'gpt-image-1') {
      delete generateImageFields.background;
    } else {
      delete generateImageFields.response_format;
    }

    if (this.n > 1) {
      const results = await Promise.all(
        Array.from({ length: this.n }).map(() =>
          this.client.images.generate(generateImageFields),
        ),
      );
      return this.processMultipleGeneratedUrls(results, 'url');
    }
    const response = await this.client.images.generate(generateImageFields);
    let data = '';
    let loaclFile = '';
    [data] = response.data
      .map((item) => item.url)
      .filter((url) => url !== 'undefined');
    loaclFile = await saveFile(data, `${uuidv4()}.png`, config);

    return `<file>${loaclFile}</file>`;
  }

  processMultipleGeneratedUrls(response, dallEResponseFormat) {
    if (dallEResponseFormat === 'url') {
      return response.flatMap((res) => {
        const imageUrlContent = res.data
          .flatMap((item) => {
            if (!item.url) return [];
            return {
              type: 'image_url',
              image_url: item.url,
            };
          })
          .filter(
            (item) =>
              item !== undefined &&
              item.type === 'image_url' &&
              typeof item.image_url === 'string' &&
              item.image_url !== undefined,
          );
        return imageUrlContent;
      });
    } else {
      return response.flatMap((res) => {
        const b64Content = res.data
          .flatMap((item) => {
            if (!item.b64_json) return [];
            return {
              type: 'image_url',
              image_url: {
                url: item.b64_json,
              },
            };
          })
          .filter(
            (item) =>
              item !== undefined &&
              item.type === 'image_url' &&
              typeof item.image_url === 'object' &&
              'url' in item.image_url &&
              typeof item.image_url.url === 'string' &&
              item.image_url.url !== undefined,
          );
        return b64Content;
      });
    }
  }
}
