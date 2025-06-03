import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { ChatMinimax } from '@langchain/community/chat_models/minimax';
import { OpenAI } from 'openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { ChatOpenAI } from '@langchain/openai';

export class DeepSeekProvider extends BaseProvider {
  
  name: string = ProviderType.DEEPSEEK;

  description: string;

  defaultApiBase: string = 'https://api.deepseek.com';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {

    const llm = new ChatOpenAI({
      apiKey: this.provider.api_key,
      modelName: modelName,
      configuration: {
        apiKey: this.provider.api_key,
        baseURL: this.provider.api_base || this.defaultApiBase,
        // httpAgent: settingsManager.getHttpAgent(),
      },
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      streaming: options?.streaming,
    });
    return llm;
  }

  async getModelList(): Promise<{ name: string; enable: boolean; }[]> {
    const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${this.provider.api_key}`,
          },
        };

        const url = 'https://api.deepseek.com/models';
        const res = await fetch(url, options);
        const models = await res.json();
        return models.data
          .map((x) => {
            return {
              name: x.id,
              enable:
                this.provider.models?.find((z) => z.name == x.id)?.enable || false,
              input_token:
                this.provider.models.find((z) => z.name == x.id)?.input_token || 0,
              output_token:
                this.provider.models.find((z) => z.name == x.id)?.output_token ||
                0,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
  }
}