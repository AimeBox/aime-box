import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { ChatMinimax } from '@langchain/community/chat_models/minimax';
import { OpenAI } from 'openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ChatOpenAI } from '@langchain/openai';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { pipeline } from 'stream/promises';
import { TextToSoundEffectsConvertRequestOutputFormat } from '@elevenlabs/elevenlabs-js/api';

export class ElevenLabsProvider extends BaseProvider {
  name: string = ProviderType.ELEVENLABS;

  description: string;

  defaultApiBase: string = 'https://api.elevenlabs.io/v1';

  apiKey: string;

  elevenlabs: ElevenLabsClient;

  constructor(params?: BaseProviderParams) {
    super(params);
    const apiKey =
      this.provider.api_key || getEnvironmentVariable('ELEVENLABS_API_KEY');
    this.elevenlabs = new ElevenLabsClient({
      apiKey: apiKey,
    });
  }

  async getTTSModels(): Promise<string[]> {
    return ['eleven_v3', 'eleven_multilingual_v2'];
  }

  async getSTTModels(): Promise<string[]> {
    return ['scribe_v1'];
  }

  async speech(
    modelName: string,
    text: string,
    config: {
      voiceDescription?: string;
    },
  ): Promise<Buffer> {
    if (config?.voiceDescription) {
      const { previews } = await this.elevenlabs.textToVoice.design({
        modelId: 'eleven_multilingual_ttv_v2',
        voiceDescription: config.voiceDescription,
        text: text,
      });
    }
    const response = await this.elevenlabs.textToSpeech.convert(
      'JBFqnCBsd6RMkjVDRZzb',
      {
        text: text,
        modelId: modelName,
        outputFormat: 'mp3_44100_128',
      },
    );
    const chunks: Buffer[] = [];

    await pipeline(response, async function* (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) {
        chunks.push(chunk);
        yield; // 不需要实际传输数据
      }
    });

    return Buffer.concat(chunks);
  }

  async transcriptions(
    modelName: string,
    filePath: string,
    config: {
      diarize: boolean;
    } = {
      diarize: false,
    },
  ): Promise<string> {
    const result = await this.elevenlabs.speechToText.convert({
      file: fs.createReadStream(filePath),
      modelId: modelName || 'scribe_v1',
      diarize: config.diarize,
    });
    if (result.transcripts) {
      // Multichannel response
      result.transcripts.forEach((transcript, index) => {
        console.log(`Channel ${transcript.channel_index}: ${transcript.text}`);
      });
    } else {
      // Single channel response
      console.log(`Text: ${result.text}`);
    }

    return result.text;
  }

  async soundEffects(input: {
    text: string;
    durationSeconds: number;
    promptInfluence: number;
    outputFormat: TextToSoundEffectsConvertRequestOutputFormat;
  }): Promise<Buffer> {
    const response = await this.elevenlabs.textToSoundEffects.convert({
      ...input,
      outputFormat: (input.outputFormat ||
        'mp3_44100_128') as TextToSoundEffectsConvertRequestOutputFormat,
    });
    const chunks: Buffer[] = [];

    await pipeline(response, async function* (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) {
        chunks.push(chunk);
        yield; // 不需要实际传输数据
      }
    });

    return Buffer.concat(chunks);
  }

  async getVoiceList() {
    const response = await this.elevenlabs.voices.getAll({ showLegacy: true });

    return response.voices;
  }

  async voiceCloning(input: {
    name: string;
    files: string[];
    description?: string;
    labels?: string;
    removeBackgroundNoise?: boolean;
  }): Promise<any> {
    const response = await this.elevenlabs.voices.ivc.create({
      name: input.name,
      files: input.files.map((file) => fs.createReadStream(file)),
      description: input.description,
      labels: input.labels,
      removeBackgroundNoise: input.removeBackgroundNoise,
    });
    return response;
  }
}
