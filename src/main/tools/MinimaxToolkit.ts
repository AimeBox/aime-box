import { StructuredTool, Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path, { resolve } from 'path';
import { app } from 'electron';
import fs from 'fs';

import { getModelsPath, getTmpPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool, BaseToolKit } from './BaseTool';
import { FormSchema } from '@/types/form';
import { appManager } from '../app/AppManager';
import providersManager from '../providers';
import { getProviderModel } from '../utils/providerUtil';
import { saveFile } from '../utils/common';
import { Toolkit } from 'langchain/agents';
import { ProviderType } from '@/entity/Providers';
import { MinimaxProvider } from '../providers/MinimaxProvider';

export interface MinimaxToolkitParameters extends ToolParams {
  providerId: string;
}

export class MinimaxTextToSpeech extends BaseTool {
  schema = z.object({
    text: z.string().describe('input Text'),
    model: z.enum(['speech-02-hd', 'speech-02-turbo']),
    emotion: z.enum([
      'happy',
      'sad',
      'angry',
      'fearful',
      'disgusted',
      'surprised',
      'neutral',
    ]),
    speed: z.number().default(1.0).optional().describe('speed'),
  });

  name: string = 'minimax_text_to_speech';

  description: string = 'text to speech';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const buffer = await provider.speech(input.model, input.text, {
      emotion: input.emotion,
      stream: false,
      speed: input.speed || 1,
      english_normalization: true,
      format: 'wav',
    });
    if (buffer) {
      const savePath = await saveFile(buffer, `${uuidv4()}.wav`, config);
      appManager.sendEvent('play-audio', {
        filename: `file://${savePath}`,
      });
      return `<file>${savePath}</file>`;
    }
    return 'tts failed';
  }
}

export class MinimaxGetVoice extends BaseTool {
  schema = z.object({
    voice_type: z
      .enum([
        'system',
        'voice_cloning',
        'voice_generation',
        'music_generation',
        'all',
      ])
      .default('voice_cloning')
      .optional(),
  });

  name: string = 'minimax_get_voice';

  description: string = 'get voice id';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.getVoice(input.voice_type || 'voice_cloning');
    return data;
  }
}

export class MinimaxCloneVoice extends BaseTool {
  schema = z.object({
    filePath: z.string().describe('the path of the voice file'),
    voice_id: z.string().optional(),
    need_noise_reduction: z
      .boolean()
      .optional()
      .default(false)
      .describe('是否开启降噪'),
  });

  name: string = 'minimax_clone_voice';

  description: string = 'clone a voice';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.cloneVoice({
      filePath: input.filePath,
      voice_id: input.voice_id,
      need_noise_reduction: input.need_noise_reduction,
    });
    return data;
  }
}

export class MinimaxDeleteVoice extends BaseTool {
  schema = z.object({
    voice_id: z.string(),
    voice_type: z.enum(['voice_cloning', 'voice_generation']),
  });

  name: string = 'minimax_delete_voice';

  description: string = 'delete voice';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.deleteVoice(input);
    return data;
  }
}

export class MinimaxTextToVideo extends BaseTool {
  schema = z.object({
    prompt: z.string().max(2000),
    model: z.enum(['MiniMax-Hailuo-02', 'T2V-01-Director', 'T2V-01']),
    prompt_optimizer: z
      .boolean()
      .default(true)
      .describe(
        '模型会自动优化传入的prompt，以提升生成质量。如果需要更精确的控制，可以将此参数设置为False，模型将更加严格地遵循指令。此时建议提供更精细的prompt，以获得最佳效果',
      ),
  });

  name: string = 'minimax_text_to_video';

  description: string = 'generation video from text';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.textToVideo(input);
    const filePath = saveFile(data, `${uuidv4()}.mp4`, config);
    return `<file>${filePath}</file>`;
  }
}

export class MinimaxImageToVideo extends BaseTool {
  schema = z.object({
    prompt: z.string().max(2000),
    model: z.enum([
      'MiniMax-Hailuo-02',
      'I2V-01',
      'I2V-01-Director',
      'I2V-01-live',
    ]),
    first_frame_image: z.string().describe('image file path'),
    subject_reference: z
      .string()
      .optional()
      .describe('模型将依据此参数中上传的主体来生成视频, 角色头像，人物的图片'),
    prompt_optimizer: z
      .boolean()
      .default(true)
      .describe(
        '模型会自动优化传入的prompt，以提升生成质量。如果需要更精确的控制，可以将此参数设置为False，模型将更加严格地遵循指令。此时建议提供更精细的prompt，以获得最佳效果',
      ),
  });

  name: string = 'minimax_image_to_video';

  description: string = 'generation video from image';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.imageToVideo(input);
    const filePath = saveFile(data, `${uuidv4()}.mp4`, config);
    return `<file>${filePath}</file>`;
  }
}

export class MinimaxDownloadFile extends BaseTool {
  schema = z.object({
    file_id: z.string(),
  });

  name: string = 'minimax_download_file';

  description: string = 'download file';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.downloadFile(input.file_id);
    const filePath = saveFile(data, `${uuidv4()}.mp4`, config);
    return `<file>${filePath}</file>`;
  }
}

export class MinimaxImageGeneration extends BaseTool {
  schema = z.object({
    model: z.enum(['image-01', 'image-01-live']),
    prompt: z.string().max(1500),
    aspect_ratio: z
      .enum(['1:1', '16:9', '4:3', '3:2', '2:3', '3:4', '9:16', '21:9'])
      .default('1:1')
      .optional(),
    n: z.number().default(1).optional(),
    prompt_optimizer: z.boolean().optional().default(true),
  });

  name: string = 'minimax_image_generation';

  description: string = 'image generation';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.imageGeneration(input);

    const filePaths = [];
    for (const image_url of data) {
      const filePath = await saveFile(image_url, `${uuidv4()}.jpeg`, config);
      filePaths.push(filePath);
    }

    return filePaths.map((x) => `<file>${x}</file>`).join('\n');
  }
}
export class MinimaxListFile extends BaseTool {
  schema = z.object({});

  name: string = 'minimax_list_file';

  description: string = 'list file';

  params: MinimaxToolkitParameters;

  constructor(params?: MinimaxToolkitParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as MinimaxProvider;
    if (!provider) {
      throw new Error(`provider ${config.providerId} not found`);
    }
    const data = await provider.listFile();
    return JSON.stringify(data);
  }
}

export class MinimaxToolkit extends BaseToolKit<MinimaxToolkitParameters> {
  name: string = 'minimax';

  description: string = 'minimax toolkit';

  configSchema: FormSchema[] = [
    {
      field: 'providerId',
      component: 'ProviderSelect',
      componentProps: {
        selectMode: 'providers',
        providerType: ProviderType.MINIMAX,
      },
    },
  ];

  constructor(params: MinimaxToolkitParameters) {
    super(params);
  }

  getTools() {
    return [
      new MinimaxTextToSpeech(this.params),
      new MinimaxGetVoice(this.params),
      new MinimaxCloneVoice(this.params),
      new MinimaxDeleteVoice(this.params),
      new MinimaxTextToVideo(this.params),
      new MinimaxImageToVideo(this.params),
      new MinimaxDownloadFile(this.params),
      new MinimaxListFile(this.params),
      new MinimaxImageGeneration(this.params),
    ];
  }
}
