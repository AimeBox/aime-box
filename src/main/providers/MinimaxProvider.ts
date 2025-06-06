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

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const apiKey =
      this.provider.api_key || getEnvironmentVariable('MINIMAX_API_KEY');
    const groupId =
      this.provider.api_key || getEnvironmentVariable('MINIMAX_GROUP_ID');
    return new ChatOpenAI({
      apiKey: apiKey,
      modelName: modelName,
      configuration: {
        apiKey: apiKey,
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
    const openai = new OpenAI({
      baseURL: this.provider.api_base || this.defaultApiBase,
      apiKey: this.provider.api_key,
    });
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
}
