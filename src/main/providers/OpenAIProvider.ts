import { Providers, ProviderType } from '@/entity/Providers';
import { BaseProvider, BaseProviderParams } from './BaseProvider';
import { Ollama } from 'ollama';
import { ChatOllama } from '@langchain/ollama';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import { ChatOptions } from '@/entity/Chat';
import { OpenAI } from 'openai';
import settingsManager from '../settings';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class OpenAIProvider extends BaseProvider {
  name: string = ProviderType.OPENAI;

  description: string;

  defaultApiBase: string = 'https://api.openai.com/v1';
  httpProxy: HttpsProxyAgent | undefined

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }


  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const openai = new OpenAI({
      baseURL: this.provider.api_base,
      apiKey: this.provider.api_key,
      httpAgent: this.httpProxy,
    });
    const models = (await openai.models.list()).data;
    return models
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models.find((z) => z.name == x.id)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const openai = new OpenAI({
      baseURL: this.provider.api_base,
      apiKey: this.provider.api_key,
      httpAgent: this.httpProxy,
    });

    const list = await openai.models.list();
    return list.data
        .filter((x) => x.id.startsWith('text-'))
        .map((x) => x.id)
        .sort()
  }
}