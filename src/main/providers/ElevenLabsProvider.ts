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
    return ['speech-02-hd', 'speech-02-turbo'];
  }

  async getSTTModels(): Promise<string[]> {
    return ['speech-02-hd', 'speech-02-turbo'];
  }

  async speech(modelName: string, text: string, config: any): Promise<Buffer> {
    const url = `${this.provider.api_base || this.defaultApiBase}/t2a_v2?GroupId=${this.groupId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        text: text,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: config.speed,
          vol: 1,
          pitch: 0,
          emotion: config.emotion,
          english_normalization: config.english_normalization,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'wav',
        },
      }),
    });
    if (!response.ok)
      throw new Error(`generation audio fail: ${await response.text()}`);
    const data = await response.json();
    if (data.base_resp.status_code !== 0) {
      throw new Error(`generation audio fail: ${data.base_resp.status_msg}`);
    }
    const buffer = Buffer.from(data.data.audio, 'hex');
    return buffer;
  }

  async soundEffects(input: {
    text: string;
    durationSeconds: number;
    promptInfluence: number;
    outputFormat: TextToSoundEffectsConvertRequestOutputFormat;
  }) {
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
}
