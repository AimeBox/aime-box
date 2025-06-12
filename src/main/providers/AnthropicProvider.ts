import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import Anthropic from '@anthropic-ai/sdk';
import { ChatAnthropic } from '@langchain/anthropic';
import settingsManager from '../settings';

export class AnthropicProvider extends BaseProvider {
  name: string = ProviderType.ANTHROPIC;

  description: string;

  defaultApiBase: string = 'https://api.anthropic.com';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatAnthropic({
      temperature: options?.temperature,
      model: modelName,
      apiKey: this.provider.api_key,
      anthropicApiUrl: this.provider.api_base || this.defaultApiBase,
      topK: options?.top_k,
      topP: options?.top_p,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
    });
    llm.clientOptions.httpAgent = settingsManager.getHttpAgent();
    llm.clientOptions.baseURL = this.provider.api_base || this.defaultApiBase;
    return llm;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const anthropic = new Anthropic({
      apiKey: this.provider.api_key,
      httpAgent: settingsManager.getHttpAgent(),
      baseURL: this.provider.api_base || this.defaultApiBase,
    });

    const data = await anthropic.models.list();

    return data.data
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models?.find((z) => z.name == x.id)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
