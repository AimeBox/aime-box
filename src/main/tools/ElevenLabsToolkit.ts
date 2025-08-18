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

export class ElevenLabsGetVoiceList extends BaseTool {
  schema = z.object({});

  name: string = 'elevenlabs_get_voice_list';

  description: string = 'Get list of voices from ElevenLabs';

  toolKitName: string = 'elevenlabs';

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
    const voices = await provider.getVoiceList();
    return JSON.stringify(
      voices.map((voice) => ({
        id: voice.voiceId,
        name: voice.name,
        description: voice.description,
      })),
    );
  }
}

export class ElevenLabsSoundEffect extends BaseTool {
  schema = z.object({
    text: z
      .string()
      .describe(
        'a description of the sound effect you want (e.g., “person walking on grass”).',
      ),
    savePath: z
      .string()
      .optional()
      .describe(
        'Optional: Save the generated audio file to a local path (e.g., /path_to_save/sound.mp3) must use absolute path and must end with .mp3, if not provided, the file will be saved to the temp directory',
      ),
    durationSeconds: z
      .number()
      .min(0.5)
      .max(22)
      .optional()
      .describe(
        'Optional: Set a specific length for the generated audio (in seconds), default is automatically determined based on the prompt',
      ),
    promptInfluence: z.number().min(0).max(1).default(0.3).optional()
      .describe(`Control how strictly the model follows the prompt
High: More literal interpretation of the prompt
Low: More creative interpretation with added variations`),
  });

  name: string = 'elevenlabs_sound_effect';

  toolKitName: string = 'elevenlabs';

  description: string =
    'Generate sound effect file (e.g., “90s hip-hop drum loop, 90 BPM”, “Sword being drawn, then clashing with another blade”).';

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
    const filePath = await saveFile(
      soundEffect,
      input.savePath || `${uuidv4()}.mp3`,
      config,
    );
    return `generated sound effect file saved to: \n<file>${filePath}</file>`;
  }
}

export class ElevenLabsTranscription extends BaseTool {
  schema = z.object({
    // modelName: z.string(),
    filePath: z.string(),
    diarize: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Optional: Enable diarization to separate speakers in the audio, default is false',
      ),
  });

  name: string = 'elevenlabs_transcription';

  description: string =
    'Transcription using ElevenLabs, support (*.mp3, *.wav)';

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
    const transcription = await provider.transcriptions(
      'scribe_v1',
      input.filePath,
      {
        diarize: input.diarize,
      },
    );
    return transcription;
  }
}

export class ElevenLabsVoiceCloning extends BaseTool {
  schema = z.object({
    filePath: z.string(),
    name: z.string(),
    description: z.string().optional(),
    labels: z.string().optional(),
    removeBackgroundNoise: z.boolean().optional().default(false),
  });

  toolKitName: string = 'elevenlabs';

  name: string = 'elevenlabs_voice_cloning';

  description: string =
    'Voice cloning using ElevenLabs, support (*.mp3, *.wav), return the voice info with voiceId';

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

    const response = await provider.voiceCloning({
      name: input.name,
      files: [input.filePath],
      description: input.description,
      labels: input.labels,
      removeBackgroundNoise: input.removeBackgroundNoise,
    });

    return JSON.stringify(response);
  }
}

export class ElevenLabsTextToSpeech extends BaseTool {
  schema = z.object({
    text: z.string(),
    voiceId: z
      .string()
      .describe(
        'The voice id to use for the text to speech, you can get the voice id from the `elevenlabs_get_voice_list` tool',
      ),
    savePath: z
      .string()
      .optional()
      .describe(
        'Optional: Save the generated audio file to a local path (e.g., /path_to_save/sound.mp3) must use absolute path and must end with .mp3, if not provided, the file will be saved to the temp directory',
      ),
  });

  name: string = 'elevenlabs_text_to_speech';

  description: string =
    'Text to speech using ElevenLabs, support (*.mp3, *.wav)';

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
    const textToSpeech = await provider.speech('eleven_v3', input.text, {
      voiceDescription: input.voiceId,
    });
    const filePath = await saveFile(
      textToSpeech,
      input.savePath || `${uuidv4()}.mp3`,
      config,
    );
    return `generated text to speech file saved to: \n<file>${filePath}</file>`;
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
    return [
      new ElevenLabsSoundEffect(this.params),
      new ElevenLabsTranscription(this.params),
      new ElevenLabsGetVoiceList(this.params),
      new ElevenLabsVoiceCloning(this.params),
    ];
  }
}
