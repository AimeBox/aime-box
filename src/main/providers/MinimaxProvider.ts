import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { ChatMinimax } from '@langchain/community/chat_models/minimax';
import { OpenAI } from 'openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ChatOpenAI } from '@langchain/openai';

export class MinimaxProvider extends BaseProvider {
  name: string = ProviderType.MINIMAX;

  description: string;

  defaultApiBase: string = 'https://api.minimax.chat/v1';

  apiKey: string;

  groupId: string;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.apiKey =
      this.provider.api_key || getEnvironmentVariable('MINIMAX_API_KEY');
    this.groupId =
      this.provider.config.groupId ||
      getEnvironmentVariable('MINIMAX_GROUP_ID');
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      modelName: modelName,
      configuration: {
        apiKey: this.apiKey,
        baseURL: this.provider.api_base || this.defaultApiBase,
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
    // return new ChatMinimax({
    //   model: modelName,
    //   apiKey: apiKey,
    //   streaming: options?.streaming,
    //   temperature: options?.temperature,
    //   topP: options?.top_p,
    //   minimaxApiKey: apiKey,
    // });
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const models = ['MiniMax-Text-01', 'abab6.5s-chat', 'DeepSeek-R1'];

    return models
      .map((x) => {
        return {
          name: x,
          enable:
            this.provider.models.find((z) => z.name == x)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    return [];
  }

  async getTTSModels(): Promise<string[]> {
    return ['speech-02-hd', 'speech-02-turbo'];
  }

  async speech(modelName: string, text: string): Promise<Buffer> {
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
          speed: 1,
          vol: 1,
          pitch: 0,
          emotion: 'happy',
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
}
