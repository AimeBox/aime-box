import { Tool, ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { z } from 'zod';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import { BaseTool, ToolTag } from './BaseTool';
import { FormSchema } from '@/types/form';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { imageToBase64 } from '../utils/common';

export interface BFLImageGenerationParameters extends ToolParams {
  apiKey: string;
}
const BFL_API_URL = 'https://api.bfl.ai/v1';
const BFL_OFFICIAL_LINK = 'https://dashboard.bfl.ai/keys';
export class BFLImageGeneration extends BaseTool {
  toolKitName: string = 'bfl';

  tags?: string[] = [ToolTag.IMAGE];

  officialLink: string = BFL_OFFICIAL_LINK;

  schema = z.object({
    model: z
      .enum([
        'flux-dev',
        'flux-pro',
        'flux-pro-1.1',
        'flux-pro-1.1-ultra',
        'flux-kontext-max',
        'flux-kontext-pro',
      ])
      .default('flux-pro-1.1'),
    prompt: z.string(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']).default('1:1').optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'bfl_image_generation';

  description: string = 'generate the image from the prompt';

  apiKey?: string;

  constructor(params?: BFLImageGenerationParameters) {
    super();
    this.apiKey = params?.apiKey || getEnvironmentVariable('BFL_API_KEY');
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-key': this.apiKey,
    };
    const body: any = input;
    const { model } = input;
    delete body.model;

    const response = await fetch(`${BFL_API_URL}/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const { request_id } = data;
    const result = await get_result(request_id, this.apiKey);
    return result;
  }
}

export class BFLImageEditing extends BaseTool {
  toolKitName: string = 'bfl';

  officialLink: string = BFL_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.IMAGE];

  schema = z.object({
    // model: z
    //   .enum(['flux-kontext-max', 'flux-kontext-pro'])
    //   .describe('flux-kontext-pro'),
    prompt: z.string(),
    input_image: z.string().describe('image file path'),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'bfl_image_editing';

  description: string =
    'for Text-to-Image generation and advanced Image Editing.';

  apiKey?: string;

  constructor(params?: BFLImageGenerationParameters) {
    super();
    this.apiKey = params?.apiKey || getEnvironmentVariable('BFL_API_KEY');
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-key': this.apiKey,
    };
    const body: any = input;
    if (fs.existsSync(body.input_image)) {
      body.input_image = await imageToBase64(body.input_image);
    } else {
      throw new Error(`Input image path not found: ${body.input_image}`);
    }
    const model = 'flux-kontext-pro';

    const response = await fetch(`${BFL_API_URL}/${model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    const { request_id } = data;
    const result = await get_result(request_id, this.apiKey);
    return result;
  }
}

const get_result = async (request_id: string, apiKey: string) => {
  const headers = {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'x-key': apiKey,
  };
  const response = await fetch(`${BFL_API_URL}/get_result?id=${request_id}`, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  return data;
};
