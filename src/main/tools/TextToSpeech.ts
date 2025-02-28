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

// import sherpa_onnx from 'sherpa-onnx-node';
import Speaker from 'speaker';
import { getModelsPath, getTmpPath } from '../utils/path';
import { Worker } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';

export interface TextToSpeechParameters extends ToolParams {
  model: string;
}

export class TextToSpeech extends StructuredTool {
  schema = z.object({
    text: z.string().describe('input Text'),
    sid: z.number().default(0).optional().describe('speaker id'),
  });

  static lc_name() {
    return 'TextToSpeech';
  }

  name: string;

  description: string;

  model: string;

  worker: Worker;

  // sherpa_onnx: any;

  constructor(params?: TextToSpeechParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'text_to_speech',
    });

    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'text to speech',
    });
    Object.defineProperty(this, 'model', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'matcha-icefall-zh-baker@local',
    });
    this.model = params?.model;
    // Function('return import("sherpa-onnx-node")')()
    //   .then((mod: any) => {
    //     this.sherpa_onnx = mod.default;
    //     return null;
    //   })
    //   .catch((err) => {
    //     throw err;
    //   });
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
    const tts_config = this.getConfig(this.model);
    const tts = await this.createTts(tts_config);
    const audio = tts.generate({
      text: input.text,
      sid: 0,
      speed: 1.0,
      enableExternalBuffer: false,
    });
    if (audio.sampleRate) {
      await tts.play(audio);
      return 'success';
    } else {
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
    } else if (modelName == 'kokoro-multi-lang-v1_0') {
      config = {
        model: {
          kokoro: {
            model: path.join(getModelsPath(), 'tts', modelName, `model.onnx`),
            voices: path.join(getModelsPath(), 'tts', modelName, `voices.bin`),

            tokens: path.join(getModelsPath(), 'tts', modelName, `tokens.txt`),
            dataDir: path.join(
              getModelsPath(),
              'tts',
              modelName,
              `espeak-ng-data`,
            ),
            dictDir: path.join(getModelsPath(), 'tts', modelName, `dict`),
            lexicon: `${path.join(getModelsPath(), 'tts', modelName, 'lexicon-us-en.txt')},${path.join(getModelsPath(), 'tts', modelName, 'lexicon-zh.txt')}`,
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
      const speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: audio.sampleRate,
      });
      const audioBuffer = fs.readFileSync(filename);
      speaker.on('close', async (e) => {
        if (speaker.closed) {
          await fs.promises.unlink(filename);
        }
      });
      speaker.write(audioBuffer);
      speaker.end(() => {});
    } catch (error) {
      console.error(error);
    }
  };

  async createOfflineTts() {
    const sherpa_onnx = Function('return import("sherpa-onnx-node")')();

    const sherpa_onnxapi = await sherpa_onnx;
    const sxxx = sherpa_onnxapi.default;
    const model = 'vits-icefall-zh-aishell3';
    const phoneFst = path.join(getModelsPath(), 'tts', `${model}/phone.fst`);
    const dateFst = path.join(getModelsPath(), 'tts', `${model}/date.fst`);
    const numberFst = path.join(getModelsPath(), 'tts', `${model}/number.fst`);
    const new_heteronymFst = path.join(
      getModelsPath(),
      'tts',
      `${model}/new_heteronym.fst`,
    );
    const config = {
      model: {
        vits: {
          model: path.join(getModelsPath(), 'tts', `${model}/model.onnx`),
          tokens: path.join(getModelsPath(), 'tts', `${model}/tokens.txt`),
          lexicon: path.join(getModelsPath(), 'tts', `${model}/lexicon.txt`),
        },
        debug: true,
        numThreads: 1,
        provider: 'cpu',
      },
      maxNumStences: 1,
      ruleFsts: `${phoneFst},${dateFst},${numberFst},${new_heteronymFst}`,
      ruleFars: path.join(getModelsPath(), 'tts', `${model}/rule.far`),
    };
    return new sxxx.OfflineTts(config);
  }
}
