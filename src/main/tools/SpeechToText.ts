import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import fs from 'fs';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { getModelsPath } from '../utils/path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { isUrl } from '../utils/is';
import { saveFile } from '../utils/common';
import providersManager from '../providers';
import { getProviderModel } from '../utils/providerUtil';
import axios from 'axios';

export interface SpeechToTextParameters extends ToolParams {
  ffmpegPath: string;
  model: string;
  apiKey: string;
}

export class SpeechToText extends BaseTool {
  schema = z.object({
    fileOrUrl: z.string().describe('The file of the audio file'),
    language: z
      .enum(['auto', 'zh', 'en', 'yue', 'ja', 'ko'])
      .optional()
      .default('auto')
      .describe('language'),
    speakerDiarization: z
      .boolean()
      .optional()
      .default(false)
      .describe('Speaker Diarization'),
  });

  name: string = 'speech_to_text';

  description: string =
    'convert audio or video file to text, support wav, mp3, mp4';

  ffmpegPath: string;

  model: string;

  sherpa_onnx: any;

  apiKey: string;

  configSchema: FormSchema[] = [
    {
      field: 'model',
      component: 'ProviderSelect',
      componentProps: {
        type: 'stt',
      },
    },
    {
      label: 'FFmpeg Path',
      field: 'ffmpegPath',
      component: 'Input',
    },
  ];

  constructor(params?: SpeechToTextParameters) {
    super(params);

    this.ffmpegPath = params?.ffmpegPath;
    if (!this.ffmpegPath || !fs.existsSync(this.ffmpegPath)) {
      if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        this.ffmpegPath = path.join(process.env.FFMPEG_PATH);
      }
    }
    this.model = params?.model;

    this.apiKey = params?.apiKey;
    const platform = os.platform();
    const arch = os.arch();

