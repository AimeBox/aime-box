import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from './BaseTool';
import { t } from 'i18next';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { ProviderType } from '@/entity/Providers';
import { z } from 'zod';
import { ElevenLabsProvider } from '../providers/ElevenLabsProvider';
import providersManager from '../providers';
import { saveFile } from '../utils/common';
import { v4 as uuidv4 } from 'uuid';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';

export interface ElevenLabsParameters extends ToolParams {
  providerId?: string;
}

export class ElevenLabsSoundEffect extends BaseTool {
  schema = z.object({
    text: z.string(),
    durationSeconds: z.number().min(0.5).max(22).optional(),
    promptInfluence: z.number().min(0).max(1).default(0.3).optional(),
  });

  name: string = 'elevenlabs_sound_effect';

  description: string = 'Generate sound effect using ElevenLabs';

  params: ElevenLabsParameters;

  constructor(params: ElevenLabsParameters) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<string> {
    const provider = (await providersManager.getProvider(
      this.params.providerId,
    )) as ElevenLabsProvider;
    const soundEffect = await provider.soundEffects({
      ...input,
      outputFormat: 'mp3_44100_128',
    });
    const filePath = await saveFile(soundEffect, `${uuidv4()}.mp3`, config);
    return `<file>${filePath}</file>`;
  }
}

export class ElevenLabsToolkit extends BaseToolKit {
  name: string = 'elevenlabs_toolkit';

  configSchema?: FormSchema[] = [
    {
      label: t('tools.providerId'),
      field: 'providerId',
      component: 'ProviderSelect',
      componentProps: {
        selectMode: 'providers',
        providerType: ProviderType.ELEVENLABS,
      },
      required: true,
    },
  ];

  constructor(params: ElevenLabsParameters) {
    super(params);
  }

  getTools(): BaseTool[] {
    return [new ElevenLabsSoundEffect(this.params)];
  }
}
