import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import Anthropic from '@anthropic-ai/sdk';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import Groq from 'groq-sdk';
import settingsManager from '../settings';

export class GroqProvider extends BaseProvider {
  name: string = ProviderType.GROQ;

  description: string;

  defaultApiBase: string = 'https://api.groq.com';

  constructor(params?: BaseProviderParams) {
    super(params);
  }

  getChatModel(modelName: string, options: ChatOptions): BaseChatModel {
    const llm = new ChatGroq({
      modelName: modelName,
      apiKey: this.provider.api_key,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
      baseUrl: this.provider.api_base || this.defaultApiBase,
    }) as ChatGroq;
    //llm.client.httpAgent = settingsManager.getHttpAgent();
    //llm.client.baseURL = provider.api_base;
    return llm;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const groq = new Groq({
      baseURL: this.provider.api_base || this.defaultApiBase,
      apiKey: this.provider.api_key,
    });
    groq.httpAgent = settingsManager.getHttpAgent();
    const list = await groq.models.list();
    return list.data
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