    Function(`return import("sherpa-onnx-node")`)()
      .then((mod: any) => {
        this.sherpa_onnx = mod.default;
        return null;
      })
      .catch((err) => {
        throw err;
      });
  }

  createRecognizer(language) {
    // Please download test files from
    // https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models
    let config = null;
    if (
      this.model == 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17@local'
    ) {
      config = {
        featConfig: {
          sampleRate: 16000,
          featureDim: 80,
        },

        modelConfig: {
          senseVoice: {
            model: path.join(
              getModelsPath(),
              'stt',
              'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17',
              'model.int8.onnx',
            ),
            language: language, //"auto" 'en' "yue" "ja" "ko"
            useInverseTextNormalization: 1,
          },
          tokens: path.join(
            getModelsPath(),
            'stt',
            'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17',
            'tokens.txt',
          ),
          numThreads: 2,
          provider: 'cpu',
          debug: 1,
        },
      };
    } else if (this.model == 'sherpa-onnx-whisper-large-v3@local') {
      config = {
        featConfig: {
          sampleRate: 16000,
          featureDim: 80,
        },
        modelConfig: {
          whisper: {
            returnTimestamps: 'word',
            //language: 'zh',
            encoder: path.join(
              getModelsPath(),
              'stt',
              'sherpa-onnx-whisper-large-v3',
              'large-v3-encoder.int8.onnx',
            ),
            decoder: path.join(
              getModelsPath(),
              'stt',
              'sherpa-onnx-whisper-large-v3',
              'large-v3-decoder.int8.onnx',
            ),
          },
          tokens: path.join(
            getModelsPath(),
            'stt',
            'sherpa-onnx-whisper-large-v3',
            'large-v3-tokens.txt',
          ),
          numThreads: 2,
          provider: 'cpu',
          debug: 1,
        },
      };
    } else if (this.model == 'sherpa-onnx-whisper-small@local') {
      config = {
        featConfig: {
          sampleRate: 16000,
          featureDim: 80,
        },
        modelConfig: {
          whisper: {
            //returnTimestamps: 'word',
            task: 'transcribe', // 'transcribe' 'translate'
            language: 'zh',
            encoder: path.join(
              getModelsPath(),
              'stt',
              'sherpa-onnx-whisper-small',
              'small-encoder.int8.onnx',
            ),
            decoder: path.join(
              getModelsPath(),
              'stt',
              'sherpa-onnx-whisper-small',
              'small-decoder.int8.onnx',
            ),
          },
          tokens: path.join(
            getModelsPath(),
            'stt',
            'sherpa-onnx-whisper-small',
            'small-tokens.txt',
          ),
          numThreads: 2,
          provider: 'cpu',
          debug: 1,
        },
      };
    }

    return new this.sherpa_onnx.OfflineRecognizer(config);
  }

  createVad(sampleRate = 16000) {
    // please download silero_vad.onnx from
    // https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
    const config = {
      sileroVad: {
        model: path.join(
          getModelsPath(),
          'vad',
          'silero_vad',
          'silero_vad.onnx',
        ),
        threshold: 0.5,
        minSpeechDuration: 0.25,
        minSilenceDuration: 0.5,
        maxSpeechDuration: 5,
        windowSize: 512,
      },
      sampleRate: sampleRate,
      debug: true,
      numThreads: 1,
    };

    const bufferSizeInSeconds = 60;

    return new this.sherpa_onnx.Vad(config, bufferSizeInSeconds);
  }

  createSpeakerDiarization() {
    const config = {
      segmentation: {
        pyannote: {
          model: path.join(
            getModelsPath(),
            'speaker_diarization',
            'sherpa-onnx-pyannote-segmentation-3-0',
            'model.onnx',
          ),
        },
      },
      embedding: {
        model: path.join(
          getModelsPath(),
          'speaker_diarization',
          '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k',
          '3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx',
        ),
      },
      clustering: {
        // since we know that the test wave file
        // ./0-four-speakers-zh.wav contains 4 speakers, we use 4 for numClusters
        // here. if you don't have such information, please set numClusters to -1
        numClusters: -1,

        // If numClusters is not -1, then threshold is ignored.
        //
        // A larger threshold leads to fewer clusters, i.e., fewer speakers
        // A smaller threshold leads to more clusters, i.e., more speakers
        // You need to tune it by yourself.
        threshold: 0.5,
      },

      // If a segment is shorter than minDurationOn, we discard it
      minDurationOn: 0.2, // in seconds

      // If the gap between two segments is less than minDurationOff, then we
      // merge these two segments into a single one
      minDurationOff: 0.5, // in seconds
    };
    const sd = new this.sherpa_onnx.OfflineSpeakerDiarization(config);
    return sd;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    let filePath = input.fileOrUrl;
    if (isUrl(input.fileOrUrl)) {
      filePath = await this.downloadFile(input.fileOrUrl, config);
    }

    const ext = path.extname(filePath);
    let wave;
    let outpath = filePath;
    if (ext.toLowerCase() != '.wav') {
      outpath = path.join(os.tmpdir(), `${uuidv4()}.wav`);
      await this.convertTo16kHzWav(filePath, outpath);
    }

    if (!this.model.includes('@local')) {
      const { modelName, provider: providerName } = getProviderModel(
        this.model,
      );
      const provider = await providersManager.getProvider(providerName);
      if (!provider) {
        throw new Error(`provider ${this.model} not found`);
      }
      const text = await provider.transcriptions(modelName, outpath);
      if (!text) throw new Error(`file "${outpath}" transcriptions failed`);
      return text;
    }
    if (ext.toLowerCase() == '.wav') {
      wave = this.sherpa_onnx.readWave(filePath, false);
      if (wave.sampleRate != 16000) {
        outpath = path.join(os.tmpdir(), `${uuidv4()}.wav`);
        await this.convertTo16kHzWav(filePath, outpath);
      }
    }

    wave = this.sherpa_onnx.readWave(outpath, false);

    const recognizer = this.createRecognizer(input.language);
    const vad = this.createVad(wave.sampleRate);
    let sd = null;
    if (input.speakerDiarization) {
      sd = this.createSpeakerDiarization();
    }
    // please download ./Obama.wav from
    // https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models
    //const waveFilename = './Obama.wav';

    const windowSize = vad.config.sileroVad.windowSize;
    let start = Date.now();
    const list = [];
    for (let i = 0; i < wave.samples.length; i += windowSize) {
      const thisWindow = wave.samples.subarray(i, i + windowSize);
      vad.acceptWaveform(thisWindow);

      while (!vad.isEmpty()) {
        const segment = vad.front(false);
        vad.pop();

        let start_time = segment.start / wave.sampleRate;
        let end_time = start_time + segment.samples.length / wave.sampleRate;

        start_time = start_time.toFixed(2);
        end_time = end_time.toFixed(2);

        const stream = recognizer.createStream();
        stream.acceptWaveform({
          samples: segment.samples,
          sampleRate: wave.sampleRate,
        });

        recognizer.decode(stream);
        const r = recognizer.getResult(stream);
        if (r.text.length > 0) {
          const text = r.text.toLowerCase().trim();
          list.push(text);
          console.log(`${start_time} -- ${end_time}: ${text}`);
        }
      }
    }
    vad.flush();

    while (!vad.isEmpty()) {
      const segment = vad.front(false);
      vad.pop();

      let start_time = segment.start / wave.sampleRate;
      let end_time = start_time + segment.samples.length / wave.sampleRate;

      start_time = start_time.toFixed(2);
      end_time = end_time.toFixed(2);

      const stream = recognizer.createStream();
      stream.acceptWaveform({
        samples: segment.samples,
        sampleRate: wave.sampleRate,
      });

      recognizer.decode(stream);
      const r = recognizer.getResult(stream);
      if (r.text.length > 0) {
        const text = r.text.toLowerCase().trim();
        list.push(text);
        console.log(`${start_time} -- ${end_time}: ${text}`);
      }
    }
    if (sd && sd.sampleRate == wave.sampleRate) {
      const segments = sd.process(wave.samples);
      console.log(segments);
    }

    return list.join('\n') + `\n<file>${filePath}</file>`;
    // if (
    //   this.model == 'whisper-medium@local' ||
    //   this.model == 'whisper-large-v3@local'
    // ) {
    //   const audioChunks = await this.splitAudio(fileOrUrl);
    //   const list = [];
    //   const transformers = new Transformers({
    //     task: 'automatic-speech-recognition',
    //     modelName: 'whisper-medium',
    //   });
    //   const pipeline = await transformers.pipeline();
    //   for (let i = 0; i < audioChunks.length; i++) {
    //     const audioData = audioChunks[i];
    //     const output = await pipeline(audioData, {
    //       // chunk_length_s: 15,
    //       // stride_length_s: 3,
    //       return_timestamps: 'word', // true
    //       task: 'transcribe', //translate transcribe
    //       language: 'chinese',
    //     });
    //     list.push(output.text);
    //   }
    //   return list.join('\n');
    // } else if (this.model == 'OpenAI-Whisper') {
    //   const loader = new OpenAIWhisperAudio(fileOrUrl, {
    //     clientOptions: {
    //       apiKey: this.apiKey,
    //       httpAgent: settingsManager.getHttpAgent(),
    //     },
    //   });
    //   const docs = await loader.load();
    //   return docs.map((x) => x.pageContent).join('\n');
    // }
    // return '';
    // const buffer = fs.readFileSync(fileOrUrl);

    // const wav = new WaveFile();
    // wav.fromBuffer(buffer);
    // // wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
    // // wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    // let audioData = wav.getSamples();
    // const audioBuffer = Buffer.from(wav.getSamples(false, Int32Array));

    // const silenceThresh2 = this.calculateSilenceThresh(audioBuffer, -16);

    // if (Array.isArray(audioData)) {
    //   if (audioData.length > 1) {
    //     const SCALING_FACTOR = Math.sqrt(2);
    //     for (let i = 0; i < audioData[0].length; ++i) {
    //       audioData[0][i] =
    //         (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
    //     }
    //   }
    //   audioData = audioData[0];
    // }
    // console.log('end convert mp4 2 wav');

    // const options = {
    //   silence_thresh: -16, // 阈值dBFS
    //   min_silence_len: 60, // 最短静音时长，单位为毫秒
    //   keep_silence: true, // 是否保留静音部分
    // };

    // const { sampleRate } = wav.fmt as { sampleRate: any };
    // const dBFsArray = this.calculateDBFS(audioData);

    // const silenceThresh = this.calculateSilenceThresh(dBFsArray, -16);

    // options.silence_thresh = silenceThresh * -1;
    // const chunks = this.detectSilence(
    //   dBFsArray,
    //   options.silence_thresh,
    //   options.min_silence_len,
    //   sampleRate,
    // );

    // const float32Array = new Float32Array(
    //   audioData.buffer,
    //   audioData.byteOffset,
    //   audioData.length,
    // );

    // const audioChunks = this.splitAudioOnSilence(
    //   float32Array,
    //   chunks,
    //   options.keep_silence,
    // );
    // for (let i = 0; i < audioChunks.length; i++) {
    //   console.log(`${(audioChunks[i].length / sampleRate).toFixed(2)}s`);
    // }

    // return '阿';
    // const transformers = new Transformers({
    //   task: 'automatic-speech-recognition',
    //   modelName: 'whisper-medium',
    // });
    // const pipeline = await transformers.pipeline();
    // const list = [];
    // for (let i = 0; i < audioChunks.length; i++) {
    //   const audioChunk = audioChunks[i];
    //   const output = await pipeline(audioChunk, {
    //     // chunk_length_s: 15,
    //     // stride_length_s: 3,
    //     return_timestamps: 'word', // true
    //     task: 'transcribe', //translate transcribe
    //     language: 'chinese',
    //   });
    //   list.push(output.text);
    // }

    // return list.join('\r\n');
  }

  convertTo16kHzWav(inputFilePath, outputFilePath): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg.setFfmpegPath(this.ffmpegPath);
      ffmpeg(inputFilePath)
        .audioFrequency(16000) // 设置采样率为 16kHz
        .audioChannels(1) // 设置为单声道（可选）
        .format('wav') // 设置输出格式为 WAV
        .on('end', () => {
          console.log('转换完成');
          resolve();
        })
        .on('error', (err) => {
          console.error('转换出错:', err);
          reject(err);
        })
        .save(outputFilePath); // 保存输出文件
    });
  }

  async downloadFile(url: string, config): Promise<string> {
    const ext = path.extname(url);
    const saveFilePath = await saveFile(url, uuidv4() + ext, config);
    return saveFilePath;
  }

  // convertTo16kHzWav(mp4FilePath, outpath): Promise<Buffer> {
  //   return new Promise((resolve, reject) => {
  //     const passThrough = new PassThrough();
  //     const chunks = [];

  //     passThrough.on('data', (chunk) => {
  //       chunks.push(chunk);
  //     });

  //     passThrough.on('end', () => {
  //       const buffer = Buffer.concat(chunks);
  //       resolve(buffer);
  //     });

  //     passThrough.on('error', (err) => {
  //       reject(err);
  //     });
  //     ffmpeg.setFfmpegPath(this.ffmpegPath);
  //     ffmpeg(mp4FilePath)
  //       .audioFrequency(16000)
  //       .toFormat('wav')
  //       .on('error', (err) => {
  //         reject(err);
  //       })
  //       .save(outpath);
  //     //.pipe(passThrough, { end: true });
  //   });
  // }

  // calculateDBFS = (samples: Float64Array): Float64Array => {
  //   const dBFsArray = new Float64Array(samples.length);
  //   for (let i = 0; i < samples.length; i++) {
  //     const sample = samples[i];
  //     const dBFS = 20 * Math.log10(Math.abs(sample));
  //     dBFsArray[i] = isFinite(dBFS) ? dBFS : 0;
  //   }

  //   return dBFsArray;
  // };

  // calculateSilenceThresh = (audioBuffer, dynamicRangeDb) => {
  //   // 使用某种算法对整个音频数据进行分析，
  //   // 可能计算中位数、均值、百分位数等，来估算阈值
  //   // 这里简单演示一下

  //   let maxAmplitude = 0;
  //   for (let i = 0; i < audioBuffer.length; i++) {
  //     if (Math.abs(audioBuffer[i]) > maxAmplitude) {
  //       maxAmplitude = Math.abs(audioBuffer[i]);
  //     }
  //   }

  //   // 假设 silence_thresh 为最大振幅减去一定的动态范围
  //   const silenceThresh = 20 * Math.log10(maxAmplitude) - dynamicRangeDb;
  //   return silenceThresh;
  // };

  // detectSilence = (
  //   dBFsArray: Float64Array,
  //   thresh: number,
  //   minSilenceLen: number,
  //   sampleRate: number,
  // ): number[] => {
  //   const silenceThreshold = thresh;
  //   const minSilenceFrames = (minSilenceLen / 1000) * sampleRate;

  //   let silenceStartIndex = -1;
  //   const chunks: number[] = [];
  //   let maxSilenceDuration = 0;
  //   for (let i = 0; i < dBFsArray.length; i++) {
  //     if (dBFsArray[i] < silenceThreshold) {
  //       if (silenceStartIndex === -1) {
  //         silenceStartIndex = i;
  //       }

  //       const silenceDuration = i - silenceStartIndex;
  //       if (maxSilenceDuration < silenceDuration) {
  //         maxSilenceDuration = silenceDuration;
  //       }
  //       if (silenceDuration >= minSilenceFrames) {
  //         console.log(
  //           `${(silenceStartIndex / sampleRate).toFixed(2)}s => ${(i / sampleRate).toFixed(2)}s`,
  //         );
  //         chunks.push(silenceStartIndex, i);
  //         silenceStartIndex = -1;
  //       }
  //     } else {
  //       silenceStartIndex = -1;
  //     }
  //   }

  //   return chunks;
  // };

  // splitAudioOnSilence(
  //   audioData: Float32Array,
  //   chunks: number[],
  //   keepSilence: boolean,
  // ): Float32Array[] {
  //   const audioChunks: Float32Array[] = [];

  //   let start = 0;
  //   for (let i = 0; i < chunks.length; i += 2) {
  //     const silenceStart = chunks[i];
  //     const silenceEnd = chunks[i + 1];

  //     if (start < silenceStart) {
  //       audioChunks.push(
  //         audioData.slice(
  //           start,
  //           keepSilence ? silenceEnd : silenceStart,
  //         ) as Float32Array,
  //       );
  //     }
  //     if (keepSilence) {
  //       audioChunks.push(
  //         audioData.slice(silenceStart, silenceEnd) as Float32Array,
  //       );
  //     }
  //     start = silenceEnd;
  //   }
  //   if (start < audioData.length) {
  //     audioChunks.push(audioData.slice(start) as Float32Array);
  //   }

  //   return audioChunks;
  // }
}
function getTempPath(): string {
  throw new Error('Function not implemented.');
}
