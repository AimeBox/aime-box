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

export class AzureOpenAIProvider extends BaseProvider {
  name: string = ProviderType.AZURE_OPENAI;

  description: string;

  defaultApiBase: string =
    'https://<instance-name>.cognitiveservices.azure.com';

  httpProxy: HttpsProxyAgent | undefined;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const endpoint = this.provider.api_base;
    const apiVersion = this.provider.config?.apiVersion || '2024-10-21';
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${endpoint}/openai/models?api-version=${apiVersion}`;
    const res = await fetch(url, options);
    const models = await res.json();
    return models.data
      .filter((x) => x.capabilities.chat_completion && x.status == 'succeeded')
      .map((x) => {
        return {
          name: x.id,
          enable:
            this.provider.models?.find((z) => z.name == x.id)?.enable || false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getEmbeddingModels(): Promise<string[]> {
    const endpoint = this.provider.api_base;
    const apiVersion = this.provider.config?.apiVersion || '2024-10-21';
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${this.provider.api_key}`,
      },
    };
    const url = `${endpoint}/openai/models?api-version=${apiVersion}`;

    const res = await fetch(url, options);
    const models = await res.json();

    const emb_models: string[] = models.data
      .filter((x) => x.capabilities.embeddings && x.status == 'succeeded')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((x) => x.id);
    return [...new Set(emb_models)];
  }
}
