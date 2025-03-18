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
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';

export interface DallEParameters extends ToolParams {
  apiKey: string;
  model: 'dall-e-3' | 'dall-e-2';
}

export class DallE extends BaseTool {
  schema = z.object({
    prompt: z.string().describe('image prompt'),
    quality: z
      .optional(z.enum(['standard', 'hd']))
      .default('standard')
      .describe('Image Quality'),
    dallEResponseFormat: z
      .optional(z.enum(['url', 'b64_json']))
      .default('url')
      .describe('Image Response Format'),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
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
        ],
      },
    },
  ];

  name: string = 'dalle';

  description: string =
    'A wrapper around OpenAI DALL-E API. Useful for when you need to generate images from a text description. Input should be an image description.';

  model?: 'dall-e-3' | 'dall-e-2';

  style?: 'natural' | 'vivid';

  n?: number = 1;

  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

  apiKey: string;

  client: OpenAIClient;

  constructor(params?: DallEParameters) {
    super();
    this.model = params?.model || 'dall-e-3';
    this.apiKey = params?.apiKey;
    const clientConfig = {
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
      httpAgent: settingsManager.getHttpAgent(),
    } as ClientOptions;
    this.client = new OpenAIClient(clientConfig);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    // const w = new DallEAPIWrapper({
    //   model: this.model,
    //   style: this.style,
    //   quality: input.quality,
    //   n: this.n,
    //   size: this.size,
    //   dallEResponseFormat: input.dallEResponseFormat,
    //   apiKey: this.apiKey,
    //   openAIApiKey: this.apiKey,
    // });
    const generateImageFields = {
      model: this.model,
      prompt: input.prompt,
      n: 1,
      size: this.size,
      response_format: input.dallEResponseFormat,
      style: this.style,
      quality: input.quality,
    };
    if (this.n > 1) {
      const results = await Promise.all(
        Array.from({ length: this.n }).map(() =>
          this.client.images.generate(generateImageFields),
        ),
      );
      return this.processMultipleGeneratedUrls(
        results,
        input.dallEResponseFormat,
      );
    }
    const response = await this.client.images.generate(generateImageFields);
    let data = '';
    if (input.dallEResponseFormat === 'url') {
      [data] = response.data
        .map((item) => item.url)
        .filter((url) => url !== 'undefined');
    } else {
      [data] = response.data
        .map((item) => item.b64_json)
        .filter((b64_json) => b64_json !== 'undefined');
    }
    return data;
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
