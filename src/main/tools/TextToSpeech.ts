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
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { appManager } from '../app/AppManager';
import providersManager from '../providers';
import { getProviderModel } from '../utils/providerUtil';
import { saveFile } from '../utils/common';

export interface TextToSpeechParameters extends ToolParams {
  model: string;
}

export class TextToSpeech extends BaseTool {
  schema = z.object({
    text: z.string().describe('input Text'),
    sid: z.number().default(0).optional().describe('speaker id'),
    speed: z.number().default(1.0).optional().describe('speed'),
  });

  configSchema: FormSchema[] = [
    {
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'tts',
      },
    },
  ];

  name: string = 'text_to_speech';

  description: string = 'text to speech';

  model: string = 'matcha-icefall-zh-baker@local';

  constructor(params?: TextToSpeechParameters) {
    super(params);

    this.model = params?.model;
  }

  public async sherpa_onnx(): Promise<any> {
    return new Promise((resolve, reject) => {
      Function('return import("sherpa-onnx-node")')()
        .then((mod: any) => {
          resolve(mod.default);
          return mod.default;
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    if (!isString(input.text)) {
      resolve('input value is not string');
    }
    if (this.model.split('@')[1] == 'local') {
      const tts_config = this.getConfig(this.model.split('@')[0]);
      const tts = await this.createTts(tts_config);
      const audio = tts.generate({
        text: input.text,
        sid: input.sid ?? 0,
        speed: input.speed ?? 1.0,
        enableExternalBuffer: false,
      });
      if (audio.sampleRate) {
        await this.play(audio);
        return 'success';
      } else {
        return 'tts failed';
      }
    } else {
      const { modelName, provider: providerName } = getProviderModel(
        this.model,
      );
      const provider = await providersManager.getProvider(providerName);
      if (!provider) {
        throw new Error(`provider ${this.model} not found`);
      }
      if ('speech' in provider) {
        const buffer = await provider.speech(modelName, input.text);
        if (buffer) {
          const savePath = await saveFile(buffer, `${uuidv4()}.wav`, config);
          appManager.sendEvent('play-audio', {
            filename: `file://${savePath}`,
          });
          return `<file>${savePath}</file>`;
        }
      }
      return 'tts failed';
    }
  }

  public getConfig(modelName: string) {
    let config;
    if (modelName == 'vits-melo-tts-zh_en') {
      const phoneFst = path.join(
        getModelsPath(),
        'tts',
        modelName,
        `phone.fst`,
      );
      const dateFst = path.join(getModelsPath(), 'tts', modelName, `date.fst`);
      const numberFst = path.join(
        getModelsPath(),
        'tts',
        modelName,
        `number.fst`,
      );
      const new_heteronymFst = path.join(
        getModelsPath(),
        'tts',
        modelName,
        `new_heteronym.fst`,
      );
      config = {
        model: {
          vits: {
            model: path.join(getModelsPath(), 'tts', modelName, `model.onnx`),
            tokens: path.join(getModelsPath(), 'tts', modelName, `tokens.txt`),
            lexicon: path.join(
              getModelsPath(),
              'tts',
              modelName,
              `lexicon.txt`,
            ),
            dictDir: path.join(getModelsPath(), 'tts', modelName, `dict`),
          },
          debug: true,
          numThreads: 4,
          provider: 'cpu',
        },
        maxNumStences: 1,
        ruleFsts: `${phoneFst},${dateFst},${numberFst},${new_heteronymFst}`,
        //ruleFars: path.join(getModelsPath(), 'tts', `${model}/rule.far`),
      };
    } else if (modelName == 'matcha-icefall-zh-baker') {
      config = {
        model: {
          matcha: {
            acousticModel: path.join(
              getModelsPath(),
              'tts',
              `${modelName}/model-steps-3.onnx`,
            ),
            vocoder: path.join(getModelsPath(), 'tts', `hifigan_v3.onnx`),
            lexicon: path.join(
              getModelsPath(),
              'tts',
              modelName,
              `lexicon.txt`,
            ),
            tokens: path.join(getModelsPath(), 'tts', modelName, `tokens.txt`),
            dictDir: path.join(getModelsPath(), 'tts', modelName, `dict`),
          },
          debug: true,
          numThreads: 4,
          provider: 'cpu',
        },
        maxNumSentences: 1,
        ruleFsts: `${path.join(getModelsPath(), 'tts', modelName, 'phone.fst')},${path.join(getModelsPath(), 'tts', modelName, 'date.fst')},${path.join(getModelsPath(), 'tts', modelName, 'number.fst')}`,
      };
    } else if (
      modelName == 'kokoro-multi-lang-v1_0' ||
      modelName == 'kokoro-multi-lang-v1_1' ||
      modelName == 'kokoro-int8-multi-lang-v1_1'
    ) {
      const onnx = modelName.includes('int8')
        ? `model.int8.onnx`
        : `model.onnx`;
      config = {
        model: {
          kokoro: {
            model: path.join(getModelsPath(), 'tts', modelName, onnx),
            voices: path.join(getModelsPath(), 'tts', modelName, `voices.bin`),

            tokens: path.join(getModelsPath(), 'tts', modelName, `tokens.txt`),
            dataDir: path.join(
              getModelsPath(),
              'tts',
              modelName,
              `espeak-ng-data`,
            ),
            dictDir: path.join(getModelsPath(), 'tts', modelName, `dict`),
            lexicon: `${path.join(getModelsPath(), 'tts', modelName, 'lexicon-gb-en.txt')},${path.join(getModelsPath(), 'tts', modelName, 'lexicon-us-en.txt')},${path.join(getModelsPath(), 'tts', modelName, 'lexicon-zh.txt')}`,
          },
          debug: true,
          numThreads: 4,
          provider: 'cpu',
        },
        maxNumSentences: 1,
        ruleFsts: `${path.join(getModelsPath(), 'tts', modelName, 'phone-zh.fst')},${path.join(getModelsPath(), 'tts', modelName, 'date-zh.fst')},${path.join(getModelsPath(), 'tts', modelName, 'number-zh.fst')}`,
        // ruleFsts: `${path.join(getModelsPath(), 'tts', modelName, 'phone.fst')},${path.join(getModelsPath(), 'tts', modelName, 'date.fst')},${path.join(getModelsPath(), 'tts', modelName, 'number.fst')}`,
      };
    } else {
      return null;
    }
    return config;
  }

  public createTts = async (config) => {
    return new (await this.sherpa_onnx()).OfflineTts(config);
  };

  public play = async (audio: { samples: number[]; sampleRate: number }) => {
    const filename = path.join(getTmpPath(), `${uuidv4()}.wav`);

    const sherpa = await this.sherpa_onnx();

    try {
      sherpa.writeWave(filename, {
        samples: audio.samples,
        sampleRate: audio.sampleRate,
      });
      appManager.sendEvent('play-audio', {
        filename: filename,
      });
      // const speaker = new Speaker({
      //   channels: 1,
      //   bitDepth: 16,
      //   sampleRate: audio.sampleRate,
      // });
      // const audioBuffer = fs.readFileSync(filename);
      // speaker.on('close', async (e) => {
      //   if (speaker.closed) {
      //     await fs.promises.unlink(filename);
      //   }
      // });
      // speaker.write(audioBuffer);
      // speaker.end(() => {});
    } catch (error) {
      console.error(error);
    }
  };
}
