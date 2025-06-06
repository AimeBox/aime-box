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

export class OpenrouterProvider extends BaseProvider {
  name: string = ProviderType.OPENROUTER;

  description: string;

  defaultApiBase: string = 'https://openrouter.ai/api/v1';

  httpProxy: HttpsProxyAgent | undefined

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }


  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
    };

    const url = this.provider.api_base || this.defaultApiBase + '/models';
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models?.find((z) => z.name == x.id)?.enable || false,
          input_token: ((x.pricing?.prompt ?? 0) * 1000000).toFixed(2),
          output_token: ((x.pricing?.completion ?? 0) * 1000000).toFixed(2),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async getEmbeddingModels(): Promise<string[]> {
    return []
  }
}