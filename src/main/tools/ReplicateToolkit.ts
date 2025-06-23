import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import Replicate from 'replicate';
import { BaseTool, BaseToolKit, ToolTag } from './BaseTool';
import { z } from 'zod';
import { FormSchema } from '@/types/form';
import fs from 'fs';
import path from 'path';
import { imageToBase64, saveFile } from '../utils/common';
import { v4 as uuidv4 } from 'uuid';
import { isArray, isUrl } from '../utils/is';
import { Images } from 'zhipuai-sdk-nodejs-v4';
import { ProviderType } from '@/entity/Providers';
import providersManager from '../providers';
import { ReplicateProvider } from '../providers/ReplicateProvider';

export interface ReplicateParameters extends ToolParams {
  providerId: string;
}
const REPLICATE_API_URL = 'https://api.replicate.com/v1';
const REPLICATE_OFFICIAL_LINK = 'https://replicate.com/account/keys';

export class ReplicateImageEditing extends BaseTool {
  toolKitName: string = 'replicate';

  officialLink: string = REPLICATE_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.IMAGE];

  schema = z.object({
    prompt: z.string(),
    input_image: z.string().describe('image file path or url'),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_image_editing';

  description: string = 'edit the image from the prompt';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;

    const body: any = input;

    if (isUrl(body.input_image)) {
      console.log('input_image', body.input_image);
    } else if (fs.existsSync(body.input_image)) {
      const fileInput = await fs.promises.readFile(body.input_image);
      body.input_image = fileInput;
    } else {
      throw new Error('Invalid image file path or url');
    }
    const model = 'flux-kontext-pro';

    const output = await provider.replicate.run(
      'black-forest-labs/flux-kontext-pro',
      {
        input: body,
      },
    );
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicateImageGeneration extends BaseTool {
  toolKitName: string = 'replicate';

  officialLink: string = REPLICATE_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.IMAGE];

  schema = z.object({
    prompt: z.string(),
    model: z
      .enum([
        'black-forest-labs/flux-kontext-pro',
        'black-forest-labs/flux-kontext-max',
        'minimax/image-01',
        'google/imagen-4',
      ])
      .optional(),
    subject_reference: z.string().describe('image file path or url').optional(),
    aspect_ratio: z
      .enum(['1:1', '16:9', '9:16', '4:3', '3:4'])
      .default('1:1')
      .optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_image_generation';

  description: string = 'generate the image from the prompt';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;

    const body: any = input;

    if (body.subject_reference) {
      if (isUrl(body.subject_reference)) {
        console.log('subject_reference', body.subject_reference);
      } else if (fs.existsSync(body.subject_reference)) {
        const fileInput = await fs.promises.readFile(body.subject_reference);
        body.subject_reference = fileInput;
      }
      if (body.model.startsWith('black-forest-labs/')) {
        body.input_image = body.subject_reference;
        delete body.subject_reference;
      }
    }

    const output = await provider.replicate.run(
      body.model || 'black-forest-labs/flux-kontext-pro',
      {
        input: body,
      },
    );
    let result = null;
    if (isArray(output)) {
      result = output[0];
    } else {
      result = output;
    }
    console.log('output', result);
    const url = result.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicateTextToVideo extends BaseTool {
  toolKitName: string = 'replicate';

  officialLink: string = REPLICATE_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.VIDEO];

  schema = z.object({
    prompt: z.string(),
    model: z.enum([
      'google/veo-2',
      'minimax/video-01',
      'minimax/video-01-live',
      'kwaivgi/kling-v2.1',
      'kwaivgi/kling-v2.0',
      'kwaivgi/kling-v1.6-standard',
      'kwaivgi/kling-v1.6-pro',
      'tencent/hunyuan-video',
      'leonardoai/motion-2.0',
      'wavespeedai/wan-2.1-t2v-480p',
      'wavespeedai/wan-2.1-t2v-720p',
      'wavespeedai/wan-2.1-i2v-480p',
      'wavespeedai/wan-2.1-i2v-720p',
      'pixverse/pixverse-v4.5',
    ]),
    input_image: z.string().describe('image file path or url').optional(),
    aspect_ratio: z.enum(['16:9', '9:16']).default('16:9').optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_video_generate';

  description: string = 'generate the video from the prompt';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;

    const body: any = input;
    if (body.input_image) {
      if (isUrl(body.input_image)) {
      } else if (fs.existsSync(body.input_image)) {
        const fileInput = await fs.promises.readFile(body.input_image);
        body.input_image = fileInput;
      }
      if (body.model.startsWith('google/')) {
        body.image = body.input_image;
        delete body.input_image;
      } else if (body.model.startsWith('minimax/')) {
        body.first_frame_image = body.input_image;
        delete body.input_image;
        body.prompt_optimizer = true;
      } else if (body.model.startsWith('kwaivgi/kling')) {
        body.start_image = body.input_image;
        delete body.input_image;
      } else if (body.model.startsWith('tencent/')) {
        delete body.input_image;
      } else if (body.model.startsWith('leonardoai/')) {
        body.image = body.input_image;
        delete body.input_image;
      } else if (body.model.startsWith('wavespeedai/')) {
        body.image = body.input_image;
        delete body.input_image;
      } else if (body.model.startsWith('pixverse/')) {
        body.image = body.input_image;
        delete body.input_image;
      }
    }

    const output = await provider.replicate.run(body.model || 'google/veo-2', {
      input: body,
    });
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicateMusicGeneration extends BaseTool {
  toolKitName: string = 'replicate';

  officialLink: string = REPLICATE_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.MUSIC];

  schema = z.object({
    lyrics: z
      .string()
      .describe(
        'Lyrics with optional formatting. You can use a newline to separate each line of lyrics. You can use two newlines to add a pause between lines. You can use double hash marks (##) at the beginning and end of the lyrics to add accompaniment. Maximum 350 to 400 characters.',
      ),
    song_file: z
      .string()
      .describe(
        'Reference song, should contain music and vocals. Must be a .wav or .mp3 file longer than 15 seconds.',
      ),
    voice_file: z
      .string()
      .optional()
      .describe(
        'Voice reference. Must be a .wav or .mp3 file longer than 15 seconds. If only a voice reference is given, an a cappella vocal hum will be generated.',
      ),
    instrumental_file: z
      .string()
      .optional()
      .describe(
        'Instrumental reference. Must be a .wav or .mp3 file longer than 15 seconds. If only an instrumental reference is given, a track without vocals will be generated.',
      ),
    voice_id: z.string().optional(),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_music_generation';

  description: string = 'generate the music from the lyrics';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;
    const body: any = input;

    const data = {
      lyrics: input.lyrics,
      song_file: input.song_file,
      voice_file: input.voice_file,
      instrumental_file: input.instrumental_file,
      voice_id: input.voice_id,
    };

    const output = await provider.replicate.run('minimax/music-01', {
      input: data,
    });
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicatetSpeechGeneration extends BaseTool {
  toolKitName: string = 'replicate';

  officialLink: string = REPLICATE_OFFICIAL_LINK;

  tags?: string[] = [ToolTag.AUDIO];

  schema = z.object({
    text: z
      .string()
      .describe(
        'Text to convert to speech. Every character is 1 token. Maximum 5000 characters. Use <#x#> between words to control pause duration (0.01-99.99s).',
      ),
    voice_id: z.string().optional(),
    emotion: z
      .enum([
        'auto',
        'neutral',
        'sad',
        'happy',
        'angry',
        'fearful',
        'disgusted',
        'surprised',
      ])
      .optional(),
    model: z
      .enum(['minimax/speech-02-hd', 'minimax/speech-02-turbo'])
      .default('minimax/speech-02-turbo'),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_speech_generation';

  description: string = 'generate the speech from the text';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;
    const body: any = {
      ...input,
      pitch: 0,
      speed: 1,
      volume: 1,
      bitrate: 128000,
      channel: 'mono',
      sample_rate: 32000,
      // language_boost: 'English',
      english_normalization: true,
    };
    if (!input.voice_id) {
      delete body.voice_id;
    }

    const output = await provider.replicate.run(
      body.model || 'minimax/speech-02-turbo',
      {
        input: body,
      },
    );
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class Replicate3DGeneration extends BaseTool {
  toolKitName: string = 'replicate';

  schema = z.object({
    images: z.array(z.string()).describe(''),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_3d_generation';

  description: string = 'generate the 3d model from the images';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;
    const body: any = input;

    const data = {
      images: input.images,
    };

    const output = await provider.replicate.run('firtoz/trellis', {
      input: data,
    });
    console.log(output);
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicateLipSync extends BaseTool {
  toolKitName: string = 'replicate';

  schema = z.object({
    images: z.array(z.string()).describe(''),
  });

  configSchema?: FormSchema[] = [
    {
      field: 'apiKey',
      component: 'InputPassword',
      label: 'API Key',
      required: true,
    },
  ];

  name: string = 'replicate_lipsync';

  description: string = 'Add lip-sync to any video with an audio file or text';

  apiKey?: string;

  params: ReplicateParameters;

  constructor(params?: ReplicateParameters) {
    super();
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const provider = (await providersManager.getProvider(
      this.params?.providerId,
    )) as ReplicateProvider;
    const body: any = input;

    const data = {
      images: input.images,
    };

    const output = await provider.replicate.run('firtoz/trellis', {
      input: data,
    });
    console.log(output);
    const url = output.url();
    const text = url.toString();
    const ext = path.extname(text);
    const filePath = await saveFile(text, uuidv4() + ext, parentConfig);
    return `<file>${filePath}</file>`;
  }
}

export class ReplicateToolkit extends BaseToolKit {
  name: string = 'replicate_toolkit';

  configSchema: FormSchema[] = [
    {
      field: 'providerId',
      component: 'ProviderSelect',
      componentProps: {
        selectMode: 'providers',
        providerType: ProviderType.REPLICATE,
      },
      required: true,
    },
  ];

  constructor(params?: ReplicateParameters) {
    super(params);
    //this.apiKey = params?.apiKey;
  }

  getTools(): BaseTool[] {
    return [
      new ReplicateImageEditing(this.params),
      new ReplicateImageGeneration(this.params),
      new ReplicateTextToVideo(this.params),
      new ReplicateMusicGeneration(this.params),
      new ReplicatetSpeechGeneration(this.params),
    ];
  }
}
