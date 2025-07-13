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
import fs from 'fs';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';

export class LmStudioProvider extends BaseProvider {
  name: string = ProviderType.LMSTUDIO;

  description: string;

  defaultApiBase: string = 'http://127.0.0.1:1234/v1';

  httpProxy: HttpsProxyAgent | undefined;

  openaiClient: OpenAI;

  constructor(params?: BaseProviderParams) {
    super(params);
    this.httpProxy = settingsManager.getHttpAgent();
    this.openaiClient = new OpenAI({
      baseURL: this.provider.api_base,
      apiKey: this.provider.api_key,
      httpAgent: this.httpProxy,
    });
  }

  getEmbeddings(modelName: string): Embeddings {
    const emb = new OpenAIEmbeddings({
      model: modelName,
      apiKey: this.provider.api_key,
      configuration: {
        baseURL: this.provider.api_base,
        httpAgent: settingsManager.getHttpAgent(),
      },
    });
    return emb;
  }

  async getModelList(): Promise<{ name: string; enable: boolean }[]> {
    const models = (await this.openaiClient.models.list()).data;
    return models
      .filter((x) => !x.id.startsWith('text-embedding-'))
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
    const list = await this.openaiClient.models.list();
    return list.data
      .filter((x) => x.id.startsWith('text-embedding-'))
      .map((x) => x.id)
      .sort();
  }
}
