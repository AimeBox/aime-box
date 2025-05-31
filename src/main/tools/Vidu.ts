import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { z } from 'zod';

export interface ViduParameters extends ToolParams {
  apiKey: string;
}
const VIDU_API_URL = 'https://api.vidu.cn/ent/v2';

export class ViduText2Video extends BaseTool {
  toolKitName: string = 'vidu';

  schema = z.object({
    model: z.enum(['viduq1', 'viduq1.5']).describe('viduq1.5'),
    style: z.enum(['general', 'anime']).describe('general').optional(),
    prompt: z.string().max(1500),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']).describe('16:9').optional(),
    movement_amplitude: z
      .enum(['auto', 'small', 'medium', 'large'])
      .describe('auto')
      .optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'vidu_text2video';

  description: string = 'generate the video from the text';

  apiKey?: string;

  constructor(params?: ViduParameters) {
    super();
    this.apiKey = params?.apiKey;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
    const body = input;
    const response = await fetch(`${VIDU_API_URL}/text2video`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: input.prompt,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
}

export class ViduImage2Video extends BaseTool {
  toolKitName: string = 'vidu';

  schema = z.object({
    model: z.enum(['viduq1', 'viduq1.5', 'viduq2.0']).describe('viduq1.5'),
    start_image: z
      .string()
      .describe(
        'image file suport local file(*.png、*.jpeg、*.jpg、*.webp ),or url',
      ),
    end_image: z
      .string()
      .optional()
      .describe(
        'image file suport local file(*.png、*.jpeg、*.jpg、*.webp ),or url',
      ),
    prompt: z.string().max(1500),
    duration: z.number().describe('duration').optional(),
    seed: z.number().describe('seed').optional(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']).describe('16:9').optional(),
    movement_amplitude: z
      .enum(['auto', 'small', 'medium', 'large'])
      .describe('auto')
      .optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'vidu_image2video';

  description: string = 'generate the video from the image';

  apiKey?: string;

  constructor(params?: ViduParameters) {
    super();
    this.apiKey = params?.apiKey;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
    const body: any = input;
    if (input.end_image) {
      body.images = [input.start_image, input.end_image];
    } else {
      body.images = [input.start_image];
    }
    delete body.start_image;
    delete body.end_image;
    const response = await fetch(
      `${VIDU_API_URL}/${input.end_image ? 'start-end2video' : 'image2video'}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
}

export class ViduText2Audio extends BaseTool {
  toolKitName: string = 'vidu';

  schema = z.object({
    model: z.enum(['audio1.0']).describe('audio1.0'),
    prompt: z.string().max(1500),
    duration: z
      .number()
      .max(10)
      .min(2)
      .default(10)
      .describe('duration')
      .optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'vidu_text2audio';

  description: string = 'generate the audio from the text';

  apiKey?: string;

  constructor(params?: ViduParameters) {
    super();
    this.apiKey = params?.apiKey;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
    const body: any = input;
    const response = await fetch(`${VIDU_API_URL}/text2audio`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
}

export class ViduTiming2Audio extends BaseTool {
  toolKitName: string = 'vidu';

  schema = z.object({
    model: z.enum(['audio1.0']).describe('audio1.0'),
    timing_prompts: z.array(
      z.object({
        from: z.number(),
        to: z.number(),
        prompt: z.string(),
      }),
    ),
    duration: z
      .number()
      .max(10)
      .min(2)
      .default(10)
      .describe('duration')
      .optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'vidu_timing2audio';

  description: string = 'generate the audio from the timing prompts';

  apiKey?: string;

  constructor(params?: ViduParameters) {
    super();
    this.apiKey = params?.apiKey;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
    };
    const body: any = input;
    const response = await fetch(`${VIDU_API_URL}/timing2audio`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
  }
}

export class ViduToolKit extends BaseToolKit {
  name: string = 'vidu';

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'Input',
      label: 'API Key',
      required: true,
    },
  ];

  apiKey?: string;

  constructor(params?: ViduParameters) {
    super();
    this.apiKey = params?.apiKey;
  }

  tools = [
    new ViduText2Video(),
    new ViduImage2Video(),
    new ViduText2Audio(),
    new ViduTiming2Audio(),
  ];
}
